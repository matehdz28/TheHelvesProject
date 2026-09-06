import { useMemo, type ReactElement } from "react";
import { SPANS, START_Z, END_Z, makeRandom } from "./layout";
import LightShaft, { LightPool } from "./LightShaft";

/**
 * La arquitectura del recorrido, generada desde el trazado.
 *
 * Los umbrales entre tramos se construyen con tres piezas: dos jambas y un
 * dintel. Sin ellos, al pasar de una nave ancha a un pasillo estrecho se veria
 * el hueco al vacio por los lados; con el muro, el pasillo se lee como una
 * puerta al fondo y tira del jugador hacia delante.
 *
 * `bay.height` es la altura REAL del techo. Todo lo que cuelga se situa por
 * debajo de ella: colocar algo por encima equivale a esconderlo tras el techo.
 */
const DARK = "#151a1f";
const DARKER = "#0e1216";
const FLOOR = "#39434b";

function Box({
  size,
  position,
  rotation,
  color = DARK,
}: {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

export default function Segments() {
  const pieces = useMemo(() => {
    const rnd = makeRandom(4021);
    const walls: ReactElement[] = [];
    const props: ReactElement[] = [];
    const shafts: ReactElement[] = [];
    let key = 0;

    SPANS.forEach((s, i) => {
      const { bay, from, to } = s;
      const mid = (from + to) / 2;
      const len = bay.length;

      // muros laterales y techo del tramo
      walls.push(
        <Box key={key++} size={[1.5, bay.height, len]} position={[-bay.half, bay.height / 2, mid]} color={DARK} />,
        <Box key={key++} size={[1.5, bay.height, len]} position={[bay.half, bay.height / 2, mid]} color={DARK} />
      );
      walls.push(
        <mesh key={key++} rotation={[Math.PI / 2, 0, 0]} position={[0, bay.height, mid]}>
          <planeGeometry args={[bay.half * 2, len]} />
          <meshLambertMaterial color={DARKER} />
        </mesh>
      );

      // umbral hacia el tramo siguiente
      const next = SPANS[i + 1];
      if (next) {
        const w = bay.half;
        const nw = next.bay.half;
        const nh = next.bay.height;
        const side = w - nw;
        if (side > 0.2) {
          walls.push(
            <Box key={key++} size={[side, bay.height, 1.6]} position={[-(nw + side / 2), bay.height / 2, to]} color={DARKER} />,
            <Box key={key++} size={[side, bay.height, 1.6]} position={[nw + side / 2, bay.height / 2, to]} color={DARKER} />
          );
        }
        if (bay.height > nh + 0.2) {
          walls.push(
            <Box key={key++} size={[nw * 2, bay.height - nh, 1.6]} position={[0, (nh + bay.height) / 2, to]} color={DARKER} />
          );
        }
      }

      if (bay.kind === "hall") {
        // columnas a ambos lados
        const cols = Math.max(2, Math.floor(len / 22));
        for (let c = 0; c < cols; c++) {
          const cz = from - (len * (c + 0.5)) / cols;
          for (const sx of [-1, 1]) {
            props.push(
              <Box key={key++} size={[2.2, bay.height, 2.2]} position={[sx * (bay.half - 5), bay.height / 2, cz]} color={DARKER} />
            );
          }
        }
        // estructura colgada
        props.push(
          <Box key={key++} size={[bay.half * 0.6, 2.6, 7]} position={[bay.half * 0.45, bay.height * 0.72, mid + len * 0.2]} color={DARKER} />,
          <Box key={key++} size={[1, 6, 1]} position={[bay.half * 0.2, bay.height * 0.72 - 4, mid + len * 0.2]} color={DARKER} />
        );

        // haces: todos con la misma inclinacion, para que se lea una sola luz
        const n = 2;
        for (let k = 0; k < n; k++) {
          const sz = from - (len * (k + 0.35)) / n;
          const x0 = -bay.half * 0.8;
          shafts.push(
            <LightShaft
              key={key++}
              from={[x0, bay.height * 0.98, sz - 16]}
              to={[x0 + 26, 0, sz + 12]}
              width={4.5 + rnd() * 2.5}
              intensity={0.3 + rnd() * 0.2}
            />
          );
          shafts.push(<LightPool key={key++} at={[x0 + 26, sz + 12]} size={9 + rnd() * 4} intensity={0.4 + rnd() * 0.2} />);
        }
      } else {
        // pasillo: luces cenitales espaciadas, que marcan el avance
        const lamps = Math.max(2, Math.floor(len / 12));
        for (let k = 0; k < lamps; k++) {
          const lz = from - (len * (k + 0.5)) / lamps;
          shafts.push(
            <LightShaft key={key++} from={[0, bay.height * 0.98, lz]} to={[0, 0, lz]} width={2.6} intensity={0.42} />
          );
          shafts.push(<LightPool key={key++} at={[0, lz]} size={5} intensity={0.5} />);
          props.push(
            <Box key={key++} size={[2.4, 0.35, 0.9]} position={[0, bay.height - 0.35, lz]} color={DARKER} />
          );
        }
        // tuberias a lo largo del techo
        props.push(
          <Box key={key++} size={[0.5, 0.5, len * 0.92]} position={[-bay.half + 1.6, bay.height - 0.9, mid]} color={DARKER} />,
          <Box key={key++} size={[0.35, 0.35, len * 0.92]} position={[bay.half - 1.4, bay.height - 1.7, mid]} color={DARKER} />
        );
      }

      // escombro por el suelo
      const debris = bay.kind === "hall" ? 10 : 4;
      for (let d = 0; d < debris; d++) {
        props.push(
          <Box
            key={key++}
            size={[0.3 + rnd() * 0.5, 0.12, 2 + rnd() * 4]}
            position={[(rnd() - 0.5) * bay.half * 1.5, 0.07, from - rnd() * len]}
            rotation={[0, rnd() * Math.PI, 0]}
            color={DARKER}
          />
        );
      }
    });

    return { walls, props, shafts };
  }, []);

  return (
    <>
      {/* suelo continuo de todo el recorrido */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (START_Z + END_Z) / 2]}>
        <planeGeometry args={[120, START_Z - END_Z + 40]} />
        <meshLambertMaterial color={FLOOR} />
      </mesh>

      {/* muro del fondo, cierra el recorrido */}
      <Box size={[80, 60, 2]} position={[0, 30, END_Z - 2]} color={DARKER} />

      {pieces.walls}
      {pieces.props}
      {pieces.shafts}
    </>
  );
}
