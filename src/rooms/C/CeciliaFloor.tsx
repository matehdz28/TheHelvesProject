import React, { useRef, useEffect } from "react";
import * as THREE from "three";

interface FloorProps {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  position?: [number, number, number];
  size?: [number, number, number];
}

export const CeciliaFloor: React.FC<FloorProps> = ({
  collidableMeshes,
  position = [0, -0.01, 0], // Un poquito debajo para evitar clipping
  size = [200, 0.1, 200],   // Grosor pequeño
}) => {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} position={position} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="white" />
    </mesh>
  );
};
