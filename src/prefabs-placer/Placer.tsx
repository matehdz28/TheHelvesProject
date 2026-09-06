import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { usePrefabPlacer } from "./Provider";
import type { Vec3 } from "./types";

/** Ghost + colocar con click + flechas/QE + escala (-/=) */
export const PrefabPlacer: React.FC<{ floor?: THREE.Object3D | null }> = ({ floor }) => {
  const { camera, gl } = useThree();
  const {
    uiOpen,
    selectedKey,
    prefabs,
    addInstance,
    setSelectedInstanceId,
    setSelectedKey, // para cortar el modo colocar
  } = usePrefabPlacer();

  const active = React.useMemo(
    () => (!uiOpen && selectedKey ? prefabs.find((p) => p.key === selectedKey) ?? null : null),
    [uiOpen, selectedKey, prefabs]
  );

  const raycaster = React.useMemo(() => new THREE.Raycaster(), []);
  const plane = React.useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const mouse = React.useRef(new THREE.Vector2());

  const [pos, setPos] = React.useState<Vec3 | null>(null);
  const [rotY, setRotY] = React.useState(0);
  const [snap, setSnap] = React.useState(true);
  const [scale, setScale] = React.useState(1);

  // mover ghost
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!active) return;
      mouse.current.x = (e.clientX / gl.domElement.clientWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / gl.domElement.clientHeight) * 2 + 1;
      raycaster.setFromCamera(mouse.current, camera);

      let hit: THREE.Vector3 | null = null;
      if (floor) {
        const is = raycaster.intersectObject(floor, true);
        if (is.length) hit = is[0].point;
      } else {
        const p = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, p);
        hit = p;
      }
      if (hit) {
        let x = hit.x, y = pos ? pos[1] : 0, z = hit.z;
        if (snap) { const s = 1; x = Math.round(x/s)*s; z = Math.round(z/s)*s; }
        setPos([x, y, z]);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [active, camera, gl, plane, raycaster, snap, floor, pos]);

  // click coloca; teclas mueven ghost/rotan/escalan
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!active || !pos) return;
      if (e.button === 0) {
        const id = addInstance({
          key: active.key,
          position: pos,
          rotationY: rotY,
          scale: [scale, scale, scale], // vector uniforme
        });

        setSelectedInstanceId(id); // entra a edición
        setSelectedKey(null);      // corta modo colocar (ghost fuera)
        setPos(null);
        document.exitPointerLock?.(); // libera pointer lock para que Enter funcione
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      const k = e.key;
      const lower = k.toLowerCase();
      const big = e.shiftKey;
      const step = big ? 0.5 : 0.1;
      const stepY = big ? 0.5 : 0.1;
      const stepS = big ? 0.2 : 0.05;

      if (lower === "r") setRotY((r) => r + Math.PI / 12);
      if (lower === "g") setSnap((s) => !s);
      if (k === "Escape") { setPos(null); return; }

      if (pos) {
        let [x, y, z] = pos;
        if (k === "ArrowUp")    z -= step;
        if (k === "ArrowDown")  z += step;
        if (k === "ArrowLeft")  x -= step;
        if (k === "ArrowRight") x += step;
        if (lower === "q") y -= stepY;
        if (lower === "e") y += stepY;
        if (snap) { const s = 1; x = Math.round(x/s)*s; z = Math.round(z/s)*s; }
        setPos([x, y, z]);
      }
      if (k === "-" || k === "_") setScale((s) => Math.max(0.05, s - stepS));
      if (k === "=" || k === "+") setScale((s) => Math.min(10, s + stepS));
    };

    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, pos, rotY, scale, addInstance, setSelectedInstanceId, setSelectedKey, snap]);

  if (!active || !pos) return null;
  const Ghost = active.Component as any;
  return (
    <group>
      <group position={pos} rotation={[0, rotY, 0]} scale={[scale, scale, scale]}>
        <Ghost opacity={0.6} />
      </group>
      <mesh position={pos}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
        <meshBasicMaterial color="#222" transparent opacity={0.25} />
      </mesh>
    </group>
  );
};

export default PrefabPlacer;