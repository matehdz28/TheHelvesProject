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
    if (ref.current) {
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          // 🔥 ACTIVAR SOMBRAS PARA CADA MESH DEL MODELO
          object.castShadow = true;
          object.receiveShadow = true;

          // Añadir a la lista de colisionables
          if (!collidableMeshes.current.includes(object)) {
            collidableMeshes.current.push(object);
          }
        }
      });
    }
  }, [collidableMeshes, scene]);

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
