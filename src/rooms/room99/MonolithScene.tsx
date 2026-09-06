import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import Monolith, { SKY, GROUND, ALL_SOLIDS, RISE_SECONDS, TOP } from "./Monolith";
import Elevator, { type ElevatorState } from "./Elevator";
import type { SolidSet } from "./solids";
import { makeGrainMap } from "./whiteTextures";
import Rooftop from "./Rooftop";

/**
 * Tercer acto: la maqueta de hormigon.
 *
 * Aqui, al reves que en el acto blanco, los materiales SI reciben luz. La
 * referencia es una fotografia: todo su dibujo sale de una unica luz dura
 * desde arriba y algo por delante, y de que cada cara caiga en un angulo
 * distinto.
 *
 * Los numeros NO son a ojo: estan despejados. Fijados los cuatro valores que
 * se miden en la referencia (remate 90%, frontal 70%, lateral 50%, sombra 35%,
 * en sRGB), y sabiendo que el hormigon #dedcd7 vale 0.730 en lineal, el
 * ambiente sale de la cara en sombra y cada componente de la luz de las otras
 * tres. De ahi: ambiente 0.138, direccional 1.065 y direccion (0.146, 0.883,
 * 0.447).
 *
 * El calculo solo se sostiene SIN mapeo de tonos. Con ACES los valores se
 * comprimen y el remate del 90% caeria al 66%: por eso el renderizador de esta
 * sala va en salida lineal.
 *
 * El target de la luz va montado con <primitive> porque three usa su
 * matrixWorld para orientar la camara de sombra, y esa matriz solo se
 * actualiza si el objeto esta en la escena.
 */
const DAY_SKY = new THREE.Color(SKY);
const NIGHT_SKY = new THREE.Color("#08040a");
/** la niebla de arriba tira a rojo: es el aire de la fiesta, no oscuridad */
const NIGHT_HAZE = new THREE.Color("#2a0a10");
const DAY_AMB = new THREE.Color("#ffffff");
const NIGHT_AMB = new THREE.Color("#ff6a48");

export default function MonolithScene({
  solids,
  elevator,
  run,
  startRisen = false,
  night,
  bands,
  time,
  onArrived,
}: {
  solids: React.MutableRefObject<SolidSet | null>;
  elevator: React.MutableRefObject<ElevatorState>;
  /**
   * La escena se monta ya durante el parpadeo, para que el material y las
   * sombras esten listos y no se note un tiron al encender. Pero el edificio
   * no empieza a salir hasta que hay alguien mirando: si contara desde el
   * parpadeo, el jugador se perderia los primeros metros a oscuras.
   */
  run: boolean;
  /** entrar con la maqueta ya levantada, para las rutas de prueba */
  startRisen?: boolean;
  /**
   * Cuanto se ha subido la escalera, de 0 a 1. Con ese mismo numero se hace
   * de noche: no hay un instante en que cambie la luz, sino que el dia se
   * apaga MIENTRAS subes, asi que la fiesta de arriba no aparece de golpe.
   */
  night: React.MutableRefObject<number>;
  /** grave, medio y agudo de lo que suena: mueve la fiesta */
  bands: React.MutableRefObject<{ bass: number; mid: number; high: number }>;
  time: React.MutableRefObject<number>;
  /** avisa cuando el ascensor corona: suelta al jugador */
  onArrived: () => void;
}) {
  const risen = useRef(startRisen ? RISE_SECONDS : 0);
  /** desplazamiento del grupo: lo leen la maqueta y los colisionadores */
  const rise = useRef(startRisen ? 0 : -TOP);
  const [done, setDone] = useState(startRisen);
  const scene = useThree((s) => s.scene);
  const amb = useRef<THREE.AmbientLight>(null!);
  const ground = useMemo(() => makeGrainMap(97), []);
  const light = useRef<THREE.DirectionalLight>(null!);

  // los solidos se publican con el desplazamiento actual del grupo: mientras
  // la maqueta emerge, sus cajas colisionan justo donde se ven
  useFrame((_, dt) => {
    if (run) risen.current = Math.min(RISE_SECONDS, risen.current + dt);
    const t = risen.current / RISE_SECONDS;
    const e = 1 - Math.pow(1 - t, 2.4);
    rise.current = -TOP * (1 - e);
    solids.current = { list: ALL_SOLIDS, offset: rise.current };
    // al coronar la maqueta, arranca el ascensor
    if (run && t >= 1 && !done) setDone(true);

    // La calibracion de hormigon del acto de dia se conserva INTACTA en n=0:
    // los valores despejados siguen siendo el extremo diurno, y la noche solo
    // interpola desde ahi.
    const n = THREE.MathUtils.smoothstep(night.current, 0.04, 0.92);
    if (scene.background instanceof THREE.Color)
      scene.background.copy(DAY_SKY).lerp(NIGHT_SKY, n);
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(DAY_SKY).lerp(NIGHT_HAZE, n);
      fog.density = THREE.MathUtils.lerp(0.0011, 0.0042, n);
    }
    if (light.current) light.current.intensity = THREE.MathUtils.lerp(1.065, 0.035, n);
    if (amb.current) {
      amb.current.intensity = THREE.MathUtils.lerp(0.138, 0.05, n);
      amb.current.color.copy(DAY_AMB).lerp(NIGHT_AMB, n);
    }
  });

  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 260, -40);
    return o;
  }, []);

  useEffect(() => {
    ground.repeat.set(60, 60);
    if (light.current) light.current.target = target;
  }, [ground, target]);

  const groundMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GROUND,
        roughness: 1,
        metalness: 0,
        map: ground,
      }),
    [ground]
  );

  return (
    <>
      <color attach="background" args={[SKY]} />
      {/* bruma minima: sin ella, el remate de una torre de 520 m recortaria
          con el mismo contraste que su base y se perderia la altura */}
      <fogExp2 attach="fog" args={[SKY, 0.0011]} />

      <ambientLight ref={amb} intensity={0.138} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        position={[131, 1054, 362]}
        intensity={1.065}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-420}
        shadow-camera-right={420}
        shadow-camera-top={420}
        shadow-camera-bottom={-420}
        shadow-camera-near={10}
        shadow-camera-far={1600}
        shadow-bias={-0.0006}
        shadow-normalBias={1.2}
      />
      {/* rebote debilisimo desde el lado opuesto: abre las sombras lo justo
          para que dentro de ellas siga viendose el grano */}
      <directionalLight position={[-300, 180, -260]} intensity={0.05} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={groundMat}>
        <planeGeometry args={[2400, 2400]} />
      </mesh>

      <Monolith rise={rise} />

      <Rooftop night={night} bands={bands} time={time} />

      <Elevator state={elevator} autoStart={done} onArrived={onArrived} />
    </>
  );
}
