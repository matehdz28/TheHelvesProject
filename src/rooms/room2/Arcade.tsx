// src/components/Arcade.tsx
import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

type Props = {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  count?: number;
  span?: number;        // separación entre arcos
  radius?: number;      // radio del pasillo
  height?: number;      // altura del arco
  thickness?: number;   // grosor del pilar
  y?: number;           // altura base
  angle?: number;       // arco de circunferencia cubierto (radianes)
};

export const Arcade: React.FC<Props> = ({
  collidableMeshes,
  count = 10,
  span = 3.2,
  radius = 10.5,
  height = 3.6,
  thickness = 0.5,
  y = 0,
  angle = Math.PI * 1.2
}) => {
  const pillarRef = useRef<THREE.Mesh>(null!);
  const archRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (pillarRef.current && !collidableMeshes.current.includes(pillarRef.current)) {
      collidableMeshes.current.push(pillarRef.current);
    }
    if (archRef.current && !collidableMeshes.current.includes(archRef.current)) {
      collidableMeshes.current.push(archRef.current);
    }
  }, [collidableMeshes]);

  // Geometrías: pilar + arco (torus recortado)
  const pillarGeo = useMemo(() => new THREE.BoxGeometry(thickness, height, thickness), [thickness, height]);
  const archGeo   = useMemo(() => new THREE.TorusGeometry(thickness*2.1, thickness*0.35, 12, 64, Math.PI), [thickness]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd7d9db, roughness: 0.85, metalness: 0 }), []);

  // Colocamos arcos a lo largo de un sector circular
  const positions = useMemo(() => {
    const arr: {p1:THREE.Vector3; p2:THREE.Vector3; rot:number}[] = [];
    const arcLen = angle;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const a = -arcLen/2 + t * arcLen;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const base = dir.clone().multiplyScalar(radius);

      // dos pilares por vano
      const right = new THREE.Vector3(dir.z, 0, -dir.x);
      const p1 = base.clone().add(right.clone().multiplyScalar(span*0.5));
      const p2 = base.clone().add(right.clone().multiplyScalar(-span*0.5));
      arr.push({p1, p2, rot: Math.atan2(dir.x, dir.z)});
    }
    return arr;
  }, [count, radius, span, angle]);

  return (
    <group position-y={y}>
      {positions.map(({p1, p2, rot}, i) => (
        <group key={i}>
          {/* pilares */}
          <mesh ref={i===0 ? pillarRef : undefined} position={[p1.x, height/2, p1.z]} rotation={[0, rot, 0]} castShadow receiveShadow geometry={pillarGeo} material={mat} />
          <mesh position={[p2.x, height/2, p2.z]} rotation={[0, rot, 0]} castShadow receiveShadow geometry={pillarGeo} material={mat} />

          {/* arco (colocado a mitad entre pilares) */}
          <mesh ref={i===0 ? archRef : undefined}
                position={[(p1.x+p2.x)/2, height- (thickness*0.2), (p1.z+p2.z)/2]}
                rotation={[Math.PI, rot, 0]}
                castShadow receiveShadow
                geometry={archGeo} material={mat} />
        </group>
      ))}
    </group>
  );
};