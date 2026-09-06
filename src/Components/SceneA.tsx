import { Environment } from "@react-three/drei";
import * as THREE from "three";
import CollidableFloor from "./CollidableFloor";
import { GalerieBuildings } from "../rooms/Gallerie/GalerieBuildings";
import PortalFrame from "./PortalFrame";

export default function SceneA({
  collidableA,
  showPortalFrame = true,
  showBuilding = true,
  chargeRef,
}: {
  collidableA: React.MutableRefObject<THREE.Mesh[]>;
  showPortalFrame?: boolean;
  showBuilding?: boolean;
  chargeRef?: React.MutableRefObject<number>;
}) {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <Environment preset="studio" />

      <CollidableFloor collidableMeshes={collidableA} size={800} y={0} reflective />

      {showBuilding && (
        <GalerieBuildings
          collidableMeshes={collidableA}
          path="/museo.glb"
          position={[0, -10, 0]}
          scale={[10, 10, 10]}
        />
      )}

      {showPortalFrame && (
        <PortalFrame position={[0, 1.7, -6]} opening={[2.2, 3.3]} chargeRef={chargeRef} />
      )}

      {/* respaldo del portal: lo que se ve cuando el canvas B esta recortado a cero */}
      <mesh position={[0, 1.7, -6.03]}>
        <planeGeometry args={[2.2, 3.3]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </>
  );
}