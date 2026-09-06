import * as THREE from "three";

/**
 * Cuerpos solidos de la maqueta.
 *
 * UNA sola lista alimenta a la vez lo que se dibuja y lo que colisiona. Si
 * fueran dos, al mover un bloque quedarian muros invisibles o huecos por los
 * que se cuela el jugador, y ese desajuste es casi imposible de encontrar
 * mirando.
 *
 * Todos son cajas alineadas a los ejes, asi que basta resolver en planta: se
 * empuja al jugador por la cara mas cercana. Y en vertical, la caja mas alta
 * por debajo de sus pies es el suelo que pisa. Con eso se puede andar por las
 * azoteas sin necesidad de fisica de verdad.
 */
export type Solid = {
  /** centro en planta */
  x: number;
  z: number;
  w: number;
  d: number;
  /** base y altura, medidas desde el suelo del grupo */
  base: number;
  h: number;
};

export type SolidSet = {
  list: Solid[];
  /** desplazamiento vertical del grupo mientras emerge */
  offset: number;
};

const PLAYER_R = 1.4;
/** escalon que se sube sin saltar */
const STEP_UP = 1.8;

/**
 * Empuja al jugador fuera de los cuerpos, en planta.
 *
 * Se resuelve por el eje de MENOR penetracion: es lo que hace que al rozar una
 * esquina salgas de lado y no de golpe hacia atras.
 */
export function resolveXZ(set: SolidSet, pos: THREE.Vector3, feet: number) {
  for (const s of set.list) {
    const top = s.base + s.h + set.offset;
    const bottom = s.base + set.offset;
    // no estorba lo que esta por encima de la cabeza ni bajo los pies
    if (top <= feet + STEP_UP || bottom >= feet + 1.8) continue;

    const hx = s.w / 2 + PLAYER_R;
    const hz = s.d / 2 + PLAYER_R;
    const dx = pos.x - s.x;
    const dz = pos.z - s.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;

    const px = hx - Math.abs(dx);
    const pz = hz - Math.abs(dz);
    if (px < pz) pos.x += Math.sign(dx || 1) * px;
    else pos.z += Math.sign(dz || 1) * pz;
  }
}

/** Altura de lo que se pisa en ese punto: el techo mas alto bajo los pies. */
export function supportAt(set: SolidSet, x: number, z: number, feet: number) {
  let best = 0;
  for (const s of set.list) {
    const top = s.base + s.h + set.offset;
    if (top > feet + STEP_UP) continue;
    if (top <= best) continue;
    if (Math.abs(x - s.x) > s.w / 2 + 0.2) continue;
    if (Math.abs(z - s.z) > s.d / 2 + 0.2) continue;
    best = top;
  }
  return best;
}
