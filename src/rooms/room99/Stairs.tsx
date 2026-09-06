import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Solid } from "./solids";

/**
 * Escalera exterior en zigzag, pegada a la fachada y hasta el remate.
 *
 * Dos tipos de pieza, y la distincion es deliberada:
 *
 *  - PELDANOS Y RELLANOS son cajas alineadas a los ejes, porque la colision
 *    solo sabe resolver eso y el apoyo devuelve su tapa. Son las que se pisan.
 *  - ZANCA Y PRETIL van INCLINADOS, que es lo que da la silueta diagonal de la
 *    referencia. Como son adorno y no se pisan, pueden ir rotados sin que la
 *    colision se entere.
 *
 * LOS TRAMOS VAN EN DOS CARRILES separados en z, no apilados sobre la misma
 * banda. Con un solo carril, el tramo de vuelta queda a un peldano escaso por
 * encima del de ida y ocupando su misma x: al llegar al giro, el primer
 * peldano del tramo siguiente cae por encima del limite que se sube sin saltar
 * y EMPUJA al jugador hacia atras justo antes de poder coronar el actual. La
 * escalera se ve perfecta y es intransitable, y no se nota mas que subiendola.
 *
 * La altura de tabica tambien importa para la colision: el primer peldano que
 * estorba es el que asoma por encima de pies+STEP_UP, asi que la tabica tiene
 * que ser lo bastante corta como para que ese peldano quede varios pasos por
 * delante y nunca dentro del radio del jugador.
 */
export const STAIR = {
  /** cara de la torre a la que se pega */
  faceZ: 58,
  /** cuanto vuela la escalera desde esa cara */
  depth: 16,
  fromY: 352,
  toY: 520,
  xA: 20,
  xB: 72,
  flights: 9,
  stepsPerFlight: 31,
  stepThickness: 0.55,
  landing: 9,
};

const RISE = (STAIR.toY - STAIR.fromY) / (STAIR.flights * STAIR.stepsPerFlight);
const RUN = (STAIR.xB - STAIR.xA) / STAIR.stepsPerFlight;

/** ancho de cada carril, con una junta entre los dos */
const LANE_D = STAIR.depth / 2 - 1;
/** eje del carril de cada tramo: los pares suben, los impares vuelven */
const laneZ = (f: number) =>
  STAIR.faceZ + (f % 2 === 0 ? STAIR.depth / 4 : (STAIR.depth * 3) / 4);
/** los rellanos cruzan los dos carriles, que es lo que permite cambiar de uno a otro */
const LANDING_Z = STAIR.faceZ + STAIR.depth / 2;

export const STAIR_RISE = RISE;
export const STAIR_ANGLE = Math.atan(RISE / RUN);

type Step = { x: number; y: number; z: number };

/** peldanos, en el orden en que se suben */
export const STAIR_STEPS: Step[] = (() => {
  const out: Step[] = [];
  for (let f = 0; f < STAIR.flights; f++) {
    const dir = f % 2 === 0 ? 1 : -1;
    const start = dir > 0 ? STAIR.xA : STAIR.xB;
    for (let i = 0; i < STAIR.stepsPerFlight; i++) {
      out.push({
        x: start + dir * RUN * (i + 0.5),
        y: STAIR.fromY + RISE * (f * STAIR.stepsPerFlight + i + 1),
        z: laneZ(f),
      });
    }
  }
  return out;
})();

/** rellanos: uno al final de cada tramo, donde la escalera da la vuelta */
export const STAIR_LANDINGS: Step[] = (() => {
  const out: Step[] = [];
  for (let f = 0; f < STAIR.flights; f++) {
    const dir = f % 2 === 0 ? 1 : -1;
    out.push({
      x: dir > 0 ? STAIR.xB + STAIR.landing / 2 : STAIR.xA - STAIR.landing / 2,
      y: STAIR.fromY + RISE * ((f + 1) * STAIR.stepsPerFlight),
      z: LANDING_Z,
    });
  }
  // arranque, al salir del puente
  out.unshift({ x: STAIR.xA - STAIR.landing / 2, y: STAIR.fromY, z: LANDING_Z });
  return out;
})();

export const STAIR_SOLIDS: Solid[] = [
  ...STAIR_STEPS.map((s) => ({
    x: s.x,
    z: s.z,
    w: RUN,
    d: LANE_D,
    base: s.y - STAIR.stepThickness,
    h: STAIR.stepThickness,
  })),
  ...STAIR_LANDINGS.map((s) => ({
    x: s.x,
    z: s.z,
    w: STAIR.landing,
    d: STAIR.depth,
    base: s.y - STAIR.stepThickness,
    h: STAIR.stepThickness,
  })),
];

export default function Stairs({ material }: { material: THREE.Material }) {
  const steps = useRef<THREE.InstancedMesh>(null!);
  const landings = useRef<THREE.InstancedMesh>(null!);

  const stepGeo = useMemo(
    () => new THREE.BoxGeometry(RUN, STAIR.stepThickness, LANE_D),
    []
  );
  const landGeo = useMemo(
    () => new THREE.BoxGeometry(STAIR.landing, STAIR.stepThickness, STAIR.depth),
    []
  );

  useEffect(() => {
    const d = new THREE.Object3D();
    STAIR_STEPS.forEach((s, i) => {
      d.position.set(s.x, s.y - STAIR.stepThickness / 2, s.z);
      d.updateMatrix();
      steps.current?.setMatrixAt(i, d.matrix);
    });
    if (steps.current) steps.current.instanceMatrix.needsUpdate = true;

    STAIR_LANDINGS.forEach((s, i) => {
      d.position.set(s.x, s.y - STAIR.stepThickness / 2, s.z);
      d.updateMatrix();
      landings.current?.setMatrixAt(i, d.matrix);
    });
    if (landings.current) landings.current.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(() => () => { stepGeo.dispose(); landGeo.dispose(); }, [stepGeo, landGeo]);

  /** zanca y pretil de cada tramo: inclinados, solo para la vista */
  const flights = useMemo(() => {
    const flightRun = RUN * STAIR.stepsPerFlight;
    const flightRise = RISE * STAIR.stepsPerFlight;
    const len = Math.hypot(flightRun, flightRise);
    return Array.from({ length: STAIR.flights }, (_, f) => {
      const dir = f % 2 === 0 ? 1 : -1;
      const midX = (STAIR.xA + STAIR.xB) / 2;
      const midY = STAIR.fromY + flightRise * (f + 0.5);
      // el pretil va por el lado exterior del carril, que cambia con el tramo
      const railZ = laneZ(f) + (dir > 0 ? -1 : 1) * (LANE_D / 2 - 0.5);
      return { midX, midY, len, z: laneZ(f), railZ, tilt: -dir * STAIR_ANGLE };
    });
  }, []);

  return (
    <group>
      <instancedMesh
        ref={steps}
        args={[stepGeo, material, STAIR_STEPS.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={landings}
        args={[landGeo, material, STAIR_LANDINGS.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />

      {flights.map((fl, i) => (
        <group key={i}>
          {/* zanca: la losa diagonal bajo los peldanos */}
          <mesh
            position={[fl.midX, fl.midY - 1.4, fl.z]}
            rotation={[0, 0, fl.tilt]}
            material={material}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[fl.len, 1.2, LANE_D]} />
          </mesh>
          {/* pretil por el lado que vuela */}
          <mesh
            position={[fl.midX, fl.midY + 1.1, fl.railZ]}
            rotation={[0, 0, fl.tilt]}
            material={material}
            castShadow
          >
            <boxGeometry args={[fl.len, 2.6, 0.8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
