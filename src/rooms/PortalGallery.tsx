import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";

// ✅ Tus controllers (no los toco)
import { MouseLookController } from "../controllers/MouseLookController";
import { MovementController } from "../controllers/MovementController";

// Componentes modularizados
import AutoInvalidate from "../Components/AutoInvalidate";
import PortalAnchor from "../Components/PortalAnchor";
import PortalBridge from "../Components/PortalBridge";
import SceneA from "../Components/SceneA";
import SceneB from "../Components/SceneB";
import Ripples from "../Components/Ripples";
import TunnelLight from "../Components/TunnelLight";
import TerrainControls from "../Components/terrain/TerrainControls";
import { getTerrain, RIDE_HEIGHT } from "../Components/terrain/terrainData";
import {
  AUDIO_SEEK_AT,
  AUDIO_SEEK_TO,
  BLUE_AT,
  BEACON_AT,
  FADE_AT,
  FADE_SECONDS,
  LIGHT_AT,
  LIGHT_SECONDS,
  REDIRECT_AT,
  NEXT_ROOM,
  type Phase,
} from "../Components/terrain/timeline";
import { usePortalAudio } from "../audio/usePortalAudio";

// ventanas de la pista, en segundos
const TRACK = "/calle-bosque-del-eucalipto-904.m4a";
const FINALE_TRACK = "/calle-bosque-del-eucalipto-969.m4a";
const BASE_WINDOW = { start: 10, end: 16 }; // colchon, suena siempre
const NEAR_WINDOW = { start: 26, end: 35 }; // se monta encima al acercarte
const TAIL = { start: 47, gain: 0.85 };     // mundo B: corre de largo desde aqui

export default function PortalGallery() {
  const navigate = useNavigate();
  // cámaras / pivotes / colliders
  const camA = useRef<THREE.PerspectiveCamera | null>(null);
  const camB = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotA = useRef<THREE.Object3D>(new THREE.Object3D());
  const pivotB = useRef<THREE.Object3D>(new THREE.Object3D());
  const collidableA = useRef<THREE.Mesh[]>([]);

  const [readyA, setReadyA] = useState(false);
  const [readyB, setReadyB] = useState(false);

  // estado portal
  const [active, setActive] = useState<"A" | "B">("A");
  const [clipB, setClipB] = useState<string | null>("polygon(0 0, 0 0, 0 0, 0 0)"); // invisible al inicio
  const [transition, setTransition] = useState(0);
  const portalWorld = useRef(new THREE.Matrix4());

  // proximidad al portal (0..1): la escribe <PortalFrame/>, la leen luz y audio
  const chargeRef = useRef(0);

  // los handlers de pointer lock se registran una sola vez en onCreated, asi
  // que leer `active` de su closure lo congelaria en "A" para siempre
  const activeRef = useRef(active);
  activeRef.current = active;
  // al cruzar: los bucles de A se disuelven y entra la pista larga
  const crossed = active === "B" || transition > 0;
  const { status: audioStatus, error: audioError, seekTail, beginFinale, levels } = usePortalAudio(chargeRef, crossed, {
    src: TRACK,
    base: BASE_WINDOW,
    near: NEAR_WINDOW,
    tail: TAIL,
    finale: { src: FINALE_TRACK },
    baseGain: 0.55,
    nearGain: 0.9,
    curve: 1.6,
  });

  // Linea de tiempo del mundo B. Solo hay dos cambios, asi que van con
  // timeouts en vez de un contador por frame.
  const [phase, setPhase] = useState<Phase>("ice");
  const [showBeacon, setShowBeacon] = useState(false);
  const [fading, setFading] = useState(false);
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (!crossed) {
      setPhase("ice");
      setShowBeacon(false);
      setFading(false);
      setLight(false);
      return;
    }
    // eventos independientes, todos derivados de tiempos de la pista
    const timers = [
      setTimeout(() => seekTail(AUDIO_SEEK_TO), AUDIO_SEEK_AT * 1000),
      setTimeout(() => setPhase("blue"), BLUE_AT * 1000),
      setTimeout(() => setShowBeacon(true), BEACON_AT * 1000),
      setTimeout(() => {
        setFading(true);
        beginFinale(FADE_SECONDS);
      }, FADE_AT * 1000),
      setTimeout(() => setLight(true), LIGHT_AT * 1000),
      setTimeout(() => navigate(NEXT_ROOM), REDIRECT_AT * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [crossed, seekTail, beginFinale, navigate]);

  // pointer lock
  const [lockedA, setLockedA] = useState(false);

  // transición (expansión del recorte)
  useEffect(() => {
    let raf = 0;
    if (transition > 0 && transition < 1) {
      const tick = () => {
        setTransition((t) => Math.min(1, t + 0.06));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(raf);
  }, [transition]);

  useEffect(() => {
    if (transition >= 1) {
      setClipB(null);
      setActive("B");
    }
  }, [transition]);

  const layer: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    touchAction: "none",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#fff" }}>
      {/* ===== Canvas A ===== */}
      <Canvas
        style={layer}
        dpr={[1, 1.5]}
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
          camA.current = camera as THREE.PerspectiveCamera;
          (camera as THREE.PerspectiveCamera).position.set(0, 0, 0);
          pivotA.current.position.set(0, 1.5, 0);
          pivotA.current.add(camera);
          scene.add(pivotA.current);

          gl.setClearColor("#ffffff", 1);
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.BasicShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;

          setReadyA(true);

          // Pointer lock A con click
          const canvasEl = gl.domElement;
          const tryLockA = async () => {
            if (activeRef.current !== "A" || !document.hasFocus()) return;
            try { await canvasEl.requestPointerLock(); } catch {}
            setLockedA(document.pointerLockElement === canvasEl);
          };
          const onPLC = () => setLockedA(document.pointerLockElement === canvasEl);
          const onKey = (e: KeyboardEvent) => {
            if (activeRef.current === "A" && (e.key === "l" || e.key === "L")) {
              e.preventDefault();
              tryLockA();
            }
          };
          canvasEl.addEventListener("mousedown", tryLockA);
          document.addEventListener("pointerlockchange", onPLC);
          window.addEventListener("keydown", onKey);
          return () => {
            canvasEl.removeEventListener("mousedown", tryLockA);
            document.removeEventListener("pointerlockchange", onPLC);
            window.removeEventListener("keydown", onKey);
          };
        }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />

        <SceneA collidableA={collidableA} showPortalFrame showBuilding={active === "A"} chargeRef={chargeRef} />
        <PortalAnchor onMatrix={(m) => portalWorld.current.copy(m)} />

        {/* Proyección del portal + cruce */}
        {/* deja de pilotar camB en cuanto B toma el control, si no le pisa
            la rotacion que escribe MouseLookController cada frame */}
        {active === "A" && readyA && camA.current && camB.current && (
          <PortalBridge
            portalWorldMatrix={portalWorld.current}
            size={[2.2, 3.3]}
            onUpdateClip={(clip) => {
              if (active === "A") {
                if (transition === 0) setClipB(clip);
                else if (transition > 0 && transition < 1) setClipB("inset(0 0 0 0)");
              }
            }}
            setCamBFromA={(m) => {
              camB.current!.matrixWorld.copy(m);
              camB.current!.matrixWorld.decompose(
                camB.current!.position,
                camB.current!.quaternion,
                new THREE.Vector3()
              );
              camB.current!.projectionMatrix.copy(camA.current!.projectionMatrix);
            }}
            onCrossFrontToBack={() => {
              if (active === "A") setTransition(0.001);
            }}
            pivotA={pivotA.current}
          />
        )}

        {/* Movimiento + mirada */}
        {/* solo en A: sus listeners de WASD viven en window y si no seguirian
            moviendo el pivote del museo mientras volas por el terreno */}
        {active === "A" && readyA && camA.current && (
          <MovementController camera={camA.current} pivot={pivotA.current} collidableMeshes={collidableA} />
        )}
        {readyA && camA.current && lockedA && (
          <MouseLookController camera={camA.current} pivot={pivotA.current} />
        )}
      </Canvas>

      {/* final: fundido a negro total, en paralelo con el del volumen */}
      <div
        style={{
          ...layer,
          background: "#000000",
          opacity: fading ? 1 : 0,
          transition: `opacity ${FADE_SECONDS}s linear`,
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      <Ripples active={fading} />

      {/* montada desde el fundido para que la transicion tenga estado inicial */}
      <TunnelLight mounted={fading} growing={light} seconds={LIGHT_SECONDS} />

      {audioStatus === "waiting-gesture" && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: "center",
            font: "500 13px/1 system-ui, sans-serif",
            letterSpacing: "0.04em",
            color: "#8a8a92",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          click para activar el sonido
        </div>
      )}
      {audioError && import.meta.env.DEV && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 24,
            font: "500 12px/1 system-ui, sans-serif",
            color: "#c05a5a",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          audio: {audioError}
        </div>
      )}

      {/* ===== Canvas B (encima) ===== */}
      <div
        style={{
          ...layer,
          pointerEvents: active === "B" ? "auto" : "none",
          clipPath: clipB ?? undefined,
        }}
      >
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
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
          camera={{ position: [0, 2, 10], fov: 60, near: 1, far: 10000 }}
          onCreated={({ camera, scene, gl }) => {
            camB.current = camera as THREE.PerspectiveCamera;
            (camera as THREE.PerspectiveCamera).position.set(0, 0, 0);
            // pegado al terreno, como vuela el mundo B
            pivotB.current.position.set(0, getTerrain().heightAt(0, 24) + RIDE_HEIGHT, 24);
            pivotB.current.add(camera);
            scene.add(pivotB.current);

            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.BasicShadowMap;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.setClearColor("#efd1b5", 1)
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.NoToneMapping;   
            gl.toneMappingExposure = 1;  

            setReadyB(true);

            // Sin pointer lock aqui: FirstPersonControls mira segun la
            // posicion absoluta del cursor, y capturarlo la congelaria.
          }}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <AutoInvalidate active={active === "B"} clip={clipB} />

          <SceneB phase={phase} levels={levels} showBeacon={showBeacon} />

          {active === "B" && readyB && camB.current && (
            <TerrainControls camera={camB.current} pivot={pivotB.current} phase={phase} />
          )}
        </Canvas>
      </div>
    </div>
  );
}