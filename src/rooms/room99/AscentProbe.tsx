import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAIR } from "./Stairs";
import { EYE } from "./Room99Controls";

/**
 * Traduce la altura del jugador a volumen de la pista de la subida.
 *
 * Va dentro del lienzo porque necesita leer la posicion cada fotograma; el
 * audio vive fuera y solo recibe un numero entre 0 y 1 por referencia, sin
 * provocar renders.
 */
export default function AscentProbe({
  pivot,
  level,
  night,
  playFull,
  onTop,
}: {
  pivot: THREE.Object3D;
  level: React.MutableRefObject<number>;
  /**
   * Por REFERENCIA, no como funcion suelta: el audio la rellena en su efecto,
   * que corre despues de este render. Pasando su valor se congelaria la
   * version vacia de antes de cargar, y al coronar no sonaria nada.
   */
  playFull: React.MutableRefObject<() => void>;
  /** el mismo avance, para apagar el dia */
  night: React.MutableRefObject<number>;
  /** una sola vez, al coronar */
  onTop: () => void;
}) {
  const told = useRef(false);

  useFrame(() => {
    const feet = pivot.position.y - EYE;
    const climb = THREE.MathUtils.clamp(
      (feet - STAIR.fromY) / (STAIR.toY - STAIR.fromY),
      0,
      1
    );
    level.current = climb;
    night.current = climb;
    // el ultimo rellano, no la cota exacta: se corona pisandolo, y ahi la
    // altura ya no sube mas
    if (feet >= STAIR.toY - 3) {
      // sin guarda de una sola vez a proposito: playFull se protege sola, y
      // repetirla arregla el caso de coronar antes de que el audio cargue
      playFull.current();
      if (!told.current) {
        told.current = true;
        onTop();
      }
    }
  });

  return null;
}
