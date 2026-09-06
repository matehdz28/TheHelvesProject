import { useMemo } from "react";
import * as THREE from "three";

/**
 * Haz de luz volumetrico.
 *
 * Es geometria, no post-proceso: una caja alargada con mezcla ADITIVA y un
 * degradado radial desde su eje. Al sumarse sobre lo que hay detras, y al no
 * escribir profundidad, se lee como aire iluminado en vez de como un solido.
 *
 * Se usa caja y no plano porque un plano desaparece al mirarlo de canto. Con
 * volumen, el haz sigue ahi desde cualquier angulo.
 */
const vert = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3  uColor;
uniform float uHalfW;
uniform float uHalfL;
uniform float uIntensity;

varying vec3 vLocal;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  // distancia al eje del haz, normalizada
  float r = clamp(length(vLocal.xz) / uHalfW, 0.0, 1.0);
  float radial = pow(1.0 - r, 2.3);

  // se apaga hacia el suelo: la luz entra por arriba
  float t = (vLocal.y + uHalfL) / (2.0 * uHalfL);
  float along = mix(0.25, 1.0, t);

  // grano de polvo en suspension, si no el haz parece plastico
  float dust = 0.86 + 0.14 * hash21(floor(vLocal.xz * 7.0) + floor(vLocal.y * 3.0));

  gl_FragColor = vec4(uColor * radial * along * dust * uIntensity, 1.0);
}
`;

export default function LightShaft({
  from,
  to,
  width = 3.2,
  intensity = 0.5,
  color = "#c3d4dc",
}: {
  /** por donde entra la luz */
  from: [number, number, number];
  /** donde da */
  to: [number, number, number];
  width?: number;
  intensity?: number;
  color?: string;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    // la caja nace con su largo en +Y; se gira para alinearla con el haz
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().negate()
    );
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: q,
      length: len,
    };
  }, [from, to]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uHalfW: { value: width / 2 },
      uHalfL: { value: length / 2 },
      uIntensity: { value: intensity },
    }),
    [color, width, length, intensity]
  );

  return (
    <mesh position={position} quaternion={quaternion} renderOrder={10}>
      <boxGeometry args={[width, length, width]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        fog={false}
      />
    </mesh>
  );
}

/** Charco de luz en el suelo, donde el haz aterriza. */
export function LightPool({
  at,
  size = 9,
  intensity = 0.55,
  color = "#c8d8e0",
}: {
  at: [number, number];
  size?: number;
  intensity?: number;
  color?: string;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    }),
    [color, intensity]
  );

  return (
    <mesh
      position={[at[0], 0.02, at[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={9}
    >
      <planeGeometry args={[size, size * 1.9]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={`
          uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float d = length(p * vec2(1.0, 0.72));
            float g = pow(max(0.0, 1.0 - d), 2.6);
            gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
          }`}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
