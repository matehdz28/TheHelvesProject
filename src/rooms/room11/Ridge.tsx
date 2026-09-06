import { useMemo } from "react";
import * as THREE from "three";
import { NOISE_GLSL } from "./glsl";
import { HAZE, ridgeShape, type Flat } from "./layers";

/**
 * Un bastidor de paisaje.
 *
 * Antes eran color liso, y por eso se leian como recortes de cartulina. Ahora
 * llevan tres cosas que les dan cuerpo sin dejar de ser laminas:
 *
 *  - degradado vertical: la cresta la toca la luz, la falda se oscurece
 *  - moteado de ruido estirado en vertical, que insinua barrancos y laderas
 *  - la base se disuelve en la bruma, asi no corta en seco contra el agua ni
 *    contra el bastidor de detras
 *
 * El perfil superior tambien lleva mas octavas y mas segmentos, para que la
 * silueta tenga detalle fino y no solo ondas largas.
 */
const vert = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3  uBase;
uniform vec3  uCrest;
uniform vec3  uHaze;
uniform float uTop;
uniform float uBottom;
uniform float uNoiseX;
uniform float uNoiseY;
uniform float uMottle;

varying vec2 vLocal;

${NOISE_GLSL}

void main() {
  float t = clamp((vLocal.y - uBottom) / (uTop - uBottom), 0.0, 1.0);

  vec3 col = mix(uBase, uCrest, pow(t, 0.7));

  // barrancos: ruido comprimido en X y estirado en Y, o sea vetas verticales
  float n = fbm(vec2(vLocal.x * uNoiseX, vLocal.y * uNoiseY));
  col *= 1.0 - uMottle * 0.5 + uMottle * n;

  // la falda se pierde en la bruma
  col = mix(uHaze, col, smoothstep(0.0, 0.26, t));

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** aclara un color hacia el blanco, para sacar el tono de cresta */
function lighten(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  return c.lerp(new THREE.Color("#ffffff"), amount);
}

export default function Ridge({ flat, rotated = false }: { flat: Flat; rotated?: boolean }) {
  const geometry = useMemo(() => new THREE.ShapeGeometry(ridgeShape(flat)), [flat]);

  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color(flat.color) },
      uCrest: { value: lighten(flat.color, 0.26) },
      uHaze: { value: new THREE.Color(HAZE) },
      uTop: { value: flat.top },
      uBottom: { value: flat.bottom },
      // el ruido se escala con el tamano del bastidor para que el grano
      // aparente sea parecido en todos
      uNoiseX: { value: 260 / flat.width },
      uNoiseY: { value: 26 / Math.max(1, flat.top - flat.bottom) },
      uMottle: { value: flat.mottle ?? 0.22 },
    }),
    [flat]
  );

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, flat.z]}
      rotation={rotated ? [0, Math.PI, 0] : undefined}
    >
      <shaderMaterial uniforms={uniforms} vertexShader={vert} fragmentShader={frag} />
    </mesh>
  );
}
