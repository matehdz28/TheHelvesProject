// src/components/Ramp.tsx
import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

type Props = {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  innerRadius?: number;
  width?: number;     // ancho de la pasarela
  angle?: number;     // cuánto gira
  rise?: number;      // cuánto sube a lo largo
  y?: number;         // altura base
};

export const Ramp: React.FC<Props> = ({
  collidableMeshes,
  innerRadius = 8.5,
  width = 3.0,
  angle = Math.PI*0.9,
  rise = 2.5,
  y = 0
}) => {
  const ref = useRef<THREE.Mesh>(null!);
  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  const geo = useMemo(() => {
    // Generamos un “cinturón” curvo (anillo parcial) extruido con inclinación
    const radialSeg = 64;
    const heightSeg = 1;

    const ir = innerRadius, or = innerRadius + width;
    const geometry = new THREE.BufferGeometry();

    const verts: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= radialSeg; i++) {
      const t = i / radialSeg;
      const a = -angle/2 + t * angle;
      const h = y + t * rise;
      const sin = Math.sin(a), cos = Math.cos(a);

      const inner = new THREE.Vector3(ir*sin, h, ir*cos);
      const outer = new THREE.Vector3(or*sin, h, or*cos);

      verts.push(inner.x, inner.y, inner.z);
      verts.push(outer.x, outer.y, outer.z);

      // normales arriba
      normals.push(0,1,0, 0,1,0);

      uvs.push(0, t, 1, t);

      if (i < radialSeg) {
        const k = i*2;
        indices.push(k, k+1, k+3,  k, k+3, k+2);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }, [innerRadius, width, angle, rise, y]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xd7d9db, roughness: 0.9, metalness: 0 }), []);

  return <mesh ref={ref} geometry={geo} material={mat} castShadow receiveShadow />;
};