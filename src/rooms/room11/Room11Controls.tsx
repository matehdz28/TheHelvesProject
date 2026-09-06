import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EYE, groundY } from "./layers";
import { vortexAt, COLLAPSE_AT } from "./paper/choreography";

/**
 * Caminar por el diorama. Mismo esquema que el resto del proyecto: el pivot
 * lleva la posicion y el giro horizontal, la camara el cabeceo.
 *
 * Los bastidores no colisionan a proposito: la gracia es atravesarlos y ver
 * que eran laminas.
 *
 * En la sala de hojas el jugador tambien LEVITA. La elevacion automatica va
 * atada al mismo valor de succion que mueve las cartas, asi que se despega a
 * la vez que ellas y en la misma proporcion. Mientras esta en el aire se
 * habilitan Space y Shift para subir y bajar a voluntad; al acabar la cancion
 * se cortan y cae con todo lo demas.
 */
const PITCH_LIMIT = (Math.PI / 2) * 0.95;

export default function Room11Controls({
  camera,
  pivot,
  speed = 6,
  sensitivity = 0.0022,
  /** si esta puesto, recorta la posicion para no salir del pasillo */
  constrain,
  /** la sala de hojas es plana: no usa el relieve del paisaje */
  flatGround = false,
  /** reloj de la cancion; si viene, se habilita la levitacion */
  songTime,
  /** cuanto sube el jugador solo, con la succion a tope */
  autoLiftMax = 9,
  /** metros por segundo de Space / Shift */
  flySpeed = 11,
  /** altura maxima que se puede ganar a mano */
  manualLiftMax = 34,
}: {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D;
  speed?: number;
  sensitivity?: number;
  constrain?: React.MutableRefObject<((p: THREE.Vector3) => void) | null>;
  flatGround?: boolean;
  songTime?: React.MutableRefObject<number>;
  autoLiftMax?: number;
  flySpeed?: number;
  manualLiftMax?: number;
}) {
  const domElement = useThree((s) => s.gl.domElement);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const locked = useRef(false);
  const keys = useRef({ f: false, b: false, l: false, r: false, fast: false, up: false, down: false });

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
        case "shift": keys.current.fast = down; keys.current.down = down; break;
        case " ": keys.current.up = down; break;
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
  const manualLift = useRef(0);

  useFrame((_, dt) => {
    const dts = Math.min(dt, 0.1);
    pivot.rotation.y = yaw.current;
    camera.rotation.set(pitch.current, 0, 0);

    const k = keys.current;
    const step = dts * speed * (k.fast ? 3 : 1);

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
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(step);
      pivot.position.x += move.x;
      pivot.position.z += move.z;
    }

    constrain?.current?.(pivot.position);

    // --- levitacion ---
    let lift = 0;
    let follow = 9;

    if (songTime) {
      const song = songTime.current;
      const v = vortexAt(song);
      const collapsing = song >= COLLAPSE_AT;

      // sube en la misma proporcion que la succion que arrastra las cartas
      const auto = collapsing ? 0 : (Math.min(1, v.lift / 3.4)) * autoLiftMax;
      // Space y Shift solo mientras haya con que sostenerse
      const canFly = !collapsing && v.lift > 0.35;

      if (canFly) {
        if (keys.current.up) manualLift.current += flySpeed * dts;
        if (keys.current.down) manualLift.current -= flySpeed * dts;
        manualLift.current = THREE.MathUtils.clamp(manualLift.current, 0, manualLiftMax);
      } else {
        // al cortarse la cancion cae con las hojas, no planea
        manualLift.current = THREE.MathUtils.damp(manualLift.current, 0, collapsing ? 3.2 : 1.2, dts);
      }

      lift = auto + manualLift.current;
      if (collapsing) follow = 3.4;
    }

    const target = (flatGround ? 0 : groundY(pivot.position.z)) + EYE + lift;
    pivot.position.y = THREE.MathUtils.damp(pivot.position.y, target, follow, dts);
  });

  return null;
}
