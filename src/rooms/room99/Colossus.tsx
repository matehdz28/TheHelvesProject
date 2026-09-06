import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/**
 * La cosa enorme que cruza el fondo.
 *
 * Escala y lentitud van juntas: lo que hace que algo parezca gigante no es su
 * tamano en pantalla sino el TIEMPO que tarda en moverse. Un paso cada siete
 * segundos, y el ojo deduce la masa solo.
 *
 * Negro absoluto y sin niebla, como las otras figuras: a esta distancia la
 * niebla lo disolveria en el cielo y perderia el recorte, que es todo lo que
 * tiene.
 */
const HEIGHT = 118;
const STEP_SECONDS = 7;
const STRIDE = 26;

export default function Colossus({
  onStep,
  z = -300,
  fromX = -230,
  toX = 260,
}: {
  /** avisa en cada pisada, con 0..1 de lejania */
  onStep: (distance: number) => void;
  z?: number;
  fromX?: number;
  toX?: number;
}) {
  const root = useRef<THREE.Group>(null!);
  const hipL = useRef<THREE.Group>(null!);
  const hipR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const lastStep = useRef(-1);

  const black = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#000000", fog: false }),
    []
  );

  /** lomo arqueado: un tubo sobre una curva, no una caja */
  const spine = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1.5, 9, 2),
      new THREE.Vector3(-2, 17, 7),
      new THREE.Vector3(0, 21, 14),
      new THREE.Vector3(4, 19, 20),
      new THREE.Vector3(7, 13, 23),
    ].map((p) => p.multiplyScalar(HEIGHT / 46));
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, 40, HEIGHT * 0.038, 10, false);
  }, []);

  const thigh = HEIGHT * 0.34;
  const shin = HEIGHT * 0.36;
  const limbR = HEIGHT * 0.016;

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;

    const time = clock.elapsedTime;
    const p = time / (STEP_SECONDS * 2); // ciclo completo = dos pasos
    const span = toX - fromX;
    const travel = ((p * STRIDE * 2) % (span + 120)) - 60;

    g.position.set(fromX + travel, 0, z);
    g.rotation.y = Math.PI / 2;

    // fase de cada pierna, desfasadas medio ciclo
    const ph = (n: number) => (p + n) % 1;
    const swing = (f: number) => Math.sin(f * Math.PI * 2);
    const lift = (f: number) => Math.max(0, Math.sin(f * Math.PI * 2));

    if (hipL.current) hipL.current.rotation.x = swing(ph(0)) * 0.5;
    if (hipR.current) hipR.current.rotation.x = swing(ph(0.5)) * 0.5;
    if (kneeL.current) kneeL.current.rotation.x = -lift(ph(0)) * 0.85;
    if (kneeR.current) kneeR.current.rotation.x = -lift(ph(0.5)) * 0.85;

    // el cuerpo cabecea con cada apoyo
    g.position.y = Math.abs(Math.sin(p * Math.PI * 2)) * HEIGHT * 0.012;

    // pisada: al completarse cada media fase
    const stepIndex = Math.floor(p * 2);
    if (stepIndex !== lastStep.current) {
      lastStep.current = stepIndex;
      const dist = Math.min(1, Math.abs(z) / 420);
      onStep(dist);
    }
  });

  return (
    <group ref={root}>
      <mesh geometry={spine} material={black} position={[0, HEIGHT * 0.62, 0]} />

      {/* cabeza pequena: la desproporcion es lo que inquieta */}
      <mesh material={black} position={[HEIGHT * 0.15, HEIGHT * 0.9, HEIGHT * 0.5]}>
        <sphereGeometry args={[HEIGHT * 0.035, 14, 12]} />
      </mesh>

      {[-1, 1].map((side) => (
        <group
          key={side}
          ref={side < 0 ? hipL : hipR}
          position={[side * HEIGHT * 0.035, HEIGHT * 0.62, 0]}
        >
          <mesh material={black} position={[0, -thigh / 2, 0]}>
            <capsuleGeometry args={[limbR, thigh, 4, 10]} />
          </mesh>
          <group ref={side < 0 ? kneeL : kneeR} position={[0, -thigh, 0]}>
            <mesh material={black} position={[0, -shin / 2, 0]}>
              <capsuleGeometry args={[limbR * 0.78, shin, 4, 10]} />
            </mesh>
            {/* pie largo y fino, casi una pezuna */}
            <mesh
              material={black}
              position={[0, -shin, HEIGHT * 0.02]}
              rotation={[Math.PI / 2.4, 0, 0]}
            >
              <capsuleGeometry args={[limbR * 0.6, HEIGHT * 0.05, 4, 8]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
