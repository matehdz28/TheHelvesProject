import React, { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { MovementController } from "../../controllers/MovementController";
import { MouseLookController } from "../../controllers/MouseLookController";
import * as THREE from "three";
import { CeciliaFloor } from "./CeciliaFloor";
import { BackgroundSquare } from "../../Components/BackgroundSquare";
import { CeciliaLavanda } from "./CeciliaLavanda";


export const CeciliaRoom: React.FC = () => {
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
        <ambientLight intensity={0.5} />

        {/* Luz direccional para sombras */}
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <CeciliaFloor
        collidableMeshes={collidableMeshes}
        position={[0, 0, 0]}
        size={[200, 0.1, 200]}
        />
        {
            //izquierda / derecha
            //z / arriba abajo
            //profundidad
        }
        
        <CeciliaLavanda 
        count={200} 
        center={[5, -1.5, 5]} 
        radius={15} 
        size={[3, 6]} 
        texturePath="/Cecilia/lavandaImpre.png" 
        />

        <CeciliaLavanda 
        count={200} 
        center={[5, -1.5, 0]} 
        radius={15} 
        size={[3, 6]} 
        texturePath="/Cecilia/lavandaImpre.png" 
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
