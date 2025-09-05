import React, { useMemo } from "react";
import { BackgroundSquare } from "../../Components/BackgroundSquare";

interface CeciliaLavandaProps {
  count?: number;
  center?: [number, number, number];
  radius?: number;
  size?: [number, number];
  texturePath?: string;  // 70%
  texturePath2?: string; // 20%
  texturePath3?: string; // 10%
  ratio1?: number;
  ratio2?: number;
  ratio3?: number;
}

export const CeciliaLavanda: React.FC<CeciliaLavandaProps> = ({
  count = 30,
  center = [0, -2, 0],
  radius = 10,
  size = [2, 5],
  texturePath = "/Cecilia/lavandaImpre.png",
  texturePath2 = "/Cecilia/lavanda2Impre.png",
  texturePath3 = "/Cecilia/lavanda3Impre.png",
  ratio1 = 0.7,
  ratio2 = 0.2,
  ratio3 = 0.1,
}) => {
  const items = useMemo(() => {
    const arr: { pos: [number, number, number]; tex: string }[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let tex = texturePath;
      if (r >= ratio1 && r < ratio1 + ratio2) tex = texturePath2;
      else if (r >= ratio1 + ratio2) tex = texturePath3;

      const x = center[0] + (Math.random() - 0.5) * radius;
      let y = center[1] + 1;
      const z = center[2] + (Math.random() - 0.5) * radius;

      // Subir solo lavanda3
      if (tex === texturePath3) {
        y += 1; // súbelo 2 unidades, ajusta si quieres más o menos
      }

      arr.push({ pos: [x, y, z], tex });
    }
    return arr;
  }, [count, center, radius, ratio1, ratio2, texturePath, texturePath2, texturePath3]);

  return (
    <>
      {items.map((item, index) => (
        <BackgroundSquare
          key={index}
          texturePath={item.tex}
          position={item.pos}
          size={size}
        />
      ))}
    </>
  );
};
