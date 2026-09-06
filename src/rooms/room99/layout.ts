/**
 * Trazado de la nave: naves grandes y pasillos estrechos encadenados a lo
 * largo de -Z.
 *
 * La alternancia importa mas que el tamano total. Un pasillo largo y uniforme
 * se hace eterno porque no hay nada que marque el avance; alternando anchos y
 * alturas, cada umbral es un hito y el recorrido se lee como progreso.
 */
export type Bay = {
  kind: "hall" | "corridor";
  /** largo a lo largo de -Z */
  length: number;
  /** semiancho */
  half: number;
  height: number;
};

export const BAYS: Bay[] = [
  { kind: "hall", length: 70, half: 26, height: 27 },
  { kind: "corridor", length: 40, half: 6, height: 8 },
  { kind: "hall", length: 55, half: 20, height: 20 },
  { kind: "corridor", length: 35, half: 5, height: 7 },
  { kind: "hall", length: 60, half: 24, height: 24 },
  { kind: "corridor", length: 30, half: 7, height: 9 },
  { kind: "hall", length: 50, half: 18, height: 18 },
];

/** z donde arranca el recorrido (detras del jugador) */
export const START_Z = 45;

/** z de entrada y salida de cada tramo, ya acumulados */
export const SPANS = (() => {
  const out: { bay: Bay; from: number; to: number }[] = [];
  let z = START_Z;
  for (const bay of BAYS) {
    out.push({ bay, from: z, to: z - bay.length });
    z -= bay.length;
  }
  return out;
})();

export const END_Z = SPANS[SPANS.length - 1].to;
export const TOTAL_LENGTH = START_Z - END_Z;

/**
 * Semiancho utilizable en una z dada. Lo usa el control para que el jugador no
 * atraviese los muros: sin esto, en cuanto un tramo se estrecha se saldria.
 */
export function halfWidthAt(z: number) {
  for (const s of SPANS) {
    if (z <= s.from && z >= s.to) return s.bay.half;
  }
  return SPANS[0].bay.half;
}

export function heightAt(z: number) {
  for (const s of SPANS) {
    if (z <= s.from && z >= s.to) return s.bay.height;
  }
  return SPANS[0].bay.height;
}

/** generador con semilla: el decorado es el mismo en cada carga */
export function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** z a partir del cual se considera que estas en el ultimo cuarto */
export const LAST_BAY_Z = SPANS[SPANS.length - 1].from;
