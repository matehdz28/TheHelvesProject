import Sheets from "./Sheets";
import PaperPortal from "./PaperPortal";

/**
 * La sala de hojas.
 *
 * Fondo oscuro y calido con niebla del mismo tono: eso hace que las hojas
 * lejanas se disuelvan en vez de recortarse contra el negro, y da profundidad
 * a un espacio que por lo demas es una alfombra de papel.
 *
 * La luz viene de arriba y de frente. Importa que sea direccional: al volar,
 * cada hoja gira y va cambiando de brillo, y ese parpadeo es lo que hace que
 * se lea el movimiento.
 */
export const PAPER_BG = "#0d0c0a";
export const PAPER_FLOOR_Y = 0;

export default function PaperRoom({
  songTime,
  whiteEl,
  onArrive,
}: {
  songTime: React.MutableRefObject<number>;
  whiteEl?: React.RefObject<HTMLDivElement | null>;
  onArrive?: () => void;
}) {
  return (
    <>
      <color attach="background" args={[PAPER_BG]} />
      <fogExp2 attach="fog" args={[PAPER_BG, 0.016]} />

      <ambientLight intensity={0.42} />
      <directionalLight position={[16, 34, 20]} intensity={1.05} />
      {/* contraluz tenue: despega del fondo las hojas que quedan de espaldas */}
      <directionalLight position={[-22, 12, -26]} intensity={0.3} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PAPER_FLOOR_Y - 0.01, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshLambertMaterial color="#1a1714" />
      </mesh>

      <Sheets songTime={songTime} floorY={PAPER_FLOOR_Y} />

      <PaperPortal
        songTime={songTime}
        whiteEl={whiteEl}
        onArrive={onArrive}
        floorY={PAPER_FLOOR_Y}
      />
    </>
  );
}
