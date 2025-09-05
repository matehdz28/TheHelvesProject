import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { MovementController } from "../../controllers/MovementController";
import { MouseLookController } from "../../controllers/MouseLookController";
import { GalerieBuildings } from "./GalerieBuildings";
import * as THREE from "three";
import { GalerieFloor } from "./GalerieFloor";

export const Galerie: React.FC = () => {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const collidableMeshes = useRef<THREE.Mesh[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const requestPointerLock = () => {
      document.body.requestPointerLock();
    };

    document.addEventListener("click", requestPointerLock);

    return () => {
      document.removeEventListener("click", requestPointerLock);
    };
  }, []);

  useEffect(() => {
    if (cameraRef.current && collidableMeshes.current.length > 0) {
      setIsReady(true);
    }
  }, [collidableMeshes.current.length]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        shadows={true}
        camera={{ position: [0, 2, 5], fov: 75 }}
        onCreated={({ camera, scene, gl }) => {
          cameraRef.current = camera as THREE.PerspectiveCamera;

          if (pivotRef.current && cameraRef.current) {
            pivotRef.current.position.set(0, 1.5, 0);
            pivotRef.current.add(cameraRef.current);
            scene.add(pivotRef.current);
          }


          setIsReady(true);
        }}
      >
        {/* 🌞 Luz Ambiental */}
        <ambientLight intensity={0.5} />

        {/* ☀️ Luz Direccional */}
        <directionalLight
          intensity={2}
          position={[-23, 40, 10]}
          castShadow // ✅ Permitir que la luz proyecte sombras
          shadow-mapSize-width={2048} // Mejor calidad de sombras
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />

        <GalerieFloor
        collidableMeshes={collidableMeshes}
        position={[0,0,0]}
        size={[200,200,200]}
        />

        {isReady && cameraRef.current && pivotRef.current && (
          <>
            <MovementController
              camera={cameraRef.current}
              collidableMeshes={collidableMeshes}
              pivot={pivotRef.current}
            />
            <MouseLookController
              camera={cameraRef.current}
              pivot={pivotRef.current}
            />
          </>
        )}
      </Canvas>
    </div>
  );
};
