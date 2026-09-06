import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { getTerrain, RIDE_HEIGHT, CEILING_SLOT } from "./terrainData";
import type { Phase } from "./timeline";

/**
 * Vuelo libre sobre el terreno, estilo FPS.
 *
 * NO usa FirstPersonControls: ese lee la posicion absoluta del cursor
 * (pageX/pageY), lo que obliga a tener el puntero visible y suelto, y ademas
 * hace que la camara gire sola salvo que el mouse este exacto en el centro.
 * Aca va con pointer lock y deltas relativos (movementX/movementY), igual que
 * el MouseLookController del proyecto: el cursor queda oculto y capturado, y
 * la camara solo gira cuando movés el mouse.
 *
 * Reparto de la rotacion, como en el resto del proyecto:
 *   pivot.rotation.y = yaw   (y pivot.position = posicion del jugador)
 *   camera.rotation.x = pitch
 *
 * Avanza SOLO, a velocidad constante. Por eso la W no esta mapeada.
 * El avance va sobre la direccion de vista APLANADA, no sobre el vector con
 * inclinacion: si siguiera el cabeceo, mirar hacia abajo te clavaria contra
 * el suelo y mirar arriba contra el techo, y el mouse es lo unico con lo que
 * se dirige. Asi el crucero se mantiene nivelado y el mouse solo apunta.
 *
 * La altura NO se controla: se va siempre pegado al terreno, a RIDE_HEIGHT
 * sobre el. Si el suelo cae, se cae con el. Por eso no hay Space ni Shift.
 *
 * En la fase azul el paso se acelera y la camara empieza a rodar despacio
 * sobre su propio eje de vista. El roll va en camera.rotation.z, que con el
 * orden de Euler por defecto (XYZ) NO altera la direccion de vista: la
 * trayectoria sigue igual y solo se inclina el horizonte. El desplazamiento
 * lateral tampoco cambia, porque se calcula contra camera.up, que es una
 * propiedad del objeto y no se rota.
 *
 * Controles: mouse dirige, A/D desplaza al lado, S invierte el avance.
 */
const PITCH_LIMIT = Math.PI / 2 * 0.95;
const TAU = Math.PI * 2;

export default function TerrainControls({
  camera,
  pivot,
  phase,
  speed = 150,
  /** velocidad tras el corte azul */
  blueSpeed = 205,
  /** velocidad de rotacion sobre el eje de vista en la fase azul, rad/s */
  blueRoll = 0.12,
  sensitivity = 0.0022,
  /** altura constante a la que se vuela sobre el terreno */
  rideHeight = RIDE_HEIGHT,
  /** que tan pegado se sigue el relieve: mas alto = mas clavado */
  follow = 5,
  /** metros por segundo que se gana con SPACE */
  riseSpeed = 130,
  /** que tan rapido se planea de vuelta al soltar: mas bajo = mas suave */
  sink = 0.55,
  /** holgura minima con el techo */
  ceilingClearance = 35,
}: {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D;
  phase: Phase;
  speed?: number;
  blueSpeed?: number;
  blueRoll?: number;
  sensitivity?: number;
  rideHeight?: number;
  follow?: number;
  riseSpeed?: number;
  sink?: number;
  ceilingClearance?: number;
}) {
  const domElement = useThree((s) => s.gl.domElement);
  const { heightAt } = getTerrain();

  const yaw = useRef(0);
  const pitch = useRef(0);
  const lift = useRef(0);
  const roll = useRef(0);
  const rollRate = useRef(0);
  const cruise = useRef(speed);
  const locked = useRef(false);
  const keys = useRef({ b: false, l: false, r: false, up: false });

  useEffect(() => {
    // Reexpresamos la pose de mundo que traia la camara como pivot(yaw) +
    // camara(pitch), asi el cambio de control no da un salto: seguis donde
    // estabas y mirando a donde mirabas.
    const worldPos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(worldPos);
    camera.getWorldDirection(dir);

    // con forward = (-cos(p)sin(y), sin(p), -cos(p)cos(y))
    pitch.current = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    yaw.current = Math.atan2(-dir.x, -dir.z);

    pivot.position.copy(worldPos);
    pivot.rotation.set(0, yaw.current, 0);
    camera.position.set(0, 0, 0);
    camera.rotation.set(pitch.current, 0, 0);
    pivot.updateMatrixWorld(true);

    // El puntero YA viene capturado desde el mundo A. Lo trasladamos a este
    // canvas en vez de soltarlo, asi no hace falta ni ESC ni volver a hacer
    // click: el cursor sigue oculto y la mirada nunca se corta.
    const grab = () => {
      if (document.pointerLockElement === domElement) return;
      try {
        const r = domElement.requestPointerLock() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === "function") r.catch(() => {});
      } catch {
        /* hara falta un click; lo cubre el listener de abajo */
      }
    };
    grab();

    const onLockChange = () => {
      locked.current = document.pointerLockElement === domElement;
    };
    const onMouseMove = (e: MouseEvent) => {
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
        // sin "w": el vuelo es automatico
        // sin space/shift: la altura la manda el terreno
        case "s": keys.current.b = down; break;
        case "a": keys.current.l = down; break;
        case "d": keys.current.r = down; break;
        case " ": keys.current.up = down; break;
        default: return;
      }
      e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => set(e, true);
    const ku = (e: KeyboardEvent) => set(e, false);

    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("mousemove", onMouseMove);
    // si el navegador rechazo la captura automatica, un click la recupera
    domElement.addEventListener("mousedown", grab);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    onLockChange();

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      domElement.removeEventListener("mousedown", grab);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      if (document.pointerLockElement === domElement) document.exitPointerLock();
    };
  }, [camera, pivot, domElement, sensitivity]);

  const fwd = useRef(new THREE.Vector3()).current;
  const right = useRef(new THREE.Vector3()).current;
  const move = useRef(new THREE.Vector3()).current;

  useFrame((_, dt) => {
    const k = keys.current;
    const dts = Math.min(dt, 0.1);

    // el paso y el balanceo entran progresivamente: un salto seco en el corte
    // azul se sentiria como un tiron
    const targetSpeed = phase === "blue" ? blueSpeed : speed;
    cruise.current = THREE.MathUtils.damp(cruise.current, targetSpeed, 1.2, dts);
    rollRate.current = THREE.MathUtils.damp(
      rollRate.current,
      phase === "blue" ? blueRoll : 0,
      1.2,
      dts
    );
    roll.current = (roll.current + rollRate.current * dts) % TAU;

    pivot.rotation.y = yaw.current;
    camera.rotation.set(pitch.current, 0, roll.current);

    const step = dts * cruise.current;

    // direccion de vista APLANADA: el crucero no cabecea con la mirada
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    // avance automatico; la S lo invierte
    move.copy(fwd);
    if (k.b) move.negate();
    if (k.r) move.add(right);
    if (k.l) move.sub(right);

    if (move.lengthSq() > 0) move.normalize().multiplyScalar(step);
    move.y = 0; // la altura no se navega, la dicta el terreno
    pivot.position.add(move);

    // sin topes de borde: el terreno se tesela infinito

    // SPACE gana altura; al soltar, se planea de vuelta al crucero
    const maxLift = CEILING_SLOT - rideHeight - ceilingClearance;
    if (k.up) {
      lift.current = Math.min(maxLift, lift.current + riseSpeed * dts);
    } else {
      lift.current = THREE.MathUtils.damp(lift.current, 0, sink, dts);
    }

    // pegado al terreno: si el suelo cae, se cae con el. El amortiguado evita
    // tirones en las crestas sin despegarse.
    const ground = heightAt(pivot.position.x, pivot.position.z);
    const target = ground + rideHeight + lift.current;
    pivot.position.y = THREE.MathUtils.damp(pivot.position.y, target, follow, dts);

    // por si el relieve sube de golpe bajo una camara ya elevada
    const ceiling = ground + CEILING_SLOT - ceilingClearance;
    if (pivot.position.y > ceiling) pivot.position.y = ceiling;
  });

  return null;
}
