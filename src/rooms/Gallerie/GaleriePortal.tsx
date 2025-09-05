import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface WhiteCubeProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  collidableMeshes?: React.MutableRefObject<THREE.Mesh[]>;
}

export const WhiteCube: React.FC<WhiteCubeProps> = ({
  position = [0, 0, 0],
  scale = [10, 10, 10],
  collidableMeshes,
}) => {
  const cubeRef = useRef<THREE.Mesh>(null!);
  const doorRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);

  useEffect(() => {
    if (collidableMeshes && cubeRef.current) {
      collidableMeshes.current.push(cubeRef.current);
    }
  }, [collidableMeshes]);

  useFrame(() => {
    if (lightRef.current) {
      // Puedes hacer que la luz parpadee o cambie de intensidad si deseas
      lightRef.current.intensity = 10; // Intensidad muy alta
    }
  });

  return (
    <group position={position}>
      {/* Cubo Blanco */}
      <mesh ref={cubeRef} scale={scale} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c53723" />
      </mesh>

      {/* Puerta Negra */}
      <mesh
        ref={doorRef}
        position={[0, -0.25, 0.51]} // Desplazada para que se vea enfrente
        scale={[0.2, 0.4, 0.01]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Luz Potente */}
      <pointLight 
        ref={lightRef} 
        position={[0, 0, 0]} 
        intensity={50} // Puedes ajustar la intensidad para hacerlo más brillante
        distance={200} // Hasta dónde alcanza la luz
        decay={2} // Cómo se atenúa la luz a medida que se aleja
        color="#ffffff"
        castShadow
      />
    </group>
  );
};
