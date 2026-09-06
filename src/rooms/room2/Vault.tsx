// src/components/Vault.tsx
import React, { useRef, useEffect } from "react";
import * as THREE from "three";

type Props = {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  radius?: number;
  length?: number;
  y?: number;
};

export const Vault: React.FC<Props> = ({ collidableMeshes, radius=7, length=30, y=3.5 }) => {
  const ref = useRef<THREE.Mesh>(null!);
  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
      {/* un cilindro tumbado y escalado puede sugerir una bóveda continua */}
      <cylinderGeometry args={[radius, radius, length, 32, 1, true]} />
      <meshStandardMaterial color={0xdfe2e4} roughness={0.9} metalness={0} side={THREE.BackSide} />
    </mesh>
  );
};