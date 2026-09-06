import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { wallGeometry, COLUMN_WIDTH } from "./path";

/**
 * El pasillo del vacio: dos muros de tiras verticales que caen a toda
 * velocidad y encauzan la mirada hacia el portal.
 *
 * Las imagenes son PROCEDURALES, no archivos. A esa velocidad lo que se ve son
 * sobre todo trazos de color, asi que generarlas sale mas barato, no arrastra
 * assets y permite que cada columna tenga su propio ritmo.
 *
 * La estela se hace promediando TAPS muestras a lo largo del recorrido, que es
 * literalmente lo que es un desenfoque de movimiento. La longitud de la estela
 * crece con la velocidad de cada columna, asi que las lentas se leen casi
 * nitidas y las rapidas quedan en puro rayado, como en la referencia.
 *
 * Los muros SIGUEN LA CURVA del camino, que depende de por donde se pisara el
 * agua. La U de la malla lleva longitud de arco en metros, asi que cada tira
 * mide lo mismo en recta que en curva.
 */

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform float uTime;
uniform float uColumns;
uniform float uSeed;

varying vec2 vUv;

float h11(float p) {
  return fract(sin(p * 127.1 + uSeed) * 43758.5453);
}

float h21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
}

/** color saturado, de portada */
vec3 plateColor(vec2 id) {
  float hue = h21(id);
  float sat = 0.55 + 0.42 * h21(id + 7.0);
  float val = 0.42 + 0.55 * h21(id + 13.0);
  vec3 rgb = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return val * mix(vec3(1.0), rgb, sat);
}

/** una lamina de la tira, en coordenada continua v */
vec3 stripAt(float col, float v) {
  float idx = floor(v);
  float f = fract(v);
  vec2 id = vec2(col, idx);

  vec3 base = plateColor(id);

  // marcas internas: sin ellas, al ralentizar la columna se veria color liso
  float band = step(0.62, fract(f * 3.0 + h21(id + 3.0)));
  base = mix(base, base * 0.32, band * 0.55);

  float block = step(0.30, f) * step(f, 0.70) * step(0.5, h21(id + 21.0));
  base = mix(base, mix(base, vec3(1.0), 0.6), block);

  // marco negro entre laminas
  float edge = smoothstep(0.0, 0.035, f) * smoothstep(1.0, 0.965, f);
  return base * edge;
}

void main() {
  // vUv.x viene en METROS de arco, asi que dividir por el ancho de tira
  // da directamente el indice de columna
  float col = floor(vUv.x * uColumns);
  float inCol = fract(vUv.x * uColumns);

  // separacion oscura entre columnas
  float gap = smoothstep(0.0, 0.05, inCol) * smoothstep(1.0, 0.95, inCol);

  // algunas columnas van apagadas: son los huecos negros de la referencia
  float lit = step(0.24, h11(col * 1.7));

  float speed = 2.5 + 15.0 * h11(col * 3.1);
  float scale = 5.0 + 8.0 * h11(col * 5.3);
  // v crece con el tiempo, asi que el contenido BAJA
  float v = vUv.y * scale + uTime * speed + h11(col * 9.7) * 17.0;

  // estela proporcional a la velocidad
  float blur = 0.09 + speed * 0.055;

  vec3 c = vec3(0.0);
  for (int i = 0; i < TAPS; i++) {
    float t = (float(i) / float(TAPS - 1) - 0.5) * blur;
    c += stripAt(col, v + t);
  }
  c /= float(TAPS);

  gl_FragColor = vec4(c * gap * lit, 1.0);
}
`;

function Wall({
  curve,
  side,
  taps,
}: {
  curve: THREE.CatmullRomCurve3;
  side: 1 | -1;
  taps: number;
}) {
  const geometry = useMemo(() => wallGeometry(curve, side), [curve, side]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColumns: { value: 1 / COLUMN_WIDTH },
      // semilla distinta por muro: si no, los dos lados salen identicos
      uSeed: { value: side > 0 ? 0.0 : 37.3 },
    }),
    [side]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        side={THREE.DoubleSide}
        defines={{ TAPS: taps }}
      />
    </mesh>
  );
}

export default function Corridor({
  curve,
  taps = 10,
}: {
  curve: THREE.CatmullRomCurve3;
  taps?: number;
}) {
  return (
    <>
      <Wall curve={curve} side={-1} taps={taps} />
      <Wall curve={curve} side={1} taps={taps} />
    </>
  );
}
