// Tipos base del placer

export type Vec3 = [number, number, number];

export type Instance = {
  id: string;
  key: string;
  position: Vec3;
  rotationY: number;
  scale: Vec3;
  color?: string;
};

export type PrefabDef = {
  key: string;
  label: string;
  // Componente R3F del prefab (puede aceptar color, opacity, etc.)
  Component: React.ComponentType<any>;
};

// Config opcional del provider
export type PrefabPlacerConfig = {
  toggleKey?: string; // abrir/cerrar menú (default: "u")
};