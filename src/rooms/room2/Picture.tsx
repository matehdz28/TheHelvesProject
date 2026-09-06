// src/components/Picture.tsx
import React from "react";
import * as THREE from "three";

export const Picture: React.FC<{
  position: [number, number, number];
  size?: [number, number];
  seed?: number;
}> = ({ position, size=[3,2], seed=1 }) => {
  // textura procedural simple
  const tex = React.useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(0,0,256,256);
    for (let i=0;i<5;i++){
      ctx.fillStyle = `hsl(${(seed*97+i*60)%360}, 8%, ${50+i*5}%)`;
      ctx.fillRect(20+i*15, 40+i*10, 200-i*30, 30+i*10);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [seed]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0]+0.1, size[1]+0.1, 0.08]} />
        <meshStandardMaterial color="#333" roughness={0.4} />
      </mesh>
      <mesh position={[0,0,0.045]} castShadow receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial map={tex} />
      </mesh>
      <rectAreaLight width={size[0]*0.95} height={size[1]*0.95} intensity={6.5} position={[0,0,0.4]} />
    </group>
  );
};