import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

/** Puedes etiquetar múltiples portales si lo necesitas */
export type PortalId = string; // p.ej. "main"

type Cameras = {
  A: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  B: React.MutableRefObject<THREE.PerspectiveCamera | null>;
};

type Pivots = {
  A: React.MutableRefObject<THREE.Object3D>;
  B: React.MutableRefObject<THREE.Object3D>;
};

type Colliders = {
  A: React.MutableRefObject<THREE.Mesh[]>;
  B: React.MutableRefObject<THREE.Mesh[]>;
};

export type PortalState = {
  clip: string | null;
  transition: number; // 0..1
};

type PortalMap = Record<PortalId, PortalState>;

type Ctx = {
  cams: Cameras;
  pivots: Pivots;
  colliders: Colliders;

  activeSide: "A" | "B";
  setActive: (side: "A" | "B") => void;

  portals: PortalMap;
  setClip: (id: PortalId, clip: string | null) => void;
  startTransition: (id: PortalId) => void;
  tickTransition: (id: PortalId, step?: number) => boolean;

  /** Matrices de mundo de cada portal (no hooks adentro, solo objetos) */
  portalWorlds: React.MutableRefObject<Record<PortalId, THREE.Matrix4>>;

  /** Copia proyección/pose de A → B */
  syncCamBFromA: () => void;
};

const PortalContext = createContext<Ctx | null>(null);
export const usePortal = () => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within <PortalProvider>");
  return ctx;
};

/** Hook para “pedir”/usar el estado de un portal sin romper las Rules of Hooks */
export const usePortalState = (id: PortalId) => {
  const { portals, setClip, startTransition, tickTransition, portalWorlds } = usePortal();

  // Inicializa entrada si no existe (SOLO en efectos, no durante render)
  useEffect(() => {
    // si no existe estado, inicialízalo como invisible
    if (!portals[id]) {
      // usamos un “micro” setState en layout después del primer render
      // sin depender de hooks dinámicos
      // Nota: esto no viola reglas, ocurre dentro de useEffect
      setClip(id, "polygon(0 0, 0 0, 0 0, 0 0)");
    }
    if (!portalWorlds.current[id]) {
      portalWorlds.current[id] = new THREE.Matrix4();
    }
  }, [id, portals, setClip, portalWorlds]);

  const state: PortalState =
    portals[id] ?? { clip: "polygon(0 0, 0 0, 0 0, 0 0)", transition: 0 };
  const world = portalWorlds.current[id] ?? new THREE.Matrix4();

  return {
    state,
    world,
    setClip: (clip: string | null) => setClip(id, clip),
    start: () => startTransition(id),
    tick: (step?: number) => tickTransition(id, step),
  };
};

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 🔹 Refs: SIEMPRE declarar hooks de ref al tope (sin envolverlos en useMemo)
  const camA = useRef<THREE.PerspectiveCamera | null>(null);
  const camB = useRef<THREE.PerspectiveCamera | null>(null);
  const pivotA = useRef<THREE.Object3D>(new THREE.Object3D());
  const pivotB = useRef<THREE.Object3D>(new THREE.Object3D());
  const collA = useRef<THREE.Mesh[]>([]);
  const collB = useRef<THREE.Mesh[]>([]);

  // Agrupamos en objetos estables (esto SÍ puede ir en useMemo,
  // pero OJO: NO se crean hooks dentro del useMemo, solo se empaquetan refs ya creadas)
  const cams = useMemo<Cameras>(() => ({ A: camA, B: camB }), []);
  const pivots = useMemo<Pivots>(() => ({ A: pivotA, B: pivotB }), []);
  const colliders = useMemo<Colliders>(() => ({ A: collA, B: collB }), []);

  // 🔹 Estado global
  const [activeSide, setActiveSide] = useState<"A" | "B">("A");
  const [portals, setPortals] = useState<PortalMap>({});

  // Matrices por portal (mutable, sin hooks dinámicos)
  const portalWorlds = useRef<Record<PortalId, THREE.Matrix4>>({});

  // 🔹 Updaters portal
  const setClip = useCallback((id: PortalId, clip: string | null) => {
    setPortals((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { clip: null, transition: 0 }), clip },
    }));
  }, []);

  const startTransition = useCallback((id: PortalId) => {
    setPortals((p) => ({
      ...p,
      [id]: { ...(p[id] ?? { clip: null, transition: 0 }), transition: 0.001 },
    }));
  }, []);

  const tickTransition = useCallback((id: PortalId, step = 0.06) => {
    let finished = false;
    setPortals((p) => {
      const cur = p[id] ?? { clip: null, transition: 0 };
      if (cur.transition >= 1) {
        finished = true;
        return p;
      }
      const t = Math.min(1, cur.transition + step);
      if (t >= 1) finished = true;
      return { ...p, [id]: { ...cur, transition: t } };
    });
    return finished;
  }, []);

  // 🔹 Sincronizar cámaras
  const syncCamBFromA = useCallback(() => {
    const a = camA.current;
    const b = camB.current;
    if (!a || !b) return;
    b.matrixWorld.copy(a.matrixWorld);
    b.matrixWorld.decompose(b.position, b.quaternion, new THREE.Vector3());
    b.projectionMatrix.copy(a.projectionMatrix);
  }, []);

  const value: Ctx = {
    cams,
    pivots,
    colliders,
    activeSide,
    setActive: setActiveSide,
    portals,
    setClip,
    startTransition,
    tickTransition,
    portalWorlds,
    syncCamBFromA,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
};