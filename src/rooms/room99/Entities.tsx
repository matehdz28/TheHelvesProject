import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SPANS, makeRandom } from "./layout";

/**
 * Las figuras. Siluetas negras, altas y delgadas, que pasean despacio.
 *
 * No interactuan con el jugador a proposito: caminan su recorrido y le
 * ignoran. Esa indiferencia es lo que las hace inquietantes; si reaccionaran,
 * pasarian a ser un enemigo o un guia y la sala cambiaria de genero.
 *
 * Material basico y NEGRO, sin niebla. Con niebla se aclararian al alejarse y
 * dejarian de recortar; asi siguen siendo un agujero en la imagen a cualquier
 * distancia, que es como se leen en la referencia.
 *
 * El cuerpo es una pieza CONTINUA: cabeza, cuello y torso encadenados hasta la
 * cadera, y de ahi las extremidades. Antes la cabeza flotaba sobre las piernas
 * sin nada que las uniera, y a contraluz se veia el hueco: la figura parecia
 * partida en vez de una sola sombra.
 */
type Walker = {
  /** eje sobre el que pasea */
  axis: "x" | "z";
  center: [number, number];
  range: number;
  speed: number;
  phase: number;
  scale: number;
};

function Figure({ walker }: { walker: Walker }) {
  const group = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Mesh>(null!);
  const legR = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Mesh>(null!);
  const armR = useRef<THREE.Mesh>(null!);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#05070a", fog: false }),
    []
  );

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;

    const t = clock.elapsedTime * walker.speed + walker.phase;
    // vaiven suave: la figura recorre su tramo de ida y vuelta
    const u = Math.sin(t);
    const off = u * walker.range;

    if (walker.axis === "x") {
      g.position.set(walker.center[0] + off, 0, walker.center[1]);
      g.rotation.y = Math.cos(t) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      g.position.set(walker.center[0], 0, walker.center[1] + off);
      g.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
    }

    // zancada: en fase con el avance, y las piernas contrapuestas
    const stride = Math.cos(t) * 1.4;
    const swing = Math.sin(clock.elapsedTime * walker.speed * 6 + walker.phase) * 0.5 * Math.abs(stride);
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.7;
  });

  const s = walker.scale;

  return (
    <group ref={group} scale={s}>
      {/* cabeza */}
      <mesh position={[0, 2.16, 0]} material={material}>
        <sphereGeometry args={[0.36, 16, 12]} />
      </mesh>

      {/* cuello y torso: cierran el hueco entre cabeza y caderas */}
      <mesh position={[0, 1.92, 0]} material={material}>
        <capsuleGeometry args={[0.19, 0.18, 4, 10]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={material}>
        <capsuleGeometry args={[0.22, 0.44, 4, 10]} />
      </mesh>
      {/* cadera, de donde salen las piernas */}
      <mesh position={[0, 1.3, 0]} material={material}>
        <sphereGeometry args={[0.22, 12, 10]} />
      </mesh>

      {/* piernas: pivote en la cadera, para que la zancada gire desde ahi */}
      <group position={[-0.13, 1.3, 0]}>
        <mesh ref={legL} material={material} position={[0, -0.65, 0]}>
          <capsuleGeometry args={[0.105, 1.2, 4, 10]} />
        </mesh>
      </group>
      <group position={[0.13, 1.3, 0]}>
        <mesh ref={legR} material={material} position={[0, -0.65, 0]}>
          <capsuleGeometry args={[0.105, 1.2, 4, 10]} />
        </mesh>
      </group>

      {/* brazos larguisimos, casi hasta el suelo */}
      <group position={[-0.27, 1.82, 0]}>
        <mesh ref={armL} material={material} position={[0, -0.6, 0]}>
          <capsuleGeometry args={[0.085, 1.15, 4, 10]} />
        </mesh>
      </group>
      <group position={[0.27, 1.82, 0]}>
        <mesh ref={armR} material={material} position={[0, -0.6, 0]}>
          <capsuleGeometry args={[0.085, 1.15, 4, 10]} />
        </mesh>
      </group>
    </group>
  );
}

export default function Entities({ count = 5 }: { count?: number }) {
  const walkers = useMemo(() => {
    const rnd = makeRandom(917);
    const out: Walker[] = [];

    for (let i = 0; i < count; i++) {
      // se reparten por los tramos, con mas peso en las naves
      const s = SPANS[Math.floor(rnd() * SPANS.length)];
      const z = s.from - rnd() * s.bay.length;
      const wide = s.bay.half > 12;

      out.push({
        axis: wide && rnd() > 0.35 ? "x" : "z",
        center: [(rnd() - 0.5) * s.bay.half * 1.2, z],
        range: wide ? 5 + rnd() * 9 : 4 + rnd() * 7,
        // muy despacio: una travesia completa dura entre 25 y 60 segundos
        speed: 0.1 + rnd() * 0.14,
        phase: rnd() * Math.PI * 2,
        scale: 0.92 + rnd() * 0.3,
      });
    }
    return out;
  }, [count]);

  return (
    <>
      {walkers.map((w, i) => (
        <Figure key={i} walker={w} />
      ))}
    </>
  );
}
