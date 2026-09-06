import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PALETTE, REVEAL_GLSL, STREAKS_GLSL, type RevealUniforms } from "./reveal";

/**
 * Cupula que sigue a la camara. Blanca hasta que el frente la alcanza;
 * despues, rayones verdes cruzandola despacio.
 *
 * Al seguir a la camara, su posicion de mundo es (camara + direccion*R),
 * o sea que `revealAt` la trata como "muy lejos en esa direccion": el cenit
 * se pinta primero y el horizonte al final. Lo blanco retrocede.
 */
const vert = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3  uWhite;
uniform vec3  uSkyTop;
uniform vec3  uSkyHorizon;
uniform vec3  uStreak;
uniform vec3  uGroundFar;
uniform vec3  uEdge;
uniform float uStreakStrength;
uniform float uEdgeGlow;

varying vec3 vWorldPos;
varying vec3 vLocal;

${REVEAL_GLSL}
${STREAKS_GLSL}

void main() {
  vec3 dir = normalize(vLocal);
  float el = dir.y;

  float s = streaks(domeCoords(dir), uTime, 13.0);
  s = clamp(s * uStreakStrength, 0.0, 1.0);
  // se desvanecen hacia el horizonte
  s *= smoothstep(-0.02, 0.30, el);

  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(-0.05, 0.65, el));
  // mezcla, no suma: sumar sobre un cielo casi blanco recorta a blanco
  // y se perderia el verde
  vec3 painted = mix(sky, uStreak, s);

  // por debajo del horizonte se funde con el suelo lejano
  painted = mix(uGroundFar, painted, smoothstep(-0.14, 0.02, el));

  vec3 col = mix(uWhite, painted, revealAt(vWorldPos));
  col += uEdge * revealEdge(vWorldPos) * uEdgeGlow * 0.5;

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function Sky({
  uniforms,
  radius = 600,
  streakStrength = 1.0,
  edgeGlow = 0.5,
}: {
  uniforms: RevealUniforms;
  radius?: number;
  streakStrength?: number;
  edgeGlow?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  const u = useMemo(
    () => ({
      ...uniforms,
      uWhite:       { value: new THREE.Color(PALETTE.white) },
      uSkyTop:      { value: new THREE.Color(PALETTE.skyTop) },
      uSkyHorizon:  { value: new THREE.Color(PALETTE.skyHorizon) },
      uStreak:      { value: new THREE.Color(PALETTE.streak) },
      uGroundFar:   { value: new THREE.Color(PALETTE.groundFar) },
      uEdge:        { value: new THREE.Color(PALETTE.edge) },
      uStreakStrength: { value: streakStrength },
      uEdgeGlow:       { value: edgeGlow },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uniforms]
  );

  // la cupula viaja con el jugador para que el cielo nunca se "acerque"
  useFrame(({ camera }) => {
    if (ref.current) camera.getWorldPosition(ref.current.position);
  });

  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[radius, 40, 24]} />
      <shaderMaterial
        uniforms={u}
        vertexShader={vert}
        fragmentShader={frag}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
