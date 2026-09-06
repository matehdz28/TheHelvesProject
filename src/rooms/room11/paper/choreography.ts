/**
 * Coreografia de las cartas, en tiempo DE LA CANCION (no desde que entras).
 *
 *   0:13  entras; las hojas siguen quietas, solo reaccionan al paso
 *   0:28  empiezan a juntarse, muy poco a poco
 *   0:59  orbitan un cilindro invisible y ganan altura
 *   1:40  tornado formado
 *   2:00  empieza a acelerar, cada vez mas
 *   3:30  se rompe el orden del tornado y las hojas se sueltan
 *   4:49  fin de la cancion: todo se corta EN SECO y cae
 *
 * Entre hito e hito los valores se interpolan, asi que no hay ningun salto:
 * cada fase crece desde la anterior. El tornado se va formando entre 1:25 y
 * 1:40 para que en el 1:40 ya SEA un tornado, no para que empiece a serlo.
 */
export type Vortex = {
  /** atraccion hacia el eje central */
  gather: number;
  /** velocidad de giro alrededor del eje */
  spin: number;
  /** empuje hacia arriba */
  lift: number;
  /** cuanto se abre el embudo con la altura */
  flare: number;
  /** radio del nucleo a ras de suelo */
  core: number;
  /** 0 = obedecen al tornado, 1 = van por libre */
  chaos: number;
  /** fuerza del movimiento libre, cada hoja por su cuenta */
  free: number;
};

type Key = Vortex & { at: number };

/**
 * Fin de la pista (dura 4:49). Aqui el vortice no se desvanece: se apaga de
 * golpe, para que el desplome se sienta como un corte y no como una bajada.
 */
export const COLLAPSE_AT = 288.5;

export const KEYS: Key[] = [
  { at: 13, gather: 0, spin: 0, lift: 0, flare: 0, core: 0, chaos: 0, free: 0 },
  { at: 28, gather: 0, spin: 0, lift: 0, flare: 0, core: 0, chaos: 0, free: 0 },
  { at: 59, gather: 0.07, spin: 0.12, lift: 0.06, flare: 0.25, core: 14, chaos: 0, free: 0 },
  { at: 85, gather: 0.17, spin: 0.95, lift: 0.8, flare: 0.7, core: 7, chaos: 0, free: 0 },
  // tornado formado
  { at: 100, gather: 0.5, spin: 4.3, lift: 3.4, flare: 0.95, core: 2.6, chaos: 0, free: 0 },
  // se mantiene hasta el 2:00 y de ahi acelera sin parar
  { at: 120, gather: 0.5, spin: 4.3, lift: 3.4, flare: 0.95, core: 2.6, chaos: 0, free: 0 },
  { at: 165, gather: 0.56, spin: 6.6, lift: 3.8, flare: 0.94, core: 2.4, chaos: 0, free: 0 },
  // 3:30: el tornado esta en su punto mas rapido, justo antes de soltarse
  { at: 210, gather: 0.62, spin: 9.8, lift: 4.2, flare: 0.92, core: 2.2, chaos: 0, free: 0 },
  // y en quince segundos pierde el orden: cada hoja por su cuenta
  { at: 225, gather: 0.08, spin: 1.6, lift: 3.9, flare: 0.9, core: 7, chaos: 1, free: 9.5 },
  { at: 288, gather: 0.0, spin: 0.5, lift: 3.6, flare: 0.9, core: 11, chaos: 1, free: 11.5 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const ZERO: Vortex = { gather: 0, spin: 0, lift: 0, flare: 0, core: 0, chaos: 0, free: 0 };

export function vortexAt(songTime: number): Vortex {
  // al acabar la pista el vortice desaparece de un frame al siguiente
  if (songTime >= COLLAPSE_AT) return ZERO;
  if (songTime <= KEYS[0].at) return KEYS[0];
  const last = KEYS[KEYS.length - 1];
  if (songTime >= last.at) return last;

  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (songTime <= b.at) {
      const t = (songTime - a.at) / (b.at - a.at);
      // suavizado en los extremos: los cambios de fase no se notan como codo
      const s = t * t * (3 - 2 * t);
      return {
        gather: lerp(a.gather, b.gather, s),
        spin: lerp(a.spin, b.spin, s),
        lift: lerp(a.lift, b.lift, s),
        flare: lerp(a.flare, b.flare, s),
        core: lerp(a.core, b.core, s),
        chaos: lerp(a.chaos, b.chaos, s),
        free: lerp(a.free, b.free, s),
      };
    }
  }
  return last;
}
