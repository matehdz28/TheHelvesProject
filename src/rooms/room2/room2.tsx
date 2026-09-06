// src/components/Room2.tsx
import React, { useRef, useState, useEffect, JSX } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Environment, ContactShadows } from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three-stdlib";

// ✅ tus controllers externos
import { MouseLookController } from "../../controllers/MouseLookController";
import { MovementController } from "../../controllers/MovementController";

/* ------------------------ Material base (concreto) ------------------------ */
function ConcreteMat(
  props?: Partial<JSX.IntrinsicElements["meshStandardMaterial"]>
) {
  return (
    <meshStandardMaterial
      color="#cfd2d4"
      roughness={0.88}
      metalness={0}
      {...props}
    />
  );
}

/* ------------------------------ PISO (collidable) ------------------------------ */
function Floor({
  collidableMeshes,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} position={[0, -0.1, 0]} receiveShadow>
      {/* altura=0.2 ⇒ top = -0.1 + 0.1 = 0 */}
      <boxGeometry args={[200, 0.2, 200]} />
      <ConcreteMat />
    </mesh>
  );
}

/* ---------------------- MURO CURVO con espesor (collidable) --------------------- */
function CurvedWallThick({
  collidableMeshes,
  innerRadius = 12.0,
  thickness = 0.4,
  height = 5,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  innerRadius?: number;
  thickness?: number;
  height?: number;
}) {
  const innerRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (innerRef.current && !collidableMeshes.current.includes(innerRef.current)) {
      collidableMeshes.current.push(innerRef.current);
    }
    if (outerRef.current && !collidableMeshes.current.includes(outerRef.current)) {
      collidableMeshes.current.push(outerRef.current);
    }
  }, [collidableMeshes]);

  const outerRadius = innerRadius + thickness;

  return (
    <group position={[0, height / 2, 0]}>
      {/* cara interna (normales hacia el interior) */}
      <mesh ref={innerRef} castShadow receiveShadow>
        <cylinderGeometry args={[innerRadius, innerRadius, height, 64, 1, true]} />
        <ConcreteMat side={THREE.BackSide} />
      </mesh>

      {/* cara externa (normales hacia afuera) */}
      <mesh ref={outerRef} castShadow receiveShadow>
        <cylinderGeometry args={[outerRadius, outerRadius, height, 64, 1, true]} />
        <ConcreteMat side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/* --------------------------- ARQUERÍA MODULAR --------------------------- */
function Arcade({
  collidableMeshes,
  count = 8,
  span = 3.2,
  radius = 10.5,
  height = 3.6,
  thickness = 0.5,
  y = 0,
  angle = Math.PI * 1.2,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  count?: number;
  span?: number;
  radius?: number;
  height?: number;
  thickness?: number;
  y?: number;
  angle?: number;
}) {
  const firstPillarRef = useRef<THREE.Mesh>(null!);
  const firstArchRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    // solo registramos un ejemplar de cada para colisiones (los demás comparten geometría/material)
    if (firstPillarRef.current && !collidableMeshes.current.includes(firstPillarRef.current)) {
      collidableMeshes.current.push(firstPillarRef.current);
    }
    if (firstArchRef.current && !collidableMeshes.current.includes(firstArchRef.current)) {
      collidableMeshes.current.push(firstArchRef.current);
    }
  }, [collidableMeshes]);

  const pillarGeo = React.useMemo(
    () => new THREE.BoxGeometry(thickness, height, thickness),
    [thickness, height]
  );
  const archGeo = React.useMemo(
    () => new THREE.TorusGeometry(thickness * 2.1, thickness * 0.35, 12, 64, Math.PI),
    [thickness]
  );
  const mat = React.useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xd7d9db, roughness: 0.85, metalness: 0 }),
    []
  );

  const items = React.useMemo(() => {
    const arr: { p1: THREE.Vector3; p2: THREE.Vector3; rot: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const a = -angle / 2 + t * angle;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const base = dir.clone().multiplyScalar(radius);
      const right = new THREE.Vector3(dir.z, 0, -dir.x);
      const p1 = base.clone().add(right.clone().multiplyScalar(span * 0.5));
      const p2 = base.clone().add(right.clone().multiplyScalar(-span * 0.5));
      arr.push({ p1, p2, rot: Math.atan2(dir.x, dir.z) });
    }
    return arr;
  }, [count, radius, span, angle]);

  return (
    <group position-y={y}>
      {items.map(({ p1, p2, rot }, i) => (
        <group key={i}>
          <mesh
            ref={i === 0 ? firstPillarRef : undefined}
            position={[p1.x, height / 2, p1.z]}
            rotation={[0, rot, 0]}
            castShadow
            receiveShadow
            geometry={pillarGeo}
            material={mat}
          />
          <mesh
            position={[p2.x, height / 2, p2.z]}
            rotation={[0, rot, 0]}
            castShadow
            receiveShadow
            geometry={pillarGeo}
            material={mat}
          />
          <mesh
            ref={i === 0 ? firstArchRef : undefined}
            position={[(p1.x + p2.x) / 2, height - thickness * 0.2, (p1.z + p2.z) / 2]}
            rotation={[Math.PI, rot, 0]}
            castShadow
            receiveShadow
            geometry={archGeo}
            material={mat}
          />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------- RAMPA CURVA ------------------------------ */
function Ramp({
  collidableMeshes,
  innerRadius = 8.5,
  width = 3.0,
  angle = Math.PI * 0.9,
  rise = 2.0,
  y = 0,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  innerRadius?: number;
  width?: number;
  angle?: number;
  rise?: number;
  y?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  const geo = React.useMemo(() => {
    const radialSeg = 64;
    const ir = innerRadius;
    const or = innerRadius + width;

    const geometry = new THREE.BufferGeometry();
    const verts: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= radialSeg; i++) {
      const t = i / radialSeg;
      const a = -angle / 2 + t * angle;
      const h = y + t * rise;
      const sin = Math.sin(a), cos = Math.cos(a);

      const inner = new THREE.Vector3(ir * sin, h, ir * cos);
      const outer = new THREE.Vector3(or * sin, h, or * cos);

      verts.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, t, 1, t);

      if (i < radialSeg) {
        const k = i * 2;
        indices.push(k, k + 1, k + 3, k, k + 3, k + 2);
      }
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }, [innerRadius, width, angle, rise, y]);

  return (
    <mesh ref={ref} geometry={geo} castShadow receiveShadow>
      <ConcreteMat />
    </mesh>
  );
}

/* -------------------------------- BÓVEDA -------------------------------- */
function Vault({
  collidableMeshes,
  radius = 7,
  length = 40,
  y = 3.6,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  radius?: number;
  length?: number;
  y?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    if (ref.current && !collidableMeshes.current.includes(ref.current)) {
      collidableMeshes.current.push(ref.current);
    }
  }, [collidableMeshes]);

  return (
    <mesh ref={ref} position={[0, y, 0]} castShadow receiveShadow>
      {/* cilindro abierto (por dentro) a modo de bóveda */}
      <cylinderGeometry args={[radius, radius, length, 32, 1, true]} />
      <meshStandardMaterial
        color={0xdfe2e4}
        roughness={0.9}
        metalness={0}
        side={THREE.BackSide}
      />
    </mesh>
  );
}

/* ----------------------------- CUADRO + LUZ ----------------------------- */
function Picture({
  position,
  size = [3, 2],
  seed = 1,
}: {
  position: [number, number, number];
  size?: [number, number];
  seed?: number;
}) {
  // textura procedural simple (sin assets)
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `hsl(${(seed * 97 + i * 60) % 360}, 8%, ${50 + i * 5}%)`;
      ctx.fillRect(20 + i * 15, 40 + i * 10, 200 - i * 30, 30 + i * 10);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [seed]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0] + 0.1, size[1] + 0.1, 0.08]} />
        <meshStandardMaterial color="#333" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.045]} castShadow receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial map={tex} />
      </mesh>
      {/* luz plana de galería */}
      <rectAreaLight
        width={size[0] * 0.95}
        height={size[1] * 0.95}
        intensity={6.5}
        position={[0, 0, 0.4]}
      />
    </group>
  );
}

/* ================================ ROOM 2 ================================ */
export const Room2: React.FC = () => {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const collidableMeshes = useRef<THREE.Mesh[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Pointer lock al hacer click
  useEffect(() => {
    const requestPointerLock = () => document.body.requestPointerLock();
    document.addEventListener("click", requestPointerLock);
    return () => document.removeEventListener("click", requestPointerLock);
  }, []);

  // Habilita controllers cuando hay cámara y collidables
  useEffect(() => {
    if (cameraRef.current && collidableMeshes.current.length > 0) {
      setIsReady(true);
    }
  }, [collidableMeshes.current.length]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        shadows
        camera={{ position: [0, 2, 8], fov: 60 }}
        onCreated={({ camera, scene, gl }) => {
          cameraRef.current = camera as THREE.PerspectiveCamera;

          // 👇 cámara sin offset local dentro del pivot
          cameraRef.current.position.set(0, 0, 0);
          if (pivotRef.current && cameraRef.current) {
            pivotRef.current.position.set(0, 1.5, 0); // altura inicial del "cuerpo"
            pivotRef.current.add(cameraRef.current);
            scene.add(pivotRef.current);
          }

          // Necesario para RectAreaLight
          RectAreaLightUniformsLib.init();

          // Renderer nice defaults
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;

          setIsReady(true);
        }}
      >
        {/* Luces */}
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[8, 12, 6]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-radius={4}
        />

        {/* IBL sin assets */}
        <Environment preset="studio" />

        {/* Sombras de contacto */}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} blur={2.5} far={25} />

        {/* Collidables base */}
        <Floor collidableMeshes={collidableMeshes} />
        <CurvedWallThick collidableMeshes={collidableMeshes} />

        {/* --- Galería: arcos, rampa, bóveda, cuadros --- */}
        <Arcade collidableMeshes={collidableMeshes} y={0} radius={10.5} span={3.2} count={8} />
        
        <Ramp collidableMeshes={collidableMeshes} innerRadius={7.8} width={3.2} angle={Math.PI * 0.9} rise={2.0} y={0.0} />

        {/* Cuadros en pared curva (hacia -Z) */}
        <Picture position={[-3.5, 2.1, -10.6]} seed={1} />
        <Picture position={[0.0,  2.1, -10.6]} seed={2} />
        <Picture position={[3.5,  2.1, -10.6]} seed={3} />

        {/* Controllers */}
        {isReady && cameraRef.current && pivotRef.current && (
          <>
            <MovementController
              camera={cameraRef.current}
              pivot={pivotRef.current}
              collidableMeshes={collidableMeshes}
            />
            <MouseLookController camera={cameraRef.current} pivot={pivotRef.current} />
          </>
        )}
      </Canvas>
    </div>
  );
};