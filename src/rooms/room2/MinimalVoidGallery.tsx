import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import {
  Environment,
  ContactShadows,
  MeshReflectorMaterial,
  Html, // para overlays DOM
} from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three-stdlib";

import { MouseLookController } from "../../controllers/MouseLookController";
import { MovementController } from "../../controllers/MovementController";
import { GalerieBuildings } from "../Gallerie/GalerieBuildings";

import {
  PrefabPlacerProvider,
  PrefabPalette,
  PrefabPlacer,
  usePrefabPlacer,
} from "../../prefabs-placer";
import Cube from "../../prefabs/cube";
import Sphere from "../../prefabs/Sphere";
import { PortalPlane } from "../../Components/PortalPlane";

/* ===== Config editor ===== */
const EXIT_EDIT_KEY = "x";
const COLOR_PRESETS = ["#ffffff","#e63946","#ffb703","#2a9d8f","#1d3557","#6c757d","#222222","#f1faee"];

/* ---------- Piso reflectante + colisión ---------- */
function Floor({
  collidableMeshes,
  size = 800,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  size?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        color="#d6d9dc"
        roughness={0.55}
        metalness={0.1}
        mirror={0.35}
        mixStrength={0.35}
        blur={[250, 60]}
        depthScale={0.5}
        minDepthThreshold={0.8}
        maxDepthThreshold={1.2}
        resolution={1024}
      />
    </mesh>
  );
}

/* ---------- Overlay de color ---------- */
const ColorOverlay: React.FC<{
  visible: boolean;
  current: string;
  onPick: (c: string) => void;
}> = ({ visible, current, onPick }) => {
  if (!visible) return null;
  return (
    <Html fullscreen>
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,.92)",
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: "10px 12px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          zIndex: 30,
          pointerEvents: "auto",
          boxShadow: "0 6px 18px rgba(0,0,0,.08)",
        }}
      >
        <span style={{ fontSize: 12, opacity: 0.7, marginRight: 6 }}>
          Color (1–8, ←/→, Enter confirma, {EXIT_EDIT_KEY.toUpperCase()} cancela):
        </span>
        {COLOR_PRESETS.map((c, i) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              border: c === current ? "2px solid #111" : "1px solid #ccc",
              background: c,
              cursor: "pointer",
            }}
            title={`${i + 1}: ${c}`}
          />
        ))}
      </div>
    </Html>
  );
};

/* ---------- Instancias + edición (fase scale → fase color) ---------- */
const PlacedInstances: React.FC = () => {
  const {
    instances,
    prefabs,
    selectedInstanceId,
    updateInstance,
    setSelectedInstanceId,
    removeInstance,
  } = usePrefabPlacer();

  const [phase, setPhase] = useState<"scale" | "color" | null>(null);
  const [pendingScale, setPendingScale] = useState<[number, number, number] | null>(null);
  const [pendingColor, setPendingColor] = useState<string>(COLOR_PRESETS[0]);

  const originalScaleRef = useRef<[number, number, number] | null>(null);
  const originalColorRef = useRef<string | undefined>(undefined);

  // sal del pointer lock al entrar a edición
  useEffect(() => {
    if (selectedInstanceId && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, [selectedInstanceId]);

  // inicializa buffers
  useEffect(() => {
    if (selectedInstanceId) {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      const s = inst?.scale ?? [1, 1, 1];
      originalScaleRef.current = s;
      setPendingScale(s);

      originalColorRef.current = inst?.color;
      setPendingColor(inst?.color ?? COLOR_PRESETS[0]);

      setPhase("scale");
    } else {
      setPhase(null);
      setPendingScale(null);
      originalScaleRef.current = null;
      originalColorRef.current = undefined;
    }
  }, [selectedInstanceId, instances]);

  // hotkeys edición
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedInstanceId || !phase) return;

      const kRaw = e.key;                   // "Enter" | "NumpadEnter" | ...
      const key  = kRaw.toLowerCase();      // "enter" | ...
      const code = (e.code || "").toLowerCase(); // "enter" (code)
      const big  = e.shiftKey;
      const step = big ? 0.2 : 0.05;

      const isEnter =
        kRaw === "Enter" ||
        kRaw === "NumpadEnter" ||
        code === "enter" ||
        code === "numpadenter";

      // salir/cancelar en cualquier fase
      if (key === EXIT_EDIT_KEY) {
        if (originalScaleRef.current) {
          updateInstance(selectedInstanceId, {
            scale: originalScaleRef.current,
            color: originalColorRef.current,
          });
        }
        setSelectedInstanceId(null);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (phase === "scale") {
        // trabaja sobre el buffer si existe, si no toma la escala real
        const inst = instances.find((i) => i.id === selectedInstanceId);
        let [sx, sy, sz] = (pendingScale ?? inst?.scale ?? [1, 1, 1]) as [number, number, number];

        // WASD para X/Y, Q/E para Z (opcional)
        if (key === "w") { sy += step; e.preventDefault(); }
        if (key === "s") { sy = Math.max(0.05, sy - step); e.preventDefault(); }
        if (key === "a") { sx = Math.max(0.05, sx - step); e.preventDefault(); }
        if (key === "d") { sx += step; e.preventDefault(); }
        if (key === "q") { sz = Math.max(0.05, sz - step); e.preventDefault(); }
        if (key === "e") { sz += step; e.preventDefault(); }

        // Enter: confirma escala (aunque pendingScale sea null) y pasa a color
        if (isEnter) {
          const finalScale: [number, number, number] = [sx, sy, sz];
          updateInstance(selectedInstanceId, { scale: finalScale });
          setPendingScale(finalScale);
          setPhase("color");
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        setPendingScale([sx, sy, sz]);
        return;
      }

      if (phase === "color") {
        let idx = COLOR_PRESETS.indexOf(pendingColor);
        if (idx < 0) idx = 0;

        // 1..8 eligen
        if (/^[1-8]$/.test(kRaw)) {
          const i = parseInt(kRaw, 10) - 1;
          setPendingColor(COLOR_PRESETS[i]);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // ← / →
        if (kRaw === "ArrowLeft")  { setPendingColor(COLOR_PRESETS[(idx - 1 + COLOR_PRESETS.length) % COLOR_PRESETS.length]); e.preventDefault(); e.stopPropagation(); return; }
        if (kRaw === "ArrowRight") { setPendingColor(COLOR_PRESETS[(idx + 1) % COLOR_PRESETS.length]); e.preventDefault(); e.stopPropagation(); return; }

        // Enter: aplica color y sale del editor
        if (isEnter) {
          updateInstance(selectedInstanceId, { color: pendingColor });
          setSelectedInstanceId(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    };

    // usa capture para ganar prioridad ante otros listeners
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [selectedInstanceId, phase, pendingScale, pendingColor, instances, updateInstance, setSelectedInstanceId]);

  return (
    <>
      <ColorOverlay
        visible={!!selectedInstanceId && phase === "color"}
        current={pendingColor}
        onPick={(c) => setPendingColor(c)}
      />

      {instances.map((it) => {
        const P = prefabs.find((p) => p.key === it.key)?.Component;
        if (!P) return null;

        const scaleVec = it.id === selectedInstanceId && pendingScale ? pendingScale : it.scale;
        const colorVal =
          it.id === selectedInstanceId && phase === "color"
            ? pendingColor
            : it.color ?? "#ffffff";

        return (
          <group
            key={it.id}
            position={it.position}
            rotation={[0, it.rotationY, 0]}
            scale={scaleVec}
          >
            <P color={colorVal} />
          </group>
        );
      })}
    </>
  );
};

/* ---------- Desactiva POV cuando hay UI o edición ---------- */
const ControlsGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { uiOpen, selectedInstanceId } = usePrefabPlacer();
  return <>{uiOpen || selectedInstanceId ? null : children}</>;
};

export default function MinimalVoidGallery() {
  const [ready, setReady] = useState(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const collidableMeshes = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    RectAreaLightUniformsLib.init();
    const requestPointerLock = () => document.body.requestPointerLock();
    document.addEventListener("click", requestPointerLock);
    return () => document.removeEventListener("click", requestPointerLock);
  }, []);

  return (
    <PrefabPlacerProvider prefabs={[
        { key: "cube",   label: "Cube",   Component: Cube },
        { key: "sphere", label: "Sphere", Component: Sphere },
      ]}
      config={{ toggleKey: "u" }}>
      <PrefabPalette />

      <div style={{ width: "100vw", height: "100vh", background: "#F08080" }}>
        <Canvas
          shadows
          camera={{ position: [0, 2, 10], fov: 60 }}
          onCreated={({ camera, scene, gl }) => {
            cameraRef.current = camera as THREE.PerspectiveCamera;
            cameraRef.current.position.set(0, 0, 0);
            pivotRef.current.position.set(0, 1.5, 0);
            pivotRef.current.add(cameraRef.current);
            scene.add(pivotRef.current);

            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;

            setReady(true);
          }}
        >
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[8, 12, 6]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.00015}
          />
          <Environment preset="studio" />

          <Floor collidableMeshes={collidableMeshes} size={800} />
          <GalerieBuildings
            collidableMeshes={collidableMeshes}
            path="/museo.glb"
            position={[0, -10, 0]}
            scale={[10, 10, 10]}
          />
          

          <ContactShadows position={[0, 0.001, 0]} opacity={0.25} blur={2.5} far={30} />

          <PlacedInstances />
          <PrefabPlacer />

          <ControlsGate>
            {ready && cameraRef.current && pivotRef.current && (
              <>
                <MovementController
                  camera={cameraRef.current}
                  pivot={pivotRef.current}
                  collidableMeshes={collidableMeshes}
                />
                <MouseLookController camera={cameraRef.current} pivot={pivotRef.current} />
                <PortalPlane
              position={[0, 1.6, -6]}   // dónde está el plano del portal
              rotation={[0, 0, 0]}       // hacia dónde mira (0 => hacia +Z global)
              size={[2.2, 3.3]}          // ancho/alto del rectángulo

              destPosition={[0, 1.6, 24]} // adónde te manda
              destRotationY={Math.PI}     // hacia dónde mira al salir

              pivot={pivotRef.current}
              mainCamera={cameraRef.current}
            />
              </>
            )}
          </ControlsGate>
        </Canvas>
      </div>
    </PrefabPlacerProvider>
  );
}