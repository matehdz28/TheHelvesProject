import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE, REVEAL_GLSL, STREAKS_GLSL, type RevealUniforms } from "./reveal";

/**
 * Suelo del mundo B. Sigue siendo el mesh colisionable (se registra en
 * `collidableMeshes` igual que CollidableFloor).
 *
 * El reflejo NO usa render target: evalua la MISMA funcion `streaks` que el
 * cielo, pero con la direccion de vista reflejada en el plano. Sale gratis,
 * no duplica draw calls, y como es la misma funcion los rayones del piso
 * coinciden de verdad con los del cielo.
 */
const vert = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3  uWhite;
uniform vec3  uGroundNear;
uniform vec3  uGroundFar;
uniform vec3  uStreak;
uniform vec3  uEdge;
uniform float uReflect;
uniform float uEdgeGlow;
uniform float uFogDensity;

varying vec3 vWorldPos;

${REVEAL_GLSL}
${STREAKS_GLSL}

void main() {
  vec3 V = normalize(vWorldPos - cameraPosition);
  vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));

  // mas reflejo en angulo rasante, casi nada mirando a plomo
  float fres = pow(1.0 - abs(V.y), 3.0);

  // el reflejo va mas suave que el cielo: hace de espejo empanado
  float s = streaks(domeCoords(R), uTime, 6.0);
  s = clamp(s * fres * uReflect, 0.0, 1.0);

  float dist = length(vWorldPos.xz - cameraPosition.xz);
  float fog = 1.0 - exp(-dist * uFogDensity);

  vec3 ground  = mix(uGroundNear, uGroundFar, fog);
  vec3 painted = mix(ground, uStreak, s * (1.0 - fog));

  vec3 col = mix(uWhite, painted, revealAt(vWorldPos));
  col += uEdge * revealEdge(vWorldPos) * uEdgeGlow;

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function Ground({
  uniforms,
  collidableMeshes,
  size = 800,
  reflect = 0.85,
  edgeGlow = 0.9,
  fogDensity = 0.006,
}: {
  uniforms: RevealUniforms;
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  size?: number;
  reflect?: number;
  edgeGlow?: number;
  fogDensity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  const u = useMemo(
    () => ({
      ...uniforms,
      uWhite:      { value: new THREE.Color(PALETTE.white) },
      uGroundNear: { value: new THREE.Color(PALETTE.groundNear) },
      uGroundFar:  { value: new THREE.Color(PALETTE.groundFar) },
      uStreak:     { value: new THREE.Color(PALETTE.streak) },
      uEdge:       { value: new THREE.Color(PALETTE.edge) },
      uReflect:    { value: reflect },
      uEdgeGlow:   { value: edgeGlow },
      uFogDensity: { value: fogDensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uniforms]
  );

  useEffect(() => {
    const mesh = ref.current;
    if (mesh && !collidableMeshes.current.includes(mesh)) {
      collidableMeshes.current.push(mesh);
    }
    return () => {
      if (!mesh) return;
      const i = collidableMeshes.current.indexOf(mesh);
      if (i >= 0) collidableMeshes.current.splice(i, 1);
    };
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial uniforms={u} vertexShader={vert} fragmentShader={frag} />
    </mesh>
  );
}
