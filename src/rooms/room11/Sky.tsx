import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { NOISE3_GLSL } from "./glsl";
import { SKY_TOP, SKY_MID, SKY_HORIZON, HAZE } from "./layers";

/**
 * Cupula de cielo con nubes VOLUMETRICAS.
 *
 * El ejemplo de three.js que sirve de referencia es WebGPU con TSL y marcha
 * una textura 3D dentro de una caja; aqui la sala corre en WebGL, asi que se
 * porta la TECNICA, no el codigo: se marcha el rayo de vista a traves de una
 * capa de nubes y la densidad sale de fbm 3D en vez de una textura.
 *
 * La capa es una CASCARA ESFERICA, no un plano: con un plano las nubes se
 * estirarian al infinito al mirar al horizonte. Con radio de suelo grande y
 * capa fina, convergen solas hacia el horizonte como en el cielo real.
 *
 * El sombreado, en cambio, va PLANO a proposito. Con degradado suave y
 * oscurecimiento del nucleo las nubes salian fotorrealistas y desentonaban
 * con el resto de la sala, que son bastidores de color liso. Asi que se
 * conserva la silueta volumetrica y se pinta con dos tonos planos y un borde
 * duro: nubes de cartel, no de fotografia.
 */
const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
uniform vec3  uTop;
uniform vec3  uMid;
uniform vec3  uHorizon;
uniform vec3  uHaze;
uniform vec3  uCloudLit;
uniform vec3  uCloudDark;
uniform float uTime;
uniform float uCoverage;
uniform float uDensity;

varying vec3 vDir;

${NOISE3_GLSL}

const float RG = 55.0;    // radio del suelo
const float H0 = 1.4;     // base de la capa
const float H1 = 3.6;     // techo de la capa

/** distancia del ojo a una cascara de radio R mirando con inclinacion mu */
float shellT(float R, float mu) {
  return sqrt(max(0.0, R * R - RG * RG * (1.0 - mu * mu))) - RG * mu;
}

/** altura normalizada dentro de la capa, 0 en la base y 1 en el techo */
float heightFrac(vec3 p) {
  return (length(p + vec3(0.0, RG, 0.0)) - RG - H0) / (H1 - H0);
}

float cloudDensity(vec3 p) {
  float h = heightFrac(p);
  if (h < 0.0 || h > 1.0) return 0.0;

  // base plana y cima mullida: es el perfil de un cumulo
  float shape = smoothstep(0.0, 0.22, h) * smoothstep(1.0, 0.48, h);

  vec3 q = p * 0.62 + vec3(uTime * 0.010, 0.0, uTime * 0.004);
  float n = fbm3(q);

  return max(0.0, n - uCoverage) * shape * uDensity;
}

vec4 marchClouds(vec3 d) {
  if (d.y < 0.015) return vec4(0.0);

  float t0 = shellT(RG + H0, d.y);
  float t1 = shellT(RG + H1, d.y);
  float dt = (t1 - t0) / float(STEPS);

  // desfase por pixel: sin esto se ven los escalones de la marcha
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  float t = t0 + dt * jitter;

  vec4 acc = vec4(0.0);

  for (int i = 0; i < STEPS; i++) {
    vec3 p = d * t;
    float dens = cloudDensity(p);

    if (dens > 0.002) {
      float h = clamp(heightFrac(p), 0.0, 1.0);
      // dos tonos planos con transicion corta, en vez de degradado continuo
      vec3 col = mix(uCloudDark, uCloudLit, smoothstep(0.40, 0.60, h));

      float a = 1.0 - exp(-dens * dt * 2.4);
      acc.rgb += (1.0 - acc.a) * a * col;
      acc.a += (1.0 - acc.a) * a;

      if (acc.a > 0.96) break;
    }

    t += dt;
  }

  return acc;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  vec3 sky = mix(uMid, uTop, smoothstep(0.16, 0.75, h));
  sky = mix(uHorizon, sky, smoothstep(0.0, 0.30, h));
  // por debajo del horizonte se funde con la bruma del terreno
  sky = mix(uHaze, sky, smoothstep(-0.09, 0.015, h));

  vec4 cloud = marchClouds(d);
  // borde duro: recorta el difuminado del raymarching y deja silueta limpia
  cloud.rgb /= max(cloud.a, 0.001);
  cloud.a = smoothstep(0.16, 0.40, cloud.a);
  cloud.rgb *= cloud.a;
  // se disuelven hacia el horizonte, donde el rayo seria larguisimo
  cloud *= smoothstep(0.015, 0.14, h);

  vec3 col = sky * (1.0 - cloud.a) + cloud.rgb;

  gl_FragColor = vec4(col, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export default function Sky({
  radius = 9000,
  /** pasos de marcha: el mando de calidad frente a coste */
  steps = 14,   // menos pasos: la silueta plana no pide tanto detalle
  /** cuanto cielo cubren: mas alto = menos nubes */
  coverage = 0.5,
  density = 2.6,
}: {
  radius?: number;
  steps?: number;
  coverage?: number;
  density?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(SKY_TOP) },
      uMid: { value: new THREE.Color(SKY_MID) },
      uHorizon: { value: new THREE.Color(SKY_HORIZON) },
      uHaze: { value: new THREE.Color(HAZE) },
      uCloudLit: { value: new THREE.Color("#f4f6f8") },
      uCloudDark: { value: new THREE.Color("#6e86a0") },
      uTime: { value: 0 },
      uCoverage: { value: coverage },
      uDensity: { value: density },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame(({ camera, clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    if (ref.current) camera.getWorldPosition(ref.current.position);
  });

  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[radius, 48, 32]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vert}
        fragmentShader={frag}
        side={THREE.BackSide}
        depthWrite={false}
        defines={{ STEPS: steps }}
      />
    </mesh>
  );
}
