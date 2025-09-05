import React, { useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Configuración
const SPEED = 0.15;
const FLY_SPEED = 0.1; // Velocidad extra cuando se está volando
const GRAVITY = 0.002; 
const JUMP_FORCE = 0.05; 
const MIN_CAMERA_HEIGHT = 0.6;
const COLLISION_DISTANCE = 0.55;
const TOLERANCE = 0.02;
const DAMPING = 0.85; 
const GROUND_THRESHOLD = 0.1; 

interface MovementControllerProps {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D; 
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
}

export const MovementController: React.FC<MovementControllerProps> = ({ camera, pivot, collidableMeshes }) => {
  const [movement, setMovement] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const [velocityY, setVelocityY] = useState(0);
  const isGrounded = useRef(false);
  const fallSpeed = useRef(0);

  const [isFlying, setIsFlying] = useState(false); // 🔥 Variable que controla si se puede volar o no

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w': setMovement(prev => ({ ...prev, forward: true })); break;
        case 's': setMovement(prev => ({ ...prev, backward: true })); break;
        case 'a': setMovement(prev => ({ ...prev, left: true })); break;
        case 'd': setMovement(prev => ({ ...prev, right: true })); break;
        case ' ': 
          if (isGrounded.current && !isFlying) { 
            setVelocityY(JUMP_FORCE);
            isGrounded.current = false;
          }
          if (isFlying) {
            setMovement(prev => ({ ...prev, up: true }));
          }
          break;
        case 'shift': 
          if (isFlying) {
            setMovement(prev => ({ ...prev, down: true }));
          }
          break;
        case 'f': // 🔥 Presiona 'F' para activar/desactivar el modo vuelo
          setIsFlying(prev => !prev);
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w': setMovement(prev => ({ ...prev, forward: false })); break;
        case 's': setMovement(prev => ({ ...prev, backward: false })); break;
        case 'a': setMovement(prev => ({ ...prev, left: false })); break;
        case 'd': setMovement(prev => ({ ...prev, right: false })); break;
        case ' ': 
          if (isFlying) setMovement(prev => ({ ...prev, up: false }));
          break;
        case 'shift': 
          if (isFlying) setMovement(prev => ({ ...prev, down: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFlying]);

  useFrame(() => {
    const horizontalVelocity = new THREE.Vector3();
    const newPosition = pivot.position.clone();

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(direction, camera.up).normalize();

    const speed = isFlying ? FLY_SPEED : SPEED;

    // Crear rayos para cada dirección
    const forwardRay = new THREE.Raycaster(newPosition, direction, 0, COLLISION_DISTANCE);
    const backwardRay = new THREE.Raycaster(newPosition, direction.clone().negate(), 0, COLLISION_DISTANCE);
    const leftRay = new THREE.Raycaster(newPosition, right.clone().negate(), 0, COLLISION_DISTANCE);
    const rightRay = new THREE.Raycaster(newPosition, right, 0, COLLISION_DISTANCE);

    const forwardCollisions = forwardRay.intersectObjects(collidableMeshes.current);
    const backwardCollisions = backwardRay.intersectObjects(collidableMeshes.current);
    const leftCollisions = leftRay.intersectObjects(collidableMeshes.current);
    const rightCollisions = rightRay.intersectObjects(collidableMeshes.current);

    if (movement.forward && forwardCollisions.length === 0) horizontalVelocity.add(direction.multiplyScalar(speed));
    if (movement.backward && backwardCollisions.length === 0) horizontalVelocity.add(direction.multiplyScalar(-speed));
    if (movement.left && leftCollisions.length === 0) horizontalVelocity.add(right.multiplyScalar(-speed));
    if (movement.right && rightCollisions.length === 0) horizontalVelocity.add(right.multiplyScalar(speed));

    horizontalVelocity.y = 0;
    newPosition.add(horizontalVelocity);

    if (isFlying) {
      if (movement.up) newPosition.y += FLY_SPEED;
      if (movement.down) newPosition.y -= FLY_SPEED;
      setVelocityY(0);
    } else {
      if (!isGrounded.current) {
        fallSpeed.current += GRAVITY;
        setVelocityY(prev => prev - fallSpeed.current);
      } else {
        fallSpeed.current = 0;
      }

      newPosition.y += velocityY;

      // Detectar colisión con el suelo
      const downRay = new THREE.Raycaster(pivot.position, new THREE.Vector3(0, -1, 0), 0, COLLISION_DISTANCE);
      const downIntersects = downRay.intersectObjects(collidableMeshes.current);

      if (downIntersects.length > 0) {
        const distance = downIntersects[0].distance;

        if (distance < COLLISION_DISTANCE - TOLERANCE) {
          isGrounded.current = true;

          if (distance <= GROUND_THRESHOLD) {
            setVelocityY(0);
            newPosition.y = THREE.MathUtils.lerp(newPosition.y, downIntersects[0].point.y + MIN_CAMERA_HEIGHT, DAMPING);
          }
        } else {
          isGrounded.current = false;
        }
      } else {
        isGrounded.current = false;
      }
    }

    pivot.position.copy(newPosition);
});


  return null;
};
