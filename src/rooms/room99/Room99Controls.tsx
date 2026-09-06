import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { halfWidthAt, START_Z, END_Z } from "./layout";
import { resolveXZ, supportAt, type SolidSet } from "./solids";
import { PLATFORM, type ElevatorState } from "./Elevator";

/**
 * Caminar por la nave. Mismo esquema que el resto del proyecto: el pivot
 * lleva posicion y giro horizontal, la camara el cabeceo, y la mirada va por
 * pointer lock con deltas relativos.
 */
const PITCH_LIMIT = (Math.PI / 2) * 0.95;
export const EYE = 1.7;
/** desnivel maximo que se baja andando: la tabica es 0.60 y el bordillo 0.45 */
const MAX_DROP = 2.5;

export default function Room99Controls({
  camera,
  pivot,
  speed = 5.5,
  sensitivity = 0.0022,
  /** en la sala blanca no hay pasillos que respetar */
  freeRoam = false,
  /** cuerpos de la maqueta; si viene, se choca y se anda por encima */
  solids,
  elevator,
  frozen = false,
  lift,
}: {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D;
  speed?: number;
  sensitivity?: number;
  freeRoam?: boolean;
  solids?: React.MutableRefObject<SolidSet | null>;
  elevator?: React.MutableRefObject<ElevatorState>;
  /** clavado en el sitio, pero pudiendo mirar */
  frozen?: boolean;
  /** metros por encima del suelo: al final ya no se pisa nada */
  lift?: React.MutableRefObject<number>;
}) {
  const domElement = useThree((s) => s.gl.domElement);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const locked = useRef(false);
  /** fase del bamboleo al andar, avanzada por distancia y no por tiempo */
  const bob = useRef(0);
  /**
   * Lo que se pisaba el fotograma anterior. Es la referencia del veto de
   * caida: sin ella no hay forma de distinguir bajar un escalon de saltar al
   * vacio, porque los dos son "el suelo esta mas abajo".
   */
  const lastGround = useRef<number | null>(null);
  const keys = useRef({ f: false, b: false, l: false, r: false, fast: false });

  useEffect(() => {
    const grab = () => {
      if (document.pointerLockElement === domElement) return;
      try {
        const r = domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === "function") r.catch(() => {});
      } catch {
        /* hara falta otro click */
      }
    };
    const onLock = () => {
      locked.current = document.pointerLockElement === domElement;
    };
    const onMove = (e: MouseEvent) => {
      if (!locked.current) return;
      yaw.current -= e.movementX * sensitivity;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * sensitivity,
        -PITCH_LIMIT,
        PITCH_LIMIT
      );
    };
    const set = (e: KeyboardEvent, down: boolean) => {
      switch (e.key.toLowerCase()) {
        case "w": keys.current.f = down; break;
        case "s": keys.current.b = down; break;
        case "a": keys.current.l = down; break;
        case "d": keys.current.r = down; break;
        case "shift": keys.current.fast = down; break;
        default: return;
      }
      e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => set(e, true);
    const ku = (e: KeyboardEvent) => set(e, false);

    domElement.addEventListener("mousedown", grab);
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    return () => {
      domElement.removeEventListener("mousedown", grab);
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      if (document.pointerLockElement === domElement) document.exitPointerLock();
    };
  }, [domElement, sensitivity]);

  const fwd = useRef(new THREE.Vector3()).current;
  const right = useRef(new THREE.Vector3()).current;
  const move = useRef(new THREE.Vector3()).current;

  useFrame((_, dt) => {
    const dts = Math.min(dt, 0.1);
    pivot.rotation.y = yaw.current;
    camera.rotation.set(pitch.current, 0, 0);

    // Quieto viendo crecer la torre. Se congela el AVANCE, no la mirada: sin
    // poder girar la cabeza no se puede seguir el edificio hacia arriba, que
    // es justo lo que hay que mirar. La altura se toma de la plataforma, asi
    // que si arranca durante la espera, sube con ella.
    if (frozen) {
      const y = elevator?.current.y ?? 0;
      pivot.position.y = y + EYE;
      // la plataforma es el suelo de referencia mientras sube, o al soltarlo
      // el primer paso contaria como una caida de trescientos metros
      lastGround.current = y;
      return;
    }

    const k = keys.current;
    const step = dts * speed * (k.fast ? 2.6 : 1);

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    move.set(0, 0, 0);
    if (k.f) move.add(fwd);
    if (k.b) move.sub(fwd);
    if (k.r) move.add(right);
    if (k.l) move.sub(right);
    const fromX = pivot.position.x;
    const fromZ = pivot.position.z;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(step);
      pivot.position.x += move.x;
      pivot.position.z += move.z;
      // atado a la distancia recorrida, no al reloj: asi el paso no se acelera
      // al correr ni sigue meciendose cuando te paras
      bob.current += step * 1.9;
    }
    camera.position.y = Math.sin(bob.current) * 0.045;

    if (freeRoam) {
      // explanada abierta: solo un tope amplio para no perderse
      pivot.position.x = THREE.MathUtils.clamp(pivot.position.x, -320, 320);
      pivot.position.z = THREE.MathUtils.clamp(pivot.position.z, -320, 320);

      const set = solids?.current;
      if (set) {
        const feet = pivot.position.y - EYE;
        resolveXZ(set, pivot.position, feet);

        // el suelo es lo mas alto que haya bajo los pies: terreno, azotea o
        // la plataforma del ascensor
        let ground = supportAt(set, pivot.position.x, pivot.position.z, feet);

        const el = elevator?.current;
        if (
          el &&
          Math.abs(pivot.position.x - PLATFORM.x) < PLATFORM.w / 2 &&
          Math.abs(pivot.position.z - PLATFORM.z) < PLATFORM.d / 2 &&
          el.y <= feet + 1.8
        ) {
          ground = Math.max(ground, el.y);
        }

        // Subir tambien va amortiguado, no de golpe. Con el salto instantaneo
        // cada peldano es un tiron seco, y una escalera de trescientos se ve a
        // trompicones; suavizarlo la convierte en una subida.
        //
        // Sube MUCHO mas rapido de lo que baja: al subir hay que pegarse al
        // escalon, al caer el retardo se lee como peso. Y el retraso que deja
        // (unos 12 cm al ritmo de subida) queda muy por debajo del margen que
        // tiene la colision antes de que un peldano empiece a estorbar.
        // Levitar se suma AL SUELO, no lo sustituye: asi el jugador sigue
        // subiendo y bajando con lo que tenga debajo mientras flota, y no se
        // queda enganchado a una altura absoluta al pasar sobre un pretil.
        // VETO DE CAIDA. Al edificio no se le ponen barandillas una por una:
        // son decenas de cantos entre azoteas, rellanos, puentes, peldanos y
        // los huecos entre carriles de la escalera, y basta olvidar uno para
        // que se pueda caer desde quinientos metros.
        //
        // En vez de eso, si el paso que acabas de dar te deja sobre un desnivel
        // mayor del que se baja andando, ese paso NO ocurre. Cubre cualquier
        // borde, incluidos los que aparezcan al mover geometria despues.
        //
        // El limite tiene que dejar pasar lo que si es andar: la tabica de la
        // escalera es de 0.60 m y el bordillo de la calzada de 0.45.
        const prev = lastGround.current;
        if (prev !== null && prev - ground > MAX_DROP) {
          pivot.position.x = fromX;
          pivot.position.z = fromZ;
          ground = supportAt(set, fromX, fromZ, feet);
          const el2 = elevator?.current;
          if (
            el2 &&
            Math.abs(fromX - PLATFORM.x) < PLATFORM.w / 2 &&
            Math.abs(fromZ - PLATFORM.z) < PLATFORM.d / 2 &&
            el2.y <= feet + 1.8
          ) {
            ground = Math.max(ground, el2.y);
          }
        }
        lastGround.current = ground;

        const up = lift?.current ?? 0;
        const target = ground + EYE + up;
        pivot.position.y = THREE.MathUtils.damp(
          pivot.position.y,
          target,
          target > pivot.position.y ? (up > 0.5 ? 2.2 : 16) : up > 0.5 ? 2.2 : 7,
          dts
        );
        return;
      }
    } else {
      // El limite lateral lo dicta el TRAMO en el que estas. Con un tope fijo,
      // en cuanto el recorrido se estrecha te saldrias por los muros.
      pivot.position.z = THREE.MathUtils.clamp(pivot.position.z, END_Z + 3, START_Z - 3);
      const lim = halfWidthAt(pivot.position.z) - 1.6;
      pivot.position.x = THREE.MathUtils.clamp(pivot.position.x, -lim, lim);
    }
    pivot.position.y = EYE;
  });

  return null;
}
