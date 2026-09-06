import * as THREE from "three";

/**
 * El paisaje del mundo B no se enciende de golpe: un frente de onda circular
 * crece desde el punto por donde entraste y va pintando lo blanco.
 *
 * Todos los materiales del paisaje comparten ESTOS MISMOS objetos uniform
 * (por referencia), asi que mover `uRevealRadius.value` mueve el frente en
 * el cielo, el suelo y los arboles a la vez.
 */
export type RevealUniforms = {
  uRevealOrigin: { value: THREE.Vector3 };
  uRevealRadius: { value: number };
  uRevealFeather: { value: number };
  uTime: { value: number };
};

export const makeRevealUniforms = (): RevealUniforms => ({
  uRevealOrigin: { value: new THREE.Vector3() },
  uRevealRadius: { value: 0 },
  uRevealFeather: { value: 6 },
  uTime: { value: 0 },
});

export const PALETTE = {
  white:       "#ffffff",
  skyTop:      "#e8f2ea",
  skyHorizon:  "#f6faf6",
  streak:      "#2f9e57",
  groundNear:  "#dfeae1",
  groundFar:   "#f3f8f4",
  tree:        "#1f6b3a",
  edge:        "#7dffa8",
} as const;

/**
 * Se inyecta en cada shader del paisaje.
 *
 * `revealAt`   → 1 = ya pintado, 0 = todavia blanco.
 * `revealEdge` → 1 justo sobre el frente, para que la frontera brille.
 *
 * La distancia se mide en XZ (no en 3D) para que el frente sea un cilindro
 * vertical: el cielo directamente encima se pinta junto con el suelo bajo
 * tus pies, y lo lejano sigue blanco.
 */
export const REVEAL_GLSL = /* glsl */ `
uniform vec3  uRevealOrigin;
uniform float uRevealRadius;
uniform float uRevealFeather;
uniform float uTime;

float revealAt(vec3 wp) {
  float d = distance(wp.xz, uRevealOrigin.xz);
  return 1.0 - smoothstep(uRevealRadius - uRevealFeather, uRevealRadius, d);
}

float revealEdge(vec3 wp) {
  float d = distance(wp.xz, uRevealOrigin.xz);
  float e = 1.0 - smoothstep(0.0, uRevealFeather, abs(d - uRevealRadius));
  // sin esto, con radio 0 el frente brillaria sobre su propio origen y se
  // veria un resplandor verde por el portal antes de cruzar
  return e * step(0.001, uRevealRadius);
}
`;

/**
 * Rayones verdes. Lo usan el cielo Y el suelo (el suelo lo evalua con la
 * direccion reflejada, asi que las rayas se ven arrastradas en el piso).
 *
 * Las frecuencias son ENTERAS a proposito: `domeCoords` devuelve el azimut
 * en -0.5..0.5 y sin(TAU * N * az) con N entero cierra sin costura en el
 * meridiano donde atan2 salta.
 */
export const STREAKS_GLSL = /* glsl */ `
const float TAU = 6.28318530718;

vec2 domeCoords(vec3 dir) {
  vec3 d = normalize(dir);
  float az = atan(d.z, d.x) / TAU;                        // -0.5 .. 0.5
  float el = asin(clamp(d.y, -1.0, 1.0)) / 1.57079632679; // -1 .. 1
  return vec2(az, el);
}

float streaks(vec2 p, float t, float sharp) {
  float acc = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float freq = 14.0 + fi * 9.0;   // entero: 14, 23, 32, 41
    float q = p.x * freq + p.y * (2.0 + fi * 1.7) + t * (0.030 + fi * 0.018);
    float band = sin(q * TAU) * 0.5 + 0.5;
    band = pow(band, sharp + fi * 9.0);
    acc += band / (1.0 + fi * 0.7);
  }
  return acc;
}
`;
