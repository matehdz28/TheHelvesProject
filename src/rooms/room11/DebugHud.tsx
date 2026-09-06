import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { SHORE_Z, groundY } from "./layers";
import { PORTAL } from "./Portals";

/**
 * Lectura de coordenadas, TEMPORAL, para colocar cosas en la sala.
 *
 * Va en dos piezas porque la camara vive dentro del Canvas y el panel fuera:
 * la sonda lee la camara cada frame y escribe DIRECTAMENTE en el nodo del DOM,
 * sin pasar por el estado de React. Con setState a 60 fps se re-renderizaria
 * la sala entera sesenta veces por segundo solo para pintar unos numeros.
 */

/** Se monta DENTRO del Canvas. */
export function HudProbe({ target }: { target: RefObject<HTMLPreElement | null> }) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const el = target.current;
    if (!el) return;

    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);

    // yaw 0 = mirando a -Z (hacia el paisaje); crece girando a la izquierda
    const yaw = THREE.MathUtils.radToDeg(Math.atan2(-dir.x, -dir.z));
    const pitch = THREE.MathUtils.radToDeg(
      Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))
    );

    const zone = pos.z <= SHORE_Z ? "agua" : "prado";
    const toPortal = Math.hypot(
      pos.x - PORTAL.position.x,
      pos.z - PORTAL.position.z
    );

    const n = (v: number, w = 8) => v.toFixed(1).padStart(w);

    el.textContent =
      `x ${n(pos.x)}\n` +
      `y ${n(pos.y)}\n` +
      `z ${n(pos.z)}\n` +
      `\n` +
      `yaw   ${n(yaw, 6)}°\n` +
      `pitch ${n(pitch, 6)}°\n` +
      `\n` +
      `suelo ${n(groundY(pos.z), 6)}\n` +
      `zona  ${zone.padStart(6)}\n` +
      `portal${n(toPortal, 6)} m`;
  });

  return null;
}

/** Se monta FUERA del Canvas, encima de todo. */
export function HudPanel({ innerRef }: { innerRef: RefObject<HTMLPreElement | null> }) {
  return (
    <pre
      ref={innerRef}
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        margin: 0,
        padding: "8px 12px",
        font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#d8e6f0",
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 4,
        // tabulares: si no, los digitos bailan de ancho y el panel tiembla
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "pre",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 30,
      }}
    />
  );
}
