import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ROOF_Y, SHAFT } from "./Monolith";
import { makeGrainMap } from "./whiteTextures";

/**
 * La plataforma que sube a la azotea.
 *
 * No mueve al jugador: se limita a publicar su altura, y el control lo apoya
 * encima como haria con cualquier otra superficie. Empujarlo a mano daria
 * tirones cada vez que el frame se retrasa; asi va pegado por construccion.
 *
 * Arranca cuando el edificio termina de salir, no al pisarla: el jugador ya
 * esta encima desde el principio, viendo crecer la torre a su lado. Que
 * hubiera que buscarla y esperar sobre ella rompería ese plano.
 */
/** separada de la torre: sube por fuera y arriba se cruza por la pasarela */
export const PLATFORM = {
  x: SHAFT.x,
  z: SHAFT.z + SHAFT.d / 2 + 16,
  w: 16,
  d: 16,
  thickness: 1.2,
};
const SPEED = 15;
const WAIT = 2.2;

export type ElevatorState = { y: number; going: boolean };

export default function Elevator({
  state,
  autoStart,
  onArrived,
}: {
  /** altura actual del suelo de la plataforma, leida por el control */
  state: React.MutableRefObject<ElevatorState>;
  /** el edificio ya esta a su altura: la plataforma arranca sola */
  autoStart: boolean;
  /** ha coronado: hasta entonces el jugador va de pasajero */
  onArrived: () => void;
}) {
  const mesh = useRef<THREE.Group>(null!);
  const waited = useRef(0);
  const landed = useRef(false);

  const grain = useMemo(() => makeGrainMap(63, 256), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#cfcdc8",
        roughness: 1,
        metalness: 0,
        map: grain,
      }),
    [grain]
  );

  useFrame((_, dt) => {
    const s = state.current;

    if (!s.going) {
      if (autoStart) {
        // una pausa corta tras el ultimo movimiento del edificio, para que no
        // se solapen los dos gestos
        waited.current += dt;
        if (waited.current > WAIT) s.going = true;
      }
    } else if (s.y < ROOF_Y) {
      s.y = Math.min(ROOF_Y, s.y + SPEED * dt);
      if (s.y >= ROOF_Y && !landed.current) {
        landed.current = true;
        onArrived();
      }
    }

    if (mesh.current) mesh.current.position.y = s.y;
  });

  return (
    <group ref={mesh}>
      <mesh
        position={[PLATFORM.x, -PLATFORM.thickness / 2, PLATFORM.z]}
        material={mat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[PLATFORM.w, PLATFORM.thickness, PLATFORM.d]} />
      </mesh>
      {/*
        Pretil SOLO en los costados. Los dos lados en z quedan libres a
        proposito: por uno se entra desde la calzada y por el otro se sale a
        la azotea. Cerrar cualquiera de los dos obligaria a saltar el pretil
        justo en el momento de subir o bajar.

        Van referidos a PLATFORM.x, no a cero: al mover la torre, un parapeto
        con la coordenada escrita a mano se queda plantado donde estaba.
      */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[PLATFORM.x + (side * PLATFORM.w) / 2, 0.55, PLATFORM.z]}
          material={mat}
          castShadow
        >
          <boxGeometry args={[1, 1.1, PLATFORM.d]} />
        </mesh>
      ))}
    </group>
  );
}
