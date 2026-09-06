import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import Segments from "./Segments";
import Entities from "./Entities";
import { LAST_BAY_Z } from "./layout";

/** Avisa una sola vez al pisar el ultimo tramo. */
function LastBayTrigger({ onEnter }: { onEnter: () => void }) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const fired = useRef(false);

  useFrame(({ camera }) => {
    if (fired.current) return;
    camera.getWorldPosition(pos);
    if (pos.z <= LAST_BAY_Z) {
      fired.current = true;
      onEnter();
    }
  });

  return null;
}

/**
 * Nave industrial en penumbra, al modo de la referencia.
 *
 * Lo que produce ese aspecto no es la geometria, que es simple, sino tres
 * cosas juntas:
 *
 *  1. NIEBLA MUY DENSA del mismo color que el fondo. Todo lo lejano se
 *     disuelve en el mismo tono, y eso separa los planos por valor en vez de
 *     por detalle. Es lo que da la profundidad.
 *  2. Todo el volumen en tonos MUY OSCUROS. Al fundirse con una niebla clara,
 *     cada objeto se lee como silueta recortada, no como superficie.
 *  3. Los haces de luz, que son lo unico brillante y ademas lo unico que
 *     define de donde viene la luz.
 *
 * El resultado depende de que los objetos sean casi negros: si se aclaran, la
 * niebla deja de recortarlos y todo se vuelve una sopa gris.
 */
export const FOG = "#93a2ac";
export const FOG_DENSITY = 0.021;

export default function Scene({ onLastBay }: { onLastBay: () => void }) {
  return (
    <>
      <color attach="background" args={[FOG]} />
      <fogExp2 attach="fog" args={[FOG, FOG_DENSITY]} />

      {/* Ambiente alto y direccional debil: aqui no se busca modelado, se
          busca que todo quede plano y oscuro para que recorte contra la
          niebla. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[38, 40, 18]} intensity={0.5} />

      <Segments />
      <Entities />
      <LastBayTrigger onEnter={onLastBay} />
    </>
  );
}
