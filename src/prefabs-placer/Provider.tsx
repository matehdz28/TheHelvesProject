import React from "react";
import type { Instance, PrefabDef, PrefabPlacerConfig, Vec3 } from "./types";

// ⚠️ Evita dependencias cíclicas: Provider NO debe importar Placer.tsx ni el barrel.

type Ctx = {
  // UI
  uiOpen: boolean;
  setUiOpen: (b: boolean) => void;

  // Menú de prefabs
  prefabs: PrefabDef[];
  selectedKey: string | null;
  setSelectedKey: (k: string | null) => void;

  // Instancias colocadas
  instances: Instance[];
  addInstance: (i: Omit<Instance, "id">) => string;
  updateInstance: (id: string, patch: Partial<Instance>) => void;
  removeInstance: (id: string) => void;

  // Selección/edición
  selectedInstanceId: string | null;
  setSelectedInstanceId: (id: string | null) => void;

  // Config
  config: Required<PrefabPlacerConfig>;
};

// Creamos context con forma estable
const PrefabPlacerContext = React.createContext<Ctx | null>(null);

// Hook estable (siempre exportamos esta función)
export function usePrefabPlacer(): Ctx {
  const ctx = React.useContext(PrefabPlacerContext);
  if (!ctx) throw new Error("usePrefabPlacer must be used within PrefabPlacerProvider");
  return ctx;
}

type ProviderProps = React.PropsWithChildren<{
  prefabs?: PrefabDef[];          // Puedes inyectar tu lista aquí
  config?: PrefabPlacerConfig;    // { toggleKey?: "u" }
}>;

export const PrefabPlacerProvider: React.FC<ProviderProps> = ({
  children,
  prefabs: prefabsProp,
  config: configProp,
}) => {
  // ===== Estado UI
  const [uiOpen, setUiOpen] = React.useState(false);

  // ===== Lista de prefabs (inyectable o default)
  const defaultPrefabs = React.useMemo<PrefabDef[]>(() => {
    // Para evitar HMR raro, no resolvemos dinámico aquí; registra a mano tus prefabs.
    // Ejemplo: import { Cube } from "../prefabs/Cube"; import { Sphere } from "../prefabs/Sphere";
    return prefabsProp ?? [];
  }, [prefabsProp]);

  // ===== Key del prefab seleccionado en el menú
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  // ===== Instancias colocadas
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = React.useState<string | null>(null);

  const addInstance = React.useCallback((i: Omit<Instance, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setInstances((prev) => [...prev, { id, ...i }]);
    return id;
  }, []);

  const updateInstance = React.useCallback((id: string, patch: Partial<Instance>) => {
    setInstances((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeInstance = React.useCallback((id: string) => {
    setInstances((prev) => prev.filter((it) => it.id !== id));
    // si estaba seleccionada, deseleccionar
    setSelectedInstanceId((sel) => (sel === id ? null : sel));
  }, []);

  // ===== Config estable (tecla para abrir menú)
  const config = React.useMemo<Required<PrefabPlacerConfig>>(
    () => ({
      toggleKey: (configProp?.toggleKey ?? "u") as string,
    }),
    [configProp?.toggleKey]
  );

  // Hotkey para abrir/cerrar menú
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === config.toggleKey.toLowerCase()) {
        setUiOpen((o) => !o);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config.toggleKey]);

  const value = React.useMemo<Ctx>(
    () => ({
      uiOpen,
      setUiOpen,
      prefabs: defaultPrefabs,
      selectedKey,
      setSelectedKey,
      instances,
      addInstance,
      updateInstance,
      removeInstance,
      selectedInstanceId,
      setSelectedInstanceId,
      config,
    }),
    [
      uiOpen,
      defaultPrefabs,
      selectedKey,
      instances,
      addInstance,
      updateInstance,
      removeInstance,
      selectedInstanceId,
      config,
    ]
  );

  return <PrefabPlacerContext.Provider value={value}>{children}</PrefabPlacerContext.Provider>;
};

// UI mínima del palette (DOM normal, fuera del Canvas)
export const PrefabPalette: React.FC = () => {
  const { uiOpen, setUiOpen, prefabs, selectedKey, setSelectedKey } = usePrefabPlacer();
  if (!uiOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 40,
        background: "rgba(255,255,255,.96)",
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,.08)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <strong>Prefabs</strong>
        <button onClick={() => setUiOpen(false)} style={{ marginLeft: "auto" }}>
          cerrar
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(90px, 1fr))", gap: 8 }}>
        {prefabs.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelectedKey(p.key)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: selectedKey === p.key ? "2px solid #111" : "1px solid #ccc",
              background: selectedKey === p.key ? "#eef2ff" : "#fff",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        Click en un prefab y cierra el menú con “U” para colocarlo.
      </div>
    </div>
  );
};