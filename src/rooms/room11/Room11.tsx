import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import House from "./House";
import Room11Controls from "./Room11Controls";
import Sky from "./Sky";
import Water from "./Water";
import Ridge from "./Ridge";
import { Portal, WaterTrigger, PortalApproach } from "./Portals";
import PaperRoom from "./paper/PaperRoom";
import Corridor from "./Corridor";
import { buildPath, makeConstrainer } from "./path";
import { HudProbe, HudPanel } from "./DebugHud";
import { NOISE_GLSL } from "./glsl";
import { useWind } from "../../audio/useWind";
import { useLoopTrack } from "../../audio/useLoopTrack";
import { useSeagulls } from "../../audio/useSeagulls";
import { useVoidAudio } from "../../audio/useVoidAudio";
import { usePaperAudio } from "../../audio/usePaperAudio";
import Birds, { PASSES } from "./birds/Birds";

const AMBIENCE = "/calle-bosque-del-eucalipto-1051.m4a";
const VOID_TRACK = "/calle-bosque-del-eucalipto-925.m4a";

/**
 * Audio del pasillo negro.
 *
 * `stutter` es el bucle de 2 s (3:46-3:48) a volumen bajo; con ganancia 0.36
 * queda unos 8 dB por debajo del ambiente del vacio, que es lo pedido.
 * `release` es la pista siguiendo desde el 3:48; termina en 4:45 y no en el
 * final real (4:49) para dejar cola con la que hacer el crossfade del bucle.
 */
const VOID_STUTTER = { start: 226, end: 228, gain: 0.36 };
const VOID_RELEASE = { start: 228, end: 285, gain: 0.9 };

/**
 * La sala de hojas usa la MISMA pista, desde 0:13. La coreografia del vortice
 * cuelga de su reloj: 0:28 se juntan, 0:59 orbitan y suben, 1:40 tornado.
 */
const PAPER_STARTS_AT = 13;
// primera pasada 0:02 → 0:34, y a partir de ahi se repite 0:05 → 0:34
const LOOP = { intro: 2, start: 5, end: 34 };
/**
 * Bucle del vacio: 1:21 → 1:30. Va con menos ganancia que el principal porque
 * ese tramo de la pista es 3.8 dB mas fuerte; sin compensar, el cambio daria
 * un salto de volumen en vez de una intensificacion.
 */
const VOID_LOOP = { start: 81, end: 90, gain: 0.70 };

/** Lectura de coordenadas. TEMPORAL: poner a false para quitarla. */
const SHOW_HUD = true;

/** Donde aparece el jugador, tomado de la lectura de coordenadas. */
const SPAWN = { x: -2.6, z: 0 };

const INTRO_TEXT = "Who are you when\nno one is watching?";
import {
  FLATS,
  BACK_FLATS,
  FOV,
  EYE,
  SHORE_Z,
  GRASS_BEHIND,
  GRASS_COLOR,
  GRASS_DARK,
  GRASS_YELLOW,
  SKY_HORIZON,
  groundY,
} from "./layers";

const HOUSE_Z = -40;
const HOUSE_X = 4;

/**
 * El sol.
 *
 * Viene de la derecha y algo por delante: asi el faldon rojo y la fachada
 * quedan al sol y el costado izquierdo en sombra, como en la foto.
 *
 * El target va montado con <primitive>: three usa target.matrixWorld para
 * orientar la luz y su camara de sombra, y esa matriz solo se actualiza si el
 * objeto esta en el grafo de la escena. Sin esto la luz apuntaria al origen y
 * la camara de sombra ni siquiera cubriria la casa.
 */
function Sun() {
  const light = useRef<THREE.DirectionalLight>(null!);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(HOUSE_X, groundY(HOUSE_Z), HOUSE_Z);
    return o;
  }, []);

  useEffect(() => {
    if (light.current) light.current.target = target;
  }, [target]);

  return (
    <>
      <primitive object={target} />
      <ambientLight intensity={0.52} />
      <directionalLight
        ref={light}
        position={[HOUSE_X + 62, 52, HOUSE_Z + 46]}
        intensity={0.82}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={190}
        shadow-bias={-0.0008}
        shadow-normalBias={0.05}
      />
    </>
  );
}

/**
 * Material del prado.
 *
 * Tres tonos mezclados por ruido: verde en sombra, verde medio y un agostado
 * amarillento. Va inyectado en el shader y no como textura repetida porque a
 * 900 x 500 m cualquier baldosa se leeria como patron; con ruido sobre la
 * posicion de mundo no se repite nunca.
 *
 * Dos detalles que lo hacen creible:
 *
 *  - VETAS: una octava muy estirada en X y comprimida en Z da el peinado
 *    horizontal de la hierba, que es lo que mas se nota en la referencia.
 *  - El grano fino se DESVANECE CON LA DISTANCIA. El ruido procedural no
 *    tiene mipmaps, asi que a lo lejos herviria con el movimiento de la
 *    camara; apagandolo mas alla de ~100 m el horizonte queda estable.
 *
 * Sigue siendo Lambert, no Basic, porque MeshBasicMaterial no puede recibir
 * la sombra de la casa.
 */
function useGrassMaterial() {
  return useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uDark = { value: new THREE.Color(GRASS_DARK) };
      shader.uniforms.uMid = { value: new THREE.Color(GRASS_COLOR) };
      shader.uniforms.uDry = { value: new THREE.Color(GRASS_YELLOW) };

      shader.vertexShader =
        "varying vec3 vWP;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n  vWP = (modelMatrix * vec4(position, 1.0)).xyz;"
        );

      shader.fragmentShader =
        "varying vec3 vWP;\nuniform vec3 uDark;\nuniform vec3 uMid;\nuniform vec3 uDry;\n" +
        NOISE_GLSL +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
           float broad  = fbm(vWP.xz * 0.010);
           float clump  = fbm(vWP.xz * 0.055 + 31.0);  // 'patch' es palabra reservada en GLSL
           float streak = fbm(vec2(vWP.x * 0.008, vWP.z * 0.19));

           float t = clamp(broad * 0.5 + clump * 0.34 + streak * 0.28, 0.0, 1.0);

           // Umbrales cenidos al rango REAL de t. Medido sobre el prado,
           // t va de 0.40 a 0.67 (mediana 0.53), no de 0 a 1: con umbrales
           // a 0..1 el 93% del campo salia del mismo tono medio y el prado
           // quedaba liso. Asi se reparte ~21% sombra / 63% medio / 16% seco.
           vec3 col = mix(uDark, uMid, smoothstep(0.40, 0.56, t));
           col = mix(col, uDry, smoothstep(0.54, 0.72, t));

           // grano de hierba, solo de cerca
           float near = 1.0 - smoothstep(25.0, 110.0, length(vWP - cameraPosition));
           float fine = fbm(vWP.xz * 1.7);
           float blade = fbm(vec2(vWP.x * 0.5, vWP.z * 6.0));
           col *= 1.0 + near * ((fine - 0.5) * 0.30 + (blade - 0.5) * 0.16);

           diffuseColor.rgb *= col;`
        );
    };
    return m;
  }, []);
}

/** Prado en pendiente hasta la orilla, con una ligera ondulacion. */
function useGrassGeometry() {
  return useMemo(() => {
    const width = 900;
    const from = GRASS_BEHIND;
    const segZ = 90;
    const segX = 40;
    const g = new THREE.PlaneGeometry(width, from - SHORE_Z, segX, segZ);
    g.rotateX(-Math.PI / 2);

    const pos = g.attributes.position;
    const midZ = (from + SHORE_Z) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) + midZ;
      const bump =
        Math.sin(x * 0.035 + z * 0.02) * 0.5 + Math.sin(z * 0.055) * 0.35;
      pos.setY(i, groundY(z) + bump);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, []);
}

/** Puente entre la escena 3D y el audio: cada frame le pasa al panner donde
 *  esta la bandada y donde y hacia donde mira el oyente. */
function SeagullListener({
  flock,
  update,
}: {
  flock: THREE.Vector3;
  update: (
    flock: THREE.Vector3,
    cam: THREE.Vector3,
    fwd: THREE.Vector3,
    up: THREE.Vector3
  ) => void;
}) {
  const cam = useRef(new THREE.Vector3()).current;
  const fwd = useRef(new THREE.Vector3()).current;
  const up = useRef(new THREE.Vector3()).current;

  useFrame(({ camera }) => {
    camera.getWorldPosition(cam);
    camera.getWorldDirection(fwd);
    up.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    update(flock, cam, fwd, up);
  });

  return null;
}

function Scene({
  pass,
  voided,
  paper,
  songTime,
  whiteEl,
  onArrive,
  onLeave,
  curve,
  hud,
  proximity,
  onEnterVoid,
  updateAudio,
}: {
  /** indice de la pasada activa, o -1 si no hay gaviotas ahora */
  pass: number;
  /** true una vez cruzado el portal negro */
  voided: boolean;
  /** true una vez atravesado el portal blanco */
  paper: boolean;
  songTime: React.MutableRefObject<number>;
  whiteEl: React.RefObject<HTMLDivElement | null>;
  onArrive: () => void;
  /** camino generado desde el punto de entrada al agua */
  curve: THREE.CatmullRomCurve3 | null;
  hud: React.RefObject<HTMLPreElement | null>;
  proximity: React.MutableRefObject<number>;
  onEnterVoid: () => void;
  onLeave: () => void;
  updateAudio: (
    flock: THREE.Vector3,
    cam: THREE.Vector3,
    fwd: THREE.Vector3,
    up: THREE.Vector3
  ) => void;
}) {
  const grass = useGrassGeometry();
  const grassMat = useGrassMaterial();

  // El vacio no es una escena aparte: se apaga el paisaje y queda el fondo
  // negro. Asi el jugador conserva su camara y sus controles sin recrear nada.
  if (paper) {
    return (
      <>
        <PaperRoom songTime={songTime} whiteEl={whiteEl} onArrive={onLeave} />
        {SHOW_HUD && <HudProbe target={hud} />}
      </>
    );
  }

  if (voided) {
    return (
      <>
        <color attach="background" args={["#000000"]} />
        {curve && <Corridor curve={curve} />}
        <Portal white />
        <PortalApproach
          proximity={proximity}
          whiteEl={whiteEl}
          onArrive={onArrive}
        />
        {SHOW_HUD && <HudProbe target={hud} />}
      </>
    );
  }

  return (
    <>
      <color attach="background" args={[SKY_HORIZON]} />

      <Sun />

      <Sky />

      {/* bastidores del paisaje, al frente */}
      {FLATS.map((f) => (
        <Ridge key={f.name} flat={f} />
      ))}

      {/* y a la espalda, girados para dar la cara */}
      {BACK_FLATS.map((f) => (
        <Ridge key={f.name} flat={f} rotated />
      ))}

      <Water />

      <mesh geometry={grass} material={grassMat} receiveShadow />

      <group position={[HOUSE_X, groundY(HOUSE_Z), HOUSE_Z]}>
        <House />
      </group>

      <Portal white={false} />
      <WaterTrigger onEnter={onEnterVoid} />

      {/* la key fuerza una simulacion nueva en cada pasada: vuelven a nacer
          a la izquierda en vez de continuar donde iban */}
      {pass >= 0 && <Birds key={pass} position={PASSES[pass].position} />}
      <SeagullListener
        flock={PASSES[Math.max(0, pass)].position}
        update={updateAudio}
      />

      {SHOW_HUD && <HudProbe target={hud} />}
    </>
  );
}

export default function Room11() {
  const navigate = useNavigate();
  const { status: audio, switchToAlt, fadeOut: stopAmbience } = useLoopTrack({
    src: AMBIENCE,
    intro: LOOP.intro,
    start: LOOP.start,
    end: LOOP.end,
    alt: VOID_LOOP,
    gain: 0.88, // la musica manda
  });

  // dos pasadas puntuales: una a los 10 s y otra a los 40 s, mas cerca
  const [pass, setPass] = useState(-1);
  useEffect(() => {
    const timers = PASSES.map((p, i) =>
      setTimeout(() => setPass(i), p.at * 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Al cruzar el portal negro se apaga el paisaje. El viento y las gaviotas
  // se van con el: en el vacio no hay de donde salgan.
  const [voided, setVoided] = useState(false);
  const [paper, setPaper] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const whiteEl = useRef<HTMLDivElement | null>(null);

  // cercania al portal 0..1, escrita desde la escena y leida por el audio
  const proximity = useRef(0);

  const { update: updateAudio } = useSeagulls({
    active: pass >= 0 && !voided,
    gain: 0.16,
  });
  useWind({ active: !voided, gain: 0.016 });

  const songTime = usePaperAudio({
    active: paper,
    src: VOID_TRACK,
    startAt: PAPER_STARTS_AT,
    gain: 0.85,
  });

  useVoidAudio(proximity, {
    src: VOID_TRACK,
    active: voided && !paper,
    stutter: VOID_STUTTER,
    release: VOID_RELEASE,
  });

  const hud = useRef<HTMLPreElement | null>(null);
  const [curve, setCurve] = useState<THREE.CatmullRomCurve3 | null>(null);
  const constrain = useRef<((p: THREE.Vector3) => void) | null>(null);

  /**
   * Entrada a la sala de hojas. La pantalla ya esta en blanco pleno cuando
   * esto corre: el blanqueo lo ha ido conduciendo la distancia al portal. Asi
   * que la mudanza de escena y la reubicacion pasan sin verse, y solo queda
   * retirar el blanco.
   */
  // el portal de las hojas lleva a la sala 99
  const leaveToRoom99 = useCallback(() => navigate("/room99"), [navigate]);

  const enterPaper = useCallback(() => {
    setPaper(true);
    // en la sala de hojas solo suena su pista: la 1051 se apaga aqui
    stopAmbience(1.2);
    pivot.current.position.set(0, EYE, 26);
    const el = whiteEl.current;
    if (el) {
      el.style.transition = "opacity 1.6s ease-out";
      el.style.opacity = "0";
    }
  }, [stopAmbience]);

  const enterVoid = useCallback(() => {
    // Sin teletransporte: el jugador sigue exactamente donde estaba, sobre el
    // agua. Solo se apaga el paisaje y el portal se vuelve blanco, asi que
    // camina hacia el mismo sitio que ya veia.
    // el camino nace donde el jugador toco el agua
    const c = buildPath(pivot.current.position.x);
    setCurve(c);
    constrain.current = makeConstrainer(c);

    setBlackout(true);
    setVoided(true);
    switchToAlt();
    window.setTimeout(() => setBlackout(false), 700);
  }, [switchToAlt]);

  const cam = useRef<THREE.PerspectiveCamera | null>(null);
  const pivot = useRef<THREE.Object3D>(new THREE.Object3D());
  const [ready, setReady] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: SKY_HORIZON,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: FOV, near: 0.5, far: 30000 }}
        onCreated={({ camera, scene, gl }) => {
          cam.current = camera as THREE.PerspectiveCamera;
          camera.position.set(0, 0, 0);
          pivot.current.position.set(SPAWN.x, groundY(SPAWN.z) + EYE, SPAWN.z);
          pivot.current.add(camera);
          scene.add(pivot.current);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
          setReady(true);
        }}
      >
        <Scene
          pass={pass}
          voided={voided}
          paper={paper}
          songTime={songTime}
          whiteEl={whiteEl}
          onArrive={enterPaper}
          onLeave={leaveToRoom99}
          curve={curve}
          hud={hud}
          proximity={proximity}
          onEnterVoid={enterVoid}
          updateAudio={updateAudio}
        />
        {ready && cam.current && (
          <Room11Controls
              camera={cam.current}
              pivot={pivot.current}
              constrain={paper ? undefined : constrain}
              flatGround={paper}
              songTime={paper ? songTime : undefined}
            />
        )}
      </Canvas>


      {/* blanco del portal: su opacidad la escribe PortalApproach cada frame */}
      <div
        ref={whiteEl}
        style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          opacity: 0,
          pointerEvents: "none",
          zIndex: 22,
        }}
      />

      {SHOW_HUD && <HudPanel innerRef={hud} />}

      {/* corte a negro del cruce: instantaneo al entrar, y se retira solo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000000",
          opacity: blackout ? 1 : 0,
          transition: blackout ? "none" : "opacity 1.2s ease-out",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />

      {audio === "waiting-gesture" && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: "center",
            font: "500 13px/1 system-ui, sans-serif",
            letterSpacing: "0.04em",
            color: "#5d5b55",
            pointerEvents: "none",
          }}
        >
          click para activar el sonido
        </div>
      )}
    </div>
  );
}
