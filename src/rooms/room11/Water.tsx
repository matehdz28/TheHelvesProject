import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { NOISE_GLSL } from "./glsl";
import { WATER_COLOR, SHORE_Z, WATER_END_Z, WATER_Y, HAZE } from "./layers";

/**
 * El agua, con el picado en movimiento de la foto.
 *
 * Las bandas van muy estiradas en X y comprimidas en Z: vistas casi de canto
 * eso da el rayado horizontal caracteristico. La intensidad cae con la
 * distancia y el color se va a la bruma en el fondo, para que la orilla lejana
 * no corte en seco contra los bastidores.
 */
const vert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3  uDeep;
uniform vec3  uCrest;
uniform vec3  uHaze;
uniform float uTime;

varying vec3 vWorld;

${NOISE_GLSL}

void main() {
  float dist = abs(vWorld.z);

  // olas: muy anchas en X, finas en Z
  float n = fbm(vec2(vWorld.x * 0.012, vWorld.z * 0.22) + vec2(uTime * 0.02, uTime * 0.07));
  float m = fbm(vec2(vWorld.x * 0.05, vWorld.z * 0.6) - vec2(uTime * 0.035, uTime * 0.11));

  float crest = smoothstep(0.52, 0.78, n * 0.65 + m * 0.5);

  // el detalle se pierde a lo lejos, si no hierve en el horizonte
  crest *= 1.0 - smoothstep(120.0, 620.0, dist);

  vec3 col = mix(uDeep, uCrest, crest * 0.55);
  col = mix(col, uHaze, smoothstep(260.0, 730.0, dist) * 0.45);

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function Water() {
  const uniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Color(WATER_COLOR) },
      uCrest: { value: new THREE.Color("#42618f") },
      uHaze: { value: new THREE.Color(HAZE) },
      uTime: { value: 0 },
    }),
    []
  );
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    uniforms.uTime.value = t.current;
  });

  const len = Math.abs(WATER_END_Z - SHORE_Z);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, (SHORE_Z + WATER_END_Z) / 2]}>
      <planeGeometry args={[3200, len, 1, 220]} />
      <shaderMaterial uniforms={uniforms} vertexShader={vert} fragmentShader={frag} />
    </mesh>
  );
}
