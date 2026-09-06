import React from "react";
import { usePrefabPlacer } from "./Provider";

export const PrefabPalette: React.FC = () => {
  const { prefabs, uiOpen, setUiOpen, selectedKey, setSelectedKey } = usePrefabPlacer();
  if (!uiOpen) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,255,255,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: 540,
          maxHeight: "70vh",
          overflow: "auto",
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 12px 40px rgba(0,0,0,.12)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Prefabs</h3>
          <button onClick={() => setUiOpen(false)} style={{ padding: "6px 10px" }}>
            Cerrar (U)
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {prefabs.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedKey(p.key)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: p.key === selectedKey ? "2px solid #111" : "1px solid #ddd",
                background: p.key === selectedKey ? "#f0f2f5" : "#fff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{p.key.split("/").pop()}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Selecciona un prefab. Cierra con <b>U</b> y haz click en el piso para colocar.  
          Atajos: <b>R</b> rotar, <b>G</b> snap, <b>Esc</b> cancelar.
        </div>
      </div>
    </div>
  );
};