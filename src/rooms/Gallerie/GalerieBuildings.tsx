import React, { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

type GLTFResult = GLTF & {
  nodes: Record<string, THREE.Mesh>;
  materials: Record<string, THREE.Material>;
};

interface GalerieBuildingsProps {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>; 
  path?: string;  // Ruta al modelo GLB o GLTF
  position?: [number, number, number];
  scale?: [number, number, number];
}

export const GalerieBuildings: React.FC<GalerieBuildingsProps> = ({
  collidableMeshes,
  path = '/Escenario1.glb', 
  position = [0, 0, 0],
  scale = [1, 1, 1]
}) => {
  const { scene } = useGLTF(path) as unknown as GLTFResult;
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
  if (!ref.current) return;

  const added: THREE.Mesh[] = [];

  scene.traverse((object: THREE.Object3D) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;

      if (!collidableMeshes.current.includes(object)) {
        collidableMeshes.current.push(object);
        added.push(object);
      }
    }
  });

  // 🔧 Clean-up: remover los que agregamos al desmontar
  return () => {
    const list = collidableMeshes.current;
    for (const m of added) {
      const i = list.indexOf(m);
      if (i >= 0) list.splice(i, 1);
    }
  };
}, [scene, collidableMeshes]);

  return (
    <primitive
      ref={ref}
      object={scene}
      position={position}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
};
