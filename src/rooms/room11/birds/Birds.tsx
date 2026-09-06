import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { positionFrag, velocityFrag, birdVert, birdFrag } from "./shaders";
import { SKY_HORIZON } from "../layers";

/**
 * La bandada. La simulacion corre en sus propias unidades (las del ejemplo) y
 * el grupo la coloca y escala en el mundo de la sala, asi que los numeros del
 * ejemplo siguen siendo validos.
 *
 * WIDTH 16 = 256 gaviotas. El shader de velocidad compara cada pajaro con
 * TODOS los demas, o sea coste cuadratico: con los 1024 del ejemplo serian mas
 * de un millon de lecturas de textura por frame, de sobra para una bandada de
 * fondo.
 */
const WIDTH = 16;
const BIRDS = WIDTH * WIDTH;
const BOUNDS = 800;
const FADE_X = 1500;
/** cabeza de la cola de siembra (las primeras en llegar) */
const SEED_HEAD = -700;
/** longitud de la cola hacia atras */
const SEED_TAIL = 1050;
const DRIFT = 5.0;

/**
 * A 300 m las gaviotas quedaban en 8 px: motas. Acercadas y agrandadas,
 * pasan a leerse como pajaros.
 * Escala 0.22 → bandada de ~176 m, envergadura 2.2 m, a ~16 m/s.
 */
export const FLOCK_SCALE = 0.22;

/**
 * Las dos pasadas. Cada una es un montaje nuevo de la simulacion: las
 * gaviotas nacen fuera de cuadro por la izquierda, cruzan y se van. No hay
 * envoltura, asi que no reaparecen.
 */
export const PASSES = [
  { at: 10, position: new THREE.Vector3(0, 38, -150) },
  { at: 40, position: new THREE.Vector3(0, 34, -70) }, // mas cerca del jugador
];

function makeBirdGeometry() {
  const trianglesPerBird = 3;
  const triangles = BIRDS * trianglesPerBird;
  const points = triangles * 3;

  const g = new THREE.BufferGeometry();
  const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
  const birdColors = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
  const references = new THREE.BufferAttribute(new Float32Array(points * 2), 2);
  const birdVertex = new THREE.BufferAttribute(new Float32Array(points), 1);

  g.setAttribute("position", vertices);
  g.setAttribute("birdColor", birdColors);
  g.setAttribute("reference", references);
  g.setAttribute("birdVertex", birdVertex);

  let v = 0;
  const push = (...xs: number[]) => {
    for (const x of xs) vertices.array[v++] = x;
  };

  const wingsSpan = 20;
  for (let f = 0; f < BIRDS; f++) {
    push(0, 0, -20, 0, 4, -20, 0, 0, 30); // cuerpo
    push(0, 0, -15, -wingsSpan, 0, 0, 0, 0, 15); // ala izquierda
    push(0, 0, 15, wingsSpan, 0, 0, 0, 0, -15); // ala derecha
  }

  for (let i = 0; i < triangles * 3; i++) {
    const triangleIndex = ~~(i / 3);
    const birdIndex = ~~(triangleIndex / trianglesPerBird);
    const x = (birdIndex % WIDTH) / WIDTH;
    const y = ~~(birdIndex / WIDTH) / WIDTH;

    const c = 0.35 + ((birdIndex * 37) % 100) / 100 * 0.45;
    birdColors.array[i * 3 + 0] = c;
    birdColors.array[i * 3 + 1] = c;
    birdColors.array[i * 3 + 2] = c;

    references.array[i * 2] = x;
    references.array[i * 2 + 1] = y;
    birdVertex.array[i] = i % 9;
  }

  g.scale(0.25, 0.25, 0.25);
  return g;
}

export default function Birds({ position }: { position: THREE.Vector3 }) {
  const renderer = useThree((s) => s.gl);
  const [error, setError] = useState<string | null>(null);
  const sim = useRef<{
    gpu: GPUComputationRenderer;
    posVar: ReturnType<GPUComputationRenderer["addVariable"]>;
    velVar: ReturnType<GPUComputationRenderer["addVariable"]>;
  } | null>(null);

  const geometry = useMemo(() => makeBirdGeometry(), []);

  const uniforms = useMemo(
    () => ({
      texturePosition: { value: null as THREE.Texture | null },
      textureVelocity: { value: null as THREE.Texture | null },
      uBird: { value: new THREE.Color("#3b3f45") },
      uSky: { value: new THREE.Color(SKY_HORIZON) },
    }),
    []
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: birdVert,
        fragmentShader: birdFrag,
        side: THREE.DoubleSide,
        defines: { FADE_X: FADE_X.toFixed(1) },
      }),
    [uniforms]
  );

  useEffect(() => {
    const gpu = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

    const dtPosition = gpu.createTexture();
    const dtVelocity = gpu.createTexture();

    // Se siembran a la IZQUIERDA y fuera de cuadro, para que la bandada entre
    // en plano volando en vez de materializarse a la vista.
    //
    // Y muy ESTIRADAS en X, con la densidad cargada hacia atras: pow(r, 0.5)
    // amontona los valores cerca de 1, o sea la mayoria nace al fondo de la
    // cola. Resultado: primero llegan unas pocas rezagadas y el grueso va
    // entrando despues, en vez de aparecer la bandada entera de golpe.
    const p = dtPosition.image.data as unknown as Float32Array;
    for (let k = 0; k < p.length; k += 4) {
      p[k] = SEED_HEAD - Math.pow(Math.random(), 0.5) * SEED_TAIL;
      p[k + 1] = Math.random() * BOUNDS * 0.3 - BOUNDS * 0.15;
      p[k + 2] = Math.random() * BOUNDS * 0.5 - BOUNDS * 0.25;
      p[k + 3] = 1;
    }
    const v = dtVelocity.image.data as unknown as Float32Array;
    for (let k = 0; k < v.length; k += 4) {
      v[k] = DRIFT + (Math.random() - 0.5) * 2;
      v[k + 1] = (Math.random() - 0.5) * 2;
      v[k + 2] = (Math.random() - 0.5) * 2;
      v[k + 3] = 1;
    }

    const velVar = gpu.addVariable("textureVelocity", velocityFrag, dtVelocity);
    const posVar = gpu.addVariable("texturePosition", positionFrag, dtPosition);
    gpu.setVariableDependencies(velVar, [posVar, velVar]);
    gpu.setVariableDependencies(posVar, [posVar, velVar]);

    Object.assign(posVar.material.uniforms, {
      time: { value: 0 },
      delta: { value: 0 },
    });
    Object.assign(velVar.material.uniforms, {
      time: { value: 0 },
      delta: { value: 0 },
      separationDistance: { value: 22 },
      alignmentDistance: { value: 26 },
      cohesionDistance: { value: 26 },
      driftSpeed: { value: DRIFT },
    });

    for (const va of [velVar, posVar]) {
      va.wrapS = THREE.RepeatWrapping;
      va.wrapT = THREE.RepeatWrapping;
    }

    const err = gpu.init();
    if (err !== null) {
      setError(String(err));
      return;
    }

    sim.current = { gpu, posVar, velVar };
    return () => {
      gpu.dispose();
      sim.current = null;
    };
  }, [renderer]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((_, dt) => {
    const s = sim.current;
    if (!s) return;

    // capado: al volver de una pestana en segundo plano, un delta enorme
    // dispararia la simulacion al infinito
    const d = Math.min(dt, 0.05);
    s.posVar.material.uniforms.delta.value = d;
    s.velVar.material.uniforms.delta.value = d;

    s.gpu.compute();
    uniforms.texturePosition.value = s.gpu.getCurrentRenderTarget(s.posVar).texture;
    uniforms.textureVelocity.value = s.gpu.getCurrentRenderTarget(s.velVar).texture;
  });

  if (error) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      scale={FLOCK_SCALE}
      frustumCulled={false}
    />
  );
}
