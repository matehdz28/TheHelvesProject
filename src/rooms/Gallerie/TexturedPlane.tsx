import React, { useRef, useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface TexturedPlaneProps {
  texturePath: string; // Ruta de la textura (por ejemplo: "/pasto-textura.jpg")
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  size?: [number, number]; // Tamaño del plano (Por defecto [100, 100])
  repeat?: [number, number]; // Repetición de la textura
}

export const TexturedPlane: React.FC<TexturedPlaneProps> = ({
  texturePath,
  position = [0, -0.1, 0],
  rotation = [-Math.PI / 2, 0, 0],
  scale = [1, 1, 1],
  size = [100, 100],
  repeat = [10, 10],
}) => {
  const texture = useLoader(THREE.TextureLoader, texturePath);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);

  return (
    <mesh position={position} rotation={rotation} scale={scale} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};
