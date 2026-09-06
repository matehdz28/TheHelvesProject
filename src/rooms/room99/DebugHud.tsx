import { useMemo, type RefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { supportAt, type SolidSet } from "./solids";
import { PLATFORM, type ElevatorState } from "./Elevator";
import { STAIR } from "./Stairs";

/**
 * Lectura de coordenadas, TEMPORAL.
 *
 * Ademas de la posicion muestra lo que hay bajo los pies y el estado del
 * ascensor: son los dos datos con los que se depura un recorrido, porque
 * dicen si estas apoyado en algo o cayendo, y si la plataforma te ha
 * detectado encima.
 *
 * Escribe directo en el nodo del DOM: por estado serian sesenta renders por
 * segundo de la sala entera para pintar unos numeros.
 */
export function HudProbe({
  target,
  solids,
  elevator,
}: {
  target: RefObject<HTMLPreElement | null>;
  solids?: RefObject<SolidSet | null>;
  elevator?: RefObject<ElevatorState>;
}) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const el = target.current;
    if (!el) return;

    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);

    const yaw = THREE.MathUtils.radToDeg(Math.atan2(-dir.x, -dir.z));
    const pitch = THREE.MathUtils.radToDeg(
      Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))
    );

    const set = solids?.current;
    const feet = pos.y - 1.7;
    const floor = set ? supportAt(set, pos.x, pos.z, feet) : 0;

    const e = elevator?.current;
    const onPlat =
      Math.abs(pos.x - PLATFORM.x) < PLATFORM.w / 2 &&
      Math.abs(pos.z - PLATFORM.z) < PLATFORM.d / 2;

    const n = (v: number, w = 8) => v.toFixed(1).padStart(w);

    el.textContent =
      `x ${n(pos.x)}\n` +
      `y ${n(pos.y)}\n` +
      `z ${n(pos.z)}\n` +
      `\n` +
      `yaw   ${n(yaw, 6)}°\n` +
      `pitch ${n(pitch, 6)}°\n` +
      `\n` +
      `suelo ${n(floor, 6)}\n` +
      `caida ${n(feet - floor, 6)}\n` +
      `\n` +
      `ascensor ${e ? n(e.y, 5) : "  --"}\n` +
      `  ${e?.going ? "subiendo" : onPlat ? "encima" : "parado"}\n` +
      `escalera ${n(STAIR.fromY, 5)} a ${STAIR.toY}`;
  });

  return null;
}

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
        color: "#e2e0db",
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
