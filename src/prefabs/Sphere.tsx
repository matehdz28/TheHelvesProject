import React from "react";

export const Sphere: React.FC<{ color?: string; opacity?: number }> = ({
  color = "#f96b6b",
  opacity = 1,
}) => {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

export default Sphere;