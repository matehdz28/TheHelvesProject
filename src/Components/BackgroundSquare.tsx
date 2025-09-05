import React from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface BackgroundSquareProps {
  texturePath: string;
  position?: [number, number, number];
  size?: [number, number];
  opacity?: number;
}

export const BackgroundSquare: React.FC<BackgroundSquareProps> = ({
  texturePath,
  position = [0, 0, 0],
  size = [1, 1],
  opacity = 1,
}) => {
  const texture = useLoader(THREE.TextureLoader, texturePath);

  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={opacity}
        alphaTest={0.5} // clave para quitar negro
      />
    </mesh>
  );
};
