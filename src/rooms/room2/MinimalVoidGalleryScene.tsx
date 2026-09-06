import React, { useRef } from "react";
import * as THREE from "three";
import { Environment, ContactShadows, MeshReflectorMaterial, Html } from "@react-three/drei";
import { GalerieBuildings } from "../Gallerie/GalerieBuildings";
import {
  PrefabPlacerProvider,
  PrefabPalette,
  PrefabPlacer,
  usePrefabPlacer,
} from "../../prefabs-placer";
import Cube from "../../prefabs/cube";
import Sphere from "../../prefabs/Sphere";

const EXIT_EDIT_KEY = "x";
const COLOR_PRESETS = ["#ffffff","#e63946","#ffb703","#2a9d8f","#1d3557","#6c757d","#222222","#f1faee"];

/* ---------- Piso reflectante ---------- */
function Floor({
  collidableMeshes,
  size = 800,
}: {
  collidableMeshes?: React.MutableRefObject<THREE.Mesh[]>;
  size?: number;
}) {
  const ref = React.useRef<THREE.Mesh>(null!);
  React.useEffect(() => {
    if (!collidableMeshes?.current) return;
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
    return () => {
      if (!collidableMeshes?.current || !ref.current) return;
      const i = collidableMeshes.current.indexOf(ref.current);
      if (i >= 0) collidableMeshes.current.splice(i, 1);
    };
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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

/* ---------- Overlay de color (igual que tenías) ---------- */
const ColorOverlay: React.FC<{ visible: boolean; current: string; onPick: (c: string) => void; }> = ({ visible, current, onPick }) => {
  if (!visible) return null;
  return (
    <Html fullscreen>
      <div style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        background: "rgba(255,255,255,.92)", border: "1px solid #ddd", borderRadius: 10,
        padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", zIndex: 30,
        pointerEvents: "auto", boxShadow: "0 6px 18px rgba(0,0,0,.08)",
      }}>
        <span style={{ fontSize: 12, opacity: 0.7, marginRight: 6 }}>
          Color (1–8, ←/→, Enter confirma, {EXIT_EDIT_KEY.toUpperCase()} cancela):
        </span>
        {COLOR_PRESETS.map((c, i) => (
          <button key={c} onClick={() => onPick(c)} title={`${i + 1}: ${c}`}
            style={{
              width: 22, height: 22, borderRadius: 4,
              border: c === current ? "2px solid #111" : "1px solid #ccc",
              background: c, cursor: "pointer",
            }}
          />
        ))}
      </div>
    </Html>
  );
};

/* ---------- Instancias + edición (igual que tenías) ---------- */
const PlacedInstances: React.FC = () => {
  const { instances, prefabs, selectedInstanceId, updateInstance, setSelectedInstanceId, removeInstance } = usePrefabPlacer();
  const [phase, setPhase] = React.useState<"scale" | "color" | null>(null);
  const [pendingScale, setPendingScale] = React.useState<[number, number, number] | null>(null);
  const [pendingColor, setPendingColor] = React.useState<string>(COLOR_PRESETS[0]);
  const originalScaleRef = React.useRef<[number, number, number] | null>(null);
  const originalColorRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (selectedInstanceId && document.pointerLockElement) document.exitPointerLock?.();
  }, [selectedInstanceId]);

  React.useEffect(() => {
    if (selectedInstanceId) {
      const inst = instances.find((i) => i.id === selectedInstanceId);
      const s = inst?.scale ?? [1, 1, 1];
      originalScaleRef.current = s; setPendingScale(s);
      originalColorRef.current = inst?.color; setPendingColor(inst?.color ?? COLOR_PRESETS[0]);
      setPhase("scale");
    } else {
      setPhase(null); setPendingScale(null); originalScaleRef.current = null; originalColorRef.current = undefined;
    }
  }, [selectedInstanceId, instances]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedInstanceId || !phase) return;
      const kRaw = e.key, key = kRaw.toLowerCase(), code = (e.code || "").toLowerCase();
      const big = e.shiftKey, step = big ? 0.2 : 0.05;
      const isEnter = kRaw === "Enter" || kRaw === "NumpadEnter" || code === "enter" || code === "numpadenter";

      if (key === EXIT_EDIT_KEY) {
        if (originalScaleRef.current) {
          updateInstance(selectedInstanceId, { scale: originalScaleRef.current, color: originalColorRef.current });
        }
        setSelectedInstanceId(null); e.preventDefault(); e.stopPropagation(); return;
      }

      if (phase === "scale") {
        const inst = instances.find((i) => i.id === selectedInstanceId);
        let [sx, sy, sz] = (pendingScale ?? inst?.scale ?? [1, 1, 1]) as [number, number, number];
        if (key === "w") { sy += step; e.preventDefault(); }
        if (key === "s") { sy = Math.max(0.05, sy - step); e.preventDefault(); }
        if (key === "a") { sx = Math.max(0.05, sx - step); e.preventDefault(); }
        if (key === "d") { sx += step; e.preventDefault(); }
        if (key === "q") { sz = Math.max(0.05, sz - step); e.preventDefault(); }
        if (key === "e") { sz += step; e.preventDefault(); }

        if (isEnter) {
          const finalS: [number, number, number] = [sx, sy, sz];
          updateInstance(selectedInstanceId, { scale: finalS });
          setPendingScale(finalS); setPhase("color");
          e.preventDefault(); e.stopPropagation(); return;
        }
        setPendingScale([sx, sy, sz]); return;
      }

      if (phase === "color") {
        let idx = COLOR_PRESETS.indexOf(pendingColor); if (idx < 0) idx = 0;
        if (/^[1-8]$/.test(kRaw)) { setPendingColor(COLOR_PRESETS[parseInt(kRaw, 10) - 1]); e.preventDefault(); e.stopPropagation(); return; }
        if (kRaw === "ArrowLeft") { setPendingColor(COLOR_PRESETS[(idx - 1 + COLOR_PRESETS.length) % COLOR_PRESETS.length]); e.preventDefault(); e.stopPropagation(); return; }
        if (kRaw === "ArrowRight") { setPendingColor(COLOR_PRESETS[(idx + 1) % COLOR_PRESETS.length]); e.preventDefault(); e.stopPropagation(); return; }
        if (isEnter) { updateInstance(selectedInstanceId, { color: pendingColor }); setSelectedInstanceId(null); e.preventDefault(); e.stopPropagation(); return; }
      }
    };

    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [selectedInstanceId, phase, pendingScale, pendingColor, instances, updateInstance, setSelectedInstanceId]);

  return (
    <>
      <ColorOverlay visible={!!selectedInstanceId && phase === "color"} current={pendingColor} onPick={(c) => setPendingColor(c)} />
      {instances.map((it) => {
        const P = prefabs.find((p) => p.key === it.key)?.Component; if (!P) return null;
        const scaleVec = it.id === selectedInstanceId && pendingScale ? pendingScale : it.scale;
        const colorVal = it.id === selectedInstanceId && phase === "color" ? pendingColor : it.color ?? "#ffffff";
        return (
          <group key={it.id} position={it.position} rotation={[0, it.rotationY, 0]} scale={scaleVec}>
            <P color={colorVal} />
          </group>
        );
      })}
    </>
  );
};

export const MinimalVoidGalleryScene: React.FC = () => {
  // Si quieres colisiones internas aquí, crea una ref local (opcional)
  const collidable = useRef<THREE.Mesh[]>([]);

  return (
    <PrefabPlacerProvider
      prefabs={[
        { key: "cube", label: "Cube", Component: Cube },
        { key: "sphere", label: "Sphere", Component: Sphere },
      ]}
      config={{ toggleKey: "u" }}
    >
      <PrefabPalette />

      <ambientLight intensity={0.25} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <Environment preset="studio" />

      <Floor collidableMeshes={collidable} size={800} />

      {/* ⬇️ Puedes pasar collidable o simplemente omitirlo (ahora es opcional) */}
      <GalerieBuildings
        path="/museo.glb"
        position={[0, -10, 0]}
        scale={[10, 10, 10]}
        collidableMeshes={collidable}
      />

      <ContactShadows position={[0, 0.001, 0]} opacity={0.25} blur={2.5} far={30} />

      <PlacedInstances />
      <PrefabPlacer />
    </PrefabPlacerProvider>
  );
};