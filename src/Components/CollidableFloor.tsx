import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";

const Concrete = ({ color = "#dfe3e6", ...p }: any) => (
  <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} {...p} />
);

export default function CollidableFloor({
  collidableMeshes,
  size = 200,
  y = 0,
  reflective = false,
  color = "#dfe3e6",
  unlit = false,             
  receiveShadow = false,     
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  size?: number;
  y?: number;
  reflective?: boolean;
  color?: string;
  unlit?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
    return () => {
      if (!ref.current) return;
      const i = collidableMeshes.current.indexOf(ref.current);
      if (i >= 0) collidableMeshes.current.splice(i, 1);
    };
  }, [collidableMeshes]);

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      receiveShadow={receiveShadow && !unlit} // si unlit, no recibas sombras
      frustumCulled
    >
      <planeGeometry args={[size, size]} />
      {unlit ? (
        <meshBasicMaterial color={color} /> 
      ) : reflective ? (
        <MeshReflectorMaterial
          color={color}
          roughness={0.7}
          metalness={0.05}
          mirror={0.1}
          mixStrength={0.2}
          blur={[120, 20]}
          resolution={512}
        />
      ) : (
        <Concrete color={color} />
      )}
    </mesh>
  );
}