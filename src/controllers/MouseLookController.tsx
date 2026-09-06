import React, { useEffect } from 'react';
import * as THREE from 'three';

const LOOK_SENSITIVITY = 0.0025;
const MAX_LOOK_DOWN = -Math.PI / 2;  // Mirar hacia abajo completamente
const MAX_LOOK_UP = Math.PI / 2;     // Mirar hacia arriba completamente

interface MouseLookControllerProps {
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Object3D; // Ahora recibimos el pivot
}

export const MouseLookController: React.FC<MouseLookControllerProps> = ({ camera, pivot }) => {

  useEffect(() => {
    let pitch = 0;  // Vertical movement
    let yaw = 0;    // Horizontal movement

    const handleMouseMove = (event: MouseEvent) => {
      if (!document.pointerLockElement) return;

      yaw -= event.movementX * LOOK_SENSITIVITY;
      pitch -= event.movementY * LOOK_SENSITIVITY;

      // Limitar la rotación hacia arriba y abajo
      pitch = Math.max(MAX_LOOK_DOWN, Math.min(MAX_LOOK_UP, pitch));

      // Rotar el pivot sobre su propio eje Y (horizontal)
      pivot.rotation.y = yaw;

      // Rotar la cámara sobre su propio eje X (vertical)
      camera.rotation.x = pitch;
      camera.rotation.z = 0;  // Esto asegura que no se incline en diagonal
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [camera, pivot]);

  return null;
};