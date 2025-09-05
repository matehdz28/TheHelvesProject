// src/components/Sun.tsx
import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SunProps {
  position?: [number, number, number];
  intensity?: number;
  color?: string;
  castShadow?: boolean;
}

export const Sun: React.FC<SunProps> = ({
  position = [20, 50, 20], // Posición predeterminada
  intensity = 1.5,
  color = "#ffffff",
  castShadow = true,
}) => {
  const sunRef = useRef<THREE.DirectionalLight>(null!);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.position.set(...position);
      sunRef.current.target.position.set(0, 0, 0);
      sunRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        position={position}
        intensity={intensity}
        castShadow={castShadow}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        color={color}
      />
    </>
  );
};
