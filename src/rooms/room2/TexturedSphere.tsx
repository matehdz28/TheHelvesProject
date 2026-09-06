// TexturedSphere.tsx
import React from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";

type Props = {
  src: string;                // ruta a la imagen (en /public o URL)
  radius?: number;            // radio de la esfera
  segments?: number;          // detalle de la esfera
  position?: [number, number, number];
  unlit?: boolean;            // true = no necesita luces (MeshBasicMaterial)
};

export const TexturedSphere: React.FC<Props> = ({
  src,
  radius = 3,
  segments = 7,
  position = [0, 3, -6],
  unlit = false,
}) => {
  const tex = useTexture(src);

  // ajustes de calidad/color
  tex.colorSpace = THREE.SRGBColorSpace;  // importante para que no se lave
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; // o RepeatWrapping si quieres repetir

  return (
    <mesh position={position} castShadow receiveShadow>
      <sphereGeometry args={[radius, segments, segments]} />
      {unlit ? (
        <meshBasicMaterial map={tex} />
      ) : (
        <meshStandardMaterial map={tex} roughness={0.5} metalness={0.05} />
      )}
    </mesh>
  );
};