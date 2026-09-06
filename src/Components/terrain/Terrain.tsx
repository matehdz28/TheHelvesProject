import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getTerrain, FOG_COLOR, FOG_DENSITY, PLANE_SIZE, tileSign } from "./terrainData";
import { BLUE_FOG, type Phase } from "./timeline";

/**
 * El mundo es el terreno y una copia suya flotando arriba: se vuela por la
 * ranura entre ambos. La copia va TRASLADADA, no espejada, para que la
 * separacion sea la misma en todos los puntos y nunca se crucen.
 *
 * Infinito por teselado 3x3 alrededor de la camara, con los tiles impares
 * reflejados (ver mirrorWrap): al compartir la fila del borde, dos vecinos
 * encajan exacto y no se ve costura. El bloque se recoloca cuando la camara
 * cambia de tile, asi que siempre hay terreno hasta mas alla de la niebla.
 *
 * El material va en DoubleSide: el techo se ve por su cara inferior, y los
 * tiles reflejados invierten el sentido de giro de las caras.
 */
const OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export default function Terrain({ phase }: { phase: Phase }) {
  const { geometry, texture, blueTexture, ceilingOffsetY } = useMemo(() => getTerrain(), []);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const lastTile = useRef<[number, number] | null>(null);

  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    [texture]
  );

  useEffect(() => {
    material.map = phase === "blue" ? blueTexture : texture;
    material.needsUpdate = true;
  }, [phase, material, texture, blueTexture]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    const ti = Math.round(camera.position.x / PLANE_SIZE);
    const tj = Math.round(camera.position.z / PLANE_SIZE);
    const last = lastTile.current;
    if (last && last[0] === ti && last[1] === tj) return;
    lastTile.current = [ti, tj];

    OFFSETS.forEach(([di, dj], n) => {
      const g = groups.current[n];
      if (!g) return;
      const i = ti + di;
      const j = tj + dj;
      g.position.set(i * PLANE_SIZE, 0, j * PLANE_SIZE);
      g.scale.set(tileSign(i), 1, tileSign(j));
    });
  });

  const fog = phase === "blue" ? BLUE_FOG : FOG_COLOR;

  return (
    <>
      <color attach="background" args={[fog]} />
      <fogExp2 attach="fog" args={[fog, FOG_DENSITY]} />

      {OFFSETS.map((_, n) => (
        <group key={n} ref={(el) => { groups.current[n] = el; }}>
          <mesh geometry={geometry} material={material} />
          <mesh geometry={geometry} material={material} position={[0, ceilingOffsetY, 0]} />
        </group>
      ))}
    </>
  );
}
