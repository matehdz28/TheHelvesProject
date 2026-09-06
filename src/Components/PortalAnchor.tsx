import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function PortalAnchor({ onMatrix }: { onMatrix: (m: THREE.Matrix4) => void }) {
  const ref = useRef<THREE.Mesh>(null!);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.updateWorldMatrix(true, true);
    onMatrix(ref.current.matrixWorld);
  });
  return (
    <mesh ref={ref} position={[0, 1.7, -6]} visible={false}>
      <planeGeometry args={[20, 30]} />
      <meshBasicMaterial />
    </mesh>
  );
}