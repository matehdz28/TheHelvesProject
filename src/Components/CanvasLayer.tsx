import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { usePortal } from "../rooms/portal/framework/PortalProvider ";

type CanvasLayerProps = {
  side: "A" | "B";
  active: boolean;
  setLocked: (v:boolean)=>void;
  frameloop?: "always" | "demand";
  dpr?: [number, number];
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const CanvasLayer: React.FC<CanvasLayerProps> = ({
  side, active, setLocked, frameloop="always", dpr=[1,1.5], children, style
}) => {
  const { cams, pivots } = usePortal();

  return (
    <Canvas
      style={style}
      frameloop={frameloop}
      dpr={dpr}
      gl={{
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: true,
        alpha: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      }}
      shadows
      camera={{ position: [0, 2, 10], fov: 60 }}
      onCreated={({ camera, scene, gl }) => {
        const camRef = side === "A" ? cams.A : cams.B;
        const pivotRef = side === "A" ? pivots.A : pivots.B;

        camRef.current = camera as THREE.PerspectiveCamera;
        (camera as THREE.PerspectiveCamera).position.set(0,0,0);
        pivotRef.current.position.set(0, 1.5, side === "A" ? 0 : 24);
        pivotRef.current.add(camera);
        scene.add(pivotRef.current);

        gl.setClearColor("#ffffff", 1);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.BasicShadowMap;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;

        // pointer lock aquí es opcional (puedes usar el hook externo con gl.domElement)
        const el = gl.domElement;
        const onPLC = () => setLocked(document.pointerLockElement === el && active);
        const onDown = () => { if(active) el.requestPointerLock?.().catch(()=>{}); }
        const onKey = (e: KeyboardEvent) => {
          if (!active) return;
          if (e.key === "l" || e.key === "L") { e.preventDefault(); onDown(); }
        };
        el.addEventListener("mousedown", onDown);
        document.addEventListener("pointerlockchange", onPLC);
        window.addEventListener("keydown", onKey);
        return () => {
          el.removeEventListener("mousedown", onDown);
          document.removeEventListener("pointerlockchange", onPLC);
          window.removeEventListener("keydown", onKey);
        };
      }}
    >
      {children}
    </Canvas>
  );
};

export default CanvasLayer;