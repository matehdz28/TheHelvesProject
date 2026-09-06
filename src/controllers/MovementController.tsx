import React, { useState, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Velocidades y física
const WALK_SPEED = 0.3;
const FLY_SPEED = 0.5;
const GRAVITY = 0.002;
const JUMP_FORCE = 0.05;
const MAX_FALL = 0.2;

// Colisión/jugador
const MIN_CAMERA_HEIGHT = 0.6;   // "ojos" sobre el suelo
const RADIUS = 0.38;             // radio de la cápsula
const DOWN_RAY_MAX = 12.0;       // buscar suelo holgadamente
const MARGIN = 0.02;             // separador mínimo

interface MovementControllerProps {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D;
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
}

export const MovementController: React.FC<MovementControllerProps> = ({
  camera,
  pivot,
  collidableMeshes,
}) => {
  const [keys, setKeys] = useState({ forward:false, backward:false, left:false, right:false, up:false, down:false });
  const [velY, setVelY] = useState(0);
  const grounded = useRef(false);
  const fall = useRef(0);
  const [flying, setFlying] = useState(false);

  // Guarda la última posición "100% segura"
  const lastSafePos = useRef<THREE.Vector3>(new THREE.Vector3());

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w": setKeys(p=>({...p,forward:true})); break;
        case "s": setKeys(p=>({...p,backward:true})); break;
        case "a": setKeys(p=>({...p,left:true})); break;
        case "d": setKeys(p=>({...p,right:true})); break;
        case " ":
          if (flying) setKeys(p=>({...p,up:true}));
          else if (grounded.current) { setVelY(JUMP_FORCE); grounded.current = false; }
          break;
        case "shift": if (flying) setKeys(p=>({...p,down:true})); break;
        case "f": setFlying(v=>!v); break;
      }
    };
    const ku = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w": setKeys(p=>({...p,forward:false})); break;
        case "s": setKeys(p=>({...p,backward:false})); break;
        case "a": setKeys(p=>({...p,left:false})); break;
        case "d": setKeys(p=>({...p,right:false})); break;
        case " ": if (flying) setKeys(p=>({...p,up:false})); break;
        case "shift": if (flying) setKeys(p=>({...p,down:false})); break;
      }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return ()=>{ window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [flying]);

  // Helper: test rápido de interpenetración (si estás demasiado cerca de cualquier triángulo)
  const isPenetrating = (pos: THREE.Vector3, meshes: THREE.Object3D[]) => {
    const dirs = [
      new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0),
      new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1),
      new THREE.Vector3(1,0,1).normalize(),  new THREE.Vector3(-1,0,1).normalize(),
      new THREE.Vector3(1,0,-1).normalize(), new THREE.Vector3(-1,0,-1).normalize(),
    ];
    for (const n of dirs) {
      const ray = new THREE.Raycaster(pos, n, 0, RADIUS - MARGIN);
      const hits = ray.intersectObjects(meshes, false);
      if (hits.length > 0 && hits[0].distance < (RADIUS - MARGIN)) return true;
    }
    return false;
  };

  useFrame(() => {
    const collidables = collidableMeshes.current;
    const pos = pivot.position.clone();

    // Dirección de vista plana
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();

    // Desplazamiento deseado
    const spd = flying ? FLY_SPEED : WALK_SPEED;
    const desired = new THREE.Vector3();
    if (keys.forward)  desired.add(fwd);
    if (keys.backward) desired.add(fwd.clone().multiplyScalar(-1));
    if (keys.left)     desired.add(right.clone().multiplyScalar(-1));
    if (keys.right)    desired.add(right);
    if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(spd);

    // SWEEP horizontal (3 alturas): limitar avance sin atravesar
    if (desired.lengthSq() > 0) {
      const dir = desired.clone().normalize();
      const travel = desired.length() + RADIUS;
      const heights = [MIN_CAMERA_HEIGHT - 0.3, MIN_CAMERA_HEIGHT, MIN_CAMERA_HEIGHT + 0.6];
      let allow = desired.length();

      for (const h of heights) {
        const origin = new THREE.Vector3(pos.x, pos.y + h, pos.z);
        const ray = new THREE.Raycaster(origin, dir, 0, travel);
        const hits = ray.intersectObjects(collidables, false);
        if (hits.length > 0) {
          const safe = Math.max(0, hits[0].distance - RADIUS - MARGIN);
          allow = Math.min(allow, safe);
        }
      }
      if (allow > 0) pos.add(dir.multiplyScalar(allow));
    }

    // Vuelo / Gravedad
    if (flying) {
      if (keys.up)   pos.y += FLY_SPEED;
      if (keys.down) pos.y -= FLY_SPEED;
      setVelY(0); fall.current = 0; grounded.current = false;
    } else {
      if (!grounded.current) {
        fall.current = Math.min(fall.current + GRAVITY, MAX_FALL);
        setVelY(v => v - fall.current);
      } else {
        fall.current = 0;
      }
      if (velY !== 0) pos.y += velY;

      // suelo
      const down = new THREE.Raycaster(pos, new THREE.Vector3(0,-1,0), 0, DOWN_RAY_MAX);
      const gHits = down.intersectObjects(collidables, false);
      if (gHits.length > 0) {
        const hit = gHits[0];
        if (hit.distance <= MIN_CAMERA_HEIGHT + 0.1) {
          grounded.current = true;
          setVelY(0);
          pos.y = hit.point.y + MIN_CAMERA_HEIGHT; // snap estable
        } else {
          grounded.current = false;
        }
      } else {
        grounded.current = false;
      }
    }

    // **No hay push-out**. En su lugar, validación final:
    if (isPenetrating(pos, collidables)) {
      // Si penetró (por numérica/lag), reviértelo al último seguro
      pivot.position.copy(lastSafePos.current);
      return;
    }

    // Llegó aquí: es seguro. Guardar como última segura.
    pivot.position.copy(pos);
    lastSafePos.current.copy(pos);
  });

  return null;
};