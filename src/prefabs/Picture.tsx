import React, { useMemo } from "react";
import * as THREE from "three";
export const label = "Picture";

export default function Picture({
  position = [0, 1.6, 0],
  rotationY = 0,
  size = [1.6, 1.0],
}: {
  position?: [number, number, number];
  rotationY?: number;
  size?: [number, number];
}) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e6e9ec"; ctx.fillRect(0,0,256,256);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `hsl(${i * 35}, 70%, 55%)`;
      ctx.fillRect(24, 28 + i * 28, 208, 12 + i * 6);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh>
        <boxGeometry args={[size[0]+0.06, size[1]+0.06, 0.06]} />
        <meshStandardMaterial color="#2e2e2e" roughness={0.5}/>
      </mesh>
      <mesh position={[0,0,0.035]}>
        <planeGeometry args={size} />
        <meshStandardMaterial map={tex} />
      </mesh>
    </group>
  );
}