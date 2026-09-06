import React from "react";

export const Cube: React.FC<{ color?: string; opacity?: number }> = ({
  color = "#4e91f9",
  opacity = 1,
}) => {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
};

export default Cube;