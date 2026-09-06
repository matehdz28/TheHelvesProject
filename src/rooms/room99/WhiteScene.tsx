import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makeConcrete, makeGround, makeSkyGradient } from "./whiteTextures";
import Colossus from "./Colossus";

/**
 * La sala despues del apagon: blanca, y de ella emerge una estructura.
 *
 * Materiales PLANOS, cara a cara, sin iluminacion. La referencia es pintura,
 * no fotografia: lo que separa los volumenes no es una sombra calculada sino
 * un cambio de color entre caras. Con luz real aparecerian degradados y se
 * perderia ese aire de oleo.
 *
 * La escena se descubre en tres tiempos que corren a la vez pero a distinto
 * ritmo: la estructura sale del suelo, el cielo vira de blanco a verde azulado
 * y la esfera aparece la ultima. Al no coincidir, el ojo no lo lee como un
 * corte sino como algo que se va revelando.
 *
 * Las sombras van PINTADAS, no calculadas. Con mapas de sombra apareceria un
 * borde nitido y un degradado, y aqui todo lo demas es plano: la mancha oscura
 * en el suelo, con su forma dibujada a mano, es lo que casa con el oleo.
 */
const GROUND = "#e9edc4";
const LIT = "#eff2cd";
const SIDE = "#dfe4b3";
const SHADE = "#c3cd93";
const DEEP = "#0e1c2b";
const SKY_END = "#1a6a70";
const SPHERE = "#2a72cf";
const POOL = "#4d7c2e";

const RISE_SECONDS = 9;
const SKY_SECONDS = 13;
const SPHERE_AT = 7;

/** caja pintada cara a cara: +x, -x, +y, -y, +z, -z */
function Slab({
  size,
  position,
  top = LIT,
  front = LIT,
  side = SIDE,
  back = SHADE,
}: {
  size: [number, number, number];
  position: [number, number, number];
  top?: string;
  front?: string;
  side?: string;
  back?: string;
}) {
  const mats = useMemo(
    () =>
      [side, shadeOf(side), top, back, front, back].map(
        (c, i) =>
          new THREE.MeshBasicMaterial({
            color: c,
            // la brocha corre en vertical: en la cara superior no procede
            map: i === 2 ? null : makeConcrete(c, 5 + i * 7),
          })
      ),
    [side, top, back, front]
  );
  return (
    <mesh position={position} material={mats}>
      <boxGeometry args={size} />
    </mesh>
  );
}

function shadeOf(hex: string) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(0.82);
  return `#${c.getHexString()}`;
}

export default function WhiteScene({ onStep }: { onStep: (d: number) => void }) {
  const risen = useRef<THREE.Group>(null!);
  const sphere = useRef<THREE.Mesh>(null!);
  const elapsed = useRef(0);

  const skyFrom = useMemo(() => new THREE.Color("#ffffff"), []);
  const skyTo = useMemo(() => new THREE.Color(SKY_END), []);
  const sky = useMemo(() => new THREE.Color("#ffffff"), []);

  const groundTex = useMemo(() => makeGround(GROUND), []);
  const skyTex = useMemo(() => makeSkyGradient("#12585f", "#2c8085"), []);
  const dome = useRef<THREE.Mesh>(null!);
  const domeMat = useRef<THREE.MeshBasicMaterial | null>(null);

  const sphereMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: SPHERE, transparent: true, opacity: 0 }),
    []
  );

  useFrame(({ scene }, dt) => {
    elapsed.current += dt;
    const t = elapsed.current;

    // la estructura sube del suelo, frenando al final
    const r = Math.min(1, t / RISE_SECONDS);
    const eased = 1 - Math.pow(1 - r, 3);
    if (risen.current) risen.current.position.y = -34 * (1 - eased);

    // el cielo vira despacio de blanco a verde azulado
    const s = Math.min(1, t / SKY_SECONDS);
    const se = s * s * (3 - 2 * s);
    sky.copy(skyFrom).lerp(skyTo, se);
    if (scene.background instanceof THREE.Color) scene.background.copy(sky);
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(sky);

    // la cupula aparece con el mismo ritmo, encima del fondo plano
    if (dome.current) {
      const m = dome.current.material as THREE.MeshBasicMaterial;
      if (!domeMat.current) {
        domeMat.current = m;
        m.transparent = true;
      }
      m.opacity = se;
    }

    // y la esfera se asoma cuando el cielo ya tiene color
    const o = THREE.MathUtils.clamp((t - SPHERE_AT) / 4, 0, 1);
    sphereMat.opacity = o;
    if (sphere.current) sphere.current.position.y = 44 + (1 - o) * 6;
  });

  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      {/* niebla muy suave: solo redondea el horizonte, no oculta */}
      <fogExp2 attach="fog" args={["#ffffff", 0.0032]} />

      {/* explanada, con juntas de losa: sin ellas el suelo no tiene escala */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshBasicMaterial color={GROUND} map={groundTex} />
      </mesh>

      {/* Sombras pintadas. Los materiales son planos y sin luz, asi que estas
          manchas son lo unico que ancla los volumenes al suelo. */}
      <mesh rotation={[-Math.PI / 2, 0, 0.06]} position={[6, 0.02, -50]}>
        <planeGeometry args={[62, 30]} />
        <meshBasicMaterial color="#b3bd86" transparent opacity={0.75} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.04]} position={[64, 0.02, -56]}>
        <planeGeometry args={[26, 22]} />
        <meshBasicMaterial color="#b3bd86" transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-34, 0.02, -50]}>
        <planeGeometry args={[34, 16]} />
        <meshBasicMaterial color="#bcc590" transparent opacity={0.6} />
      </mesh>

      {/* la balsa verde del primer plano */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-26, 0.03, 6]}>
        <planeGeometry args={[34, 15]} />
        <meshBasicMaterial color={POOL} />
      </mesh>

      {/* cupula del cielo: el degradado vertical de la referencia */}
      <mesh ref={dome} scale={[-1, 1, 1]}>
        <sphereGeometry args={[560, 40, 24]} />
        <meshBasicMaterial map={skyTex} fog={false} side={THREE.BackSide} />
      </mesh>

      <Colossus onStep={onStep} />

      <mesh ref={sphere} position={[34, 44, -120]} material={sphereMat}>
        <sphereGeometry args={[6.5, 32, 24]} />
      </mesh>

      {/* Todo lo construido cuelga de este grupo: sube entero desde debajo
          del suelo, asi emerge como una sola pieza y no por partes. */}
      <group ref={risen} position={[0, -34, 0]}>
        {/* masa principal */}
        <Slab size={[46, 20, 30]} position={[-14, 10, -78]} />
        <Slab size={[26, 11, 20]} position={[-20, 25.5, -82]} />
        <Slab size={[13, 9, 14]} position={[8, 15, -70]} side={SHADE} front={SIDE} />

        {/* el hueco oscuro bajo el voladizo, lo que da la profundidad */}
        <mesh position={[-16, 4.6, -63.6]}>
          <boxGeometry args={[40, 9.2, 2]} />
          <meshBasicMaterial color={DEEP} />
        </mesh>

        {/* muro bajo de la izquierda */}
        <Slab size={[30, 15, 6]} position={[-52, 7.5, -60]} front={SIDE} side={SHADE} />

        {/* losa alta de la derecha */}
        <Slab size={[20, 27, 18]} position={[46, 13.5, -74]} />

        {/* ventanucos: solo dos, como en la referencia */}
        <mesh position={[-24, 17.5, -62.9]}>
          <boxGeometry args={[2.4, 2.2, 0.4]} />
          <meshBasicMaterial color={DEEP} />
        </mesh>
        <mesh position={[-17, 17.5, -62.9]}>
          <boxGeometry args={[1.6, 2.2, 0.4]} />
          <meshBasicMaterial color={DEEP} />
        </mesh>
        <mesh position={[52, 3.2, -64.9]}>
          <boxGeometry args={[2.6, 1.8, 0.4]} />
          <meshBasicMaterial color={DEEP} />
        </mesh>
      </group>
    </>
  );
}
