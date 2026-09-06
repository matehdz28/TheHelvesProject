import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import Scene, { FOG } from "./Scene";
import WhiteScene from "./WhiteScene";
import MonolithScene from "./MonolithScene";
import type { SolidSet } from "./solids";
import type { ElevatorState } from "./Elevator";
import { HudProbe, HudPanel } from "./DebugHud";
import Room99Controls, { EYE } from "./Room99Controls";
import { useLoopTrack } from "../../audio/useLoopTrack";
import { usePaperAudio } from "../../audio/usePaperAudio";
import { useAscentTrack } from "../../audio/useAscentTrack";
import { useWind } from "../../audio/useWind";
import AscentProbe from "./AscentProbe";
import Trip from "./Trip";
import { PLATFORM } from "./Elevator";
import { ROOF_Y } from "./Monolith";
import { STAIR } from "./Stairs";
import { useLightOff } from "../../audio/useLightOff";
import { useFootstep } from "../../audio/useFootstep";
import { useNavigate } from "react-router-dom";
import Ripples from "../../Components/Ripples";
import TunnelLight from "../../Components/TunnelLight";

/**
 * Sala 99. Se llega desde el portal de la sala de hojas.
 *
 * El audio reutiliza el gancho de bucle del proyecto: la ventana 0:02 → 3:59
 * lleva su crossfade en la costura, que aqui hacia falta de verdad (el corte
 * crudo saltaba 76 veces la pendiente de la senal, o sea un golpe cada cuatro
 * minutos).
 */
const TRACK = "/calle-bosque-del-eucalipto-954.m4a";
/** la maqueta tiene pista propia, y entra por el 0:20 */
const MONOLITH_TRACK = "/raro3.m4a";
const MONOLITH_TRACK_START = 20;
/**
 * La subida por la escalera. Venia muy baja de origen (pico a -14.7 dBFS), asi
 * que el archivo ya se normalizo a -1 dBFS antes de entrar al proyecto: habia
 * margen limpio de sobra, y subirla ahi evita tener que forzar la ganancia en
 * el navegador, que ademas de distorsionar sube el ruido de fondo con ella.
 */
const ASCENT_TRACK = "/ascenso.m4a";

/**
 * El desenlace, igual que el del room3: misma pista, mismos tiempos y el mismo
 * par de piezas en DOM. Se reutilizan tal cual y no se copian: si algun dia se
 * afina el aro o la luz, los dos finales cambian a la vez, que es lo que hace
 * que se lean como el mismo gesto de la obra y no como dos parecidos.
 */
const FINALE_TRACK = "/calle-bosque-del-eucalipto-969.m4a";
/** el negro tarda esto en cerrarse, y la pista entra con el */
const BLACK_SECONDS = 6;
/** 0:40 de la pista: asoma la luz del fondo */
const LIGHT_AT = 40;
/** 1:05: el salto */
const REDIRECT_AT = 65;
const LIGHT_SECONDS = REDIRECT_AT - LIGHT_AT;
const NEXT_ROOM = "/room2608";
const LOOP = { start: 2, end: 239 };

/**
 * Por donde se entra. Sin `skip` se empieza por el principio; con el se cae
 * directamente en una etapa, para poder probarla sin recorrer los diez minutos
 * anteriores. Las rutas de atajo son de trabajo, no parte de la obra.
 */
export type Skip = "monolito" | "antro";

export default function Room99({ skip }: { skip?: Skip } = {}) {
  const { status: audio, fadeOut } = useLoopTrack({
    active: !skip,
    src: TRACK,
    start: LOOP.start,
    end: LOOP.end,
    gain: 0.82,
    fadeIn: 3,
  });

  const { off, strike } = useLightOff({ gain: 0.6 });
  const footstep = useFootstep({ gain: 0.75 });

  // estado compartido entre la escena y el control: los cuerpos con los que
  // se choca y la altura del ascensor
  /** Lectura de coordenadas. TEMPORAL: poner a false para quitarla. */
  const SHOW_HUD = true;

  const solids = useRef<SolidSet | null>(null);
  const elevator = useRef<ElevatorState>(
    skip === "antro" ? { y: ROOF_Y, going: true } : { y: 0, going: false }
  );

  /**
   * Fases del final:
   *   hall     la nave industrial
   *   dark     se corta la luz y queda negro
   *   flicker  el tubo intenta reencenderse a tirones
   *   white    ya encendido, pero la sala es otra
   *   dark2    treinta segundos despues, se corta otra vez
   *   flicker2 vuelve a parpadear
   *   monolith y ahora sube algo del suelo
   *
   * Los dos apagones comparten la misma maquina: el corte, el cambio de
   * escena bajo el negro y el parpadeo son el mismo gesto, solo cambia lo que
   * hay al encender.
   *
   * El cambio de escena ocurre BAJO el negro, antes de que empiece el
   * parpadeo: asi el primer destello ya descubre la sala blanca y se lee como
   * que la luz revela algo distinto, no como un cambio de decorado.
   */
  type Phase = "hall" | "dark" | "flicker" | "white" | "dark2" | "flicker2" | "monolith";
  const [phase, setPhase] = useState<Phase>(skip ? "monolith" : "hall");
  /** el ascensor ha coronado: hasta aqui el jugador solo mira */
  const [arrived, setArrived] = useState(skip === "antro");
  /** se acabo la pista de la maqueta: entran el viento y la de la subida */
  const [songEnded, setSongEnded] = useState(skip === "antro");
  /** ya en la azotea: la pista suena entera y el viento sobra */
  const [atTop, setAtTop] = useState(false);
  /** avance por la escalera, de 0 a 1: apaga el dia y sube el volumen */
  const night = useRef(skip === "antro" ? 1 : 0);
  /** cuanto flota el jugador al final */
  const lift = useRef(0);
  /** se acabo la pista: empieza el desenlace */
  const [over, setOver] = useState(false);
  const [light, setLight] = useState(false);
  const navigate = useNavigate();

  usePaperAudio({
    active: over,
    src: FINALE_TRACK,
    startAt: 0,
    gain: 0.85,
    fadeIn: BLACK_SECONDS,
  });

  useEffect(() => {
    if (!over) return;
    const timers = [
      window.setTimeout(() => setLight(true), LIGHT_AT * 1000),
      window.setTimeout(() => navigate(NEXT_ROOM), REDIRECT_AT * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [over, navigate]);

  usePaperAudio({
    active: phase === "monolith" && skip !== "antro",
    src: MONOLITH_TRACK,
    startAt: MONOLITH_TRACK_START,
    gain: 0.8,
    fadeIn: 3,
    onEnded: () => setSongEnded(true),
  });

  // A quinientos metros, y en cuanto se hace el silencio. Muy por debajo de
  // todo lo demas, y apareciendo despacio: es aire, no un efecto.
  //
  // Se corta al llegar arriba: ahi entra la pista entera, y el viento dejaria
  // de leerse como altura para pasar a ser ruido por debajo de la musica.
  useWind({ active: songEnded && !atTop, gain: 0.03, fadeIn: 16 });

  const ascent = useAscentTrack({
    active: songEnded,
    src: ASCENT_TRACK,
    from: 10,
    to: 12,
    onEnded: () => setOver(true),
  });

  /** El corte de luz, identico las dos veces. */
  const blackout = useCallback(
    (goDark: Phase, goFlicker: Phase, goLit: Phase, reposition: () => void) => {
      off();
      setPhase(goDark);

      window.setTimeout(() => {
        reposition();
        setPhase(goFlicker);
        // chispazos desincronizados con los destellos, como un tubo de verdad
        [0, 0.42, 0.62, 1.15, 1.72, 2.0].forEach((at, i) =>
          strike(at, i > 3 ? 1 : 0.55)
        );
      }, 1500);

      window.setTimeout(() => setPhase(goLit), 1500 + 2600);
    },
    [off, strike]
  );

  const cutTheLights = useCallback(() => {
    blackout("dark", "flicker", "white", () => {
      pivot.current.position.set(0, EYE, 30);
      pivot.current.rotation.set(0, 0, 0);
      if (cam.current) cam.current.rotation.set(0, 0, 0);
    });

    // treinta segundos despues de encenderse, se vuelve a ir la luz
    window.setTimeout(() => {
      fadeOut(2.6);
      blackout("dark2", "flicker2", "monolith", () => {
        // Sobre la plataforma del ascensor, mirando a -z, que es hacia la
        // torre: la escena empieza con el edificio saliendo del suelo justo
        // delante, y termina subiendo por el mismo sitio desde el que se vio
        // crecer.
        pivot.current.position.set(PLATFORM.x, EYE, PLATFORM.z);
        pivot.current.rotation.set(0, 0, 0);
        if (cam.current) cam.current.rotation.set(0, 0, 0);
      });
    }, 4100 + 30000);
  }, [blackout]);

  const cam = useRef<THREE.PerspectiveCamera | null>(null);
  const pivot = useRef<THREE.Object3D>(new THREE.Object3D());
  const [ready, setReady] = useState(false);
  const hud = useRef<HTMLPreElement | null>(null);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: FOG,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 42, near: 0.1, far: 500 }}
        onCreated={({ camera, scene, gl }) => {
          cam.current = camera as THREE.PerspectiveCamera;
          camera.position.set(0, 0, 0);
          // Punto de entrada segun la ruta. El de la fiesta se pone en el
          // ultimo rellano y no en medio de la pista: se llega por ahi, y
          // aparecer dentro de la multitud no ensena como se ve al entrar.
          if (skip === "antro") {
            pivot.current.position.set(76.5, STAIR.toY + EYE, 66);
            pivot.current.rotation.set(0, Math.PI, 0);
          } else if (skip === "monolito") {
            pivot.current.position.set(PLATFORM.x, EYE, PLATFORM.z);
          } else {
            pivot.current.position.set(0, EYE, 40);
          }
          pivot.current.add(camera);
          scene.add(pivot.current);

          gl.outputColorSpace = THREE.SRGBColorSpace;
          // Salida LINEAL, sin mapeo de tonos: los valores de la maqueta del
          // tercer acto estan despejados para esta curva, y ACES los
          // comprimiria hasta perder el contraste de la referencia.
          gl.toneMapping = THREE.NoToneMapping;

          setReady(true);
        }}
      >
        {phase === "hall" || phase === "dark" ? (
          <Scene onLastBay={cutTheLights} />
        ) : phase === "monolith" || phase === "flicker2" ? (
          <MonolithScene
            solids={solids}
            elevator={elevator}
            run={phase === "monolith"}
            startRisen={skip === "antro"}
            night={night}
            bands={ascent.bands}
            time={ascent.time}
            onArrived={() => setArrived(true)}
          />
        ) : (
          <WhiteScene onStep={footstep} />
        )}
        {phase === "monolith" && (
          <Trip time={ascent.time} bands={ascent.bands} lift={lift} />
        )}
        {phase === "monolith" && (
          <AscentProbe
            pivot={pivot.current}
            level={ascent.level}
            night={night}
            playFull={ascent.playFull}
            onTop={() => setAtTop(true)}
          />
        )}
        {ready && cam.current && (
          <Room99Controls
            camera={cam.current}
            pivot={pivot.current}
            /*
              El pasillo de la nave SOLO existe mientras la nave es lo que se
              ve. Su tope lateral trabaja sobre la posicion del jugador cada
              fotograma, asi que si sigue activo despues de recolocarlo en otra
              escena, lo arrastra de vuelta a las coordenadas de la nave sin
              que nada lo indique. El cambio de escena ocurre en el parpadeo,
              que es cuando se recoloca: de ahi en adelante, campo abierto.
            */
            freeRoam={phase !== "hall" && phase !== "dark"}
            frozen={phase === "monolith" && !arrived}
            lift={phase === "monolith" ? lift : undefined}
            solids={phase === "monolith" ? solids : undefined}
            elevator={phase === "monolith" ? elevator : undefined}
          />
        )}

        {SHOW_HUD && (
          <HudProbe target={hud} solids={solids} elevator={elevator} />
        )}
      </Canvas>

      {SHOW_HUD && <HudPanel innerRef={hud} />}

      {/*
        Telon del apagon y del parpadeo.

        La curva del apagon no es lineal: cae en picado los primeros 120 ms y
        luego se apaga despacio, que es como muere un filamento. Un fundido
        uniforme se leeria como transicion de escena, no como corte de luz.

        El parpadeo va por keyframes con pasos DESIGUALES. Repartidos por igual
        sonaria a metronomo; asi tiene el tartamudeo de un tubo que no engancha.
      */}
      <style>{`
        @keyframes r99-flicker {
            0% { opacity: 1; }
           14% { opacity: 1; }
           16% { opacity: 0.06; }
           19% { opacity: 1; }
           23% { opacity: 0.35; }
           25% { opacity: 1; }
           42% { opacity: 1; }
           44% { opacity: 0.02; }
           49% { opacity: 0.7; }
           52% { opacity: 0.05; }
           58% { opacity: 0.9; }
           64% { opacity: 0.02; }
           72% { opacity: 0.28; }
           78% { opacity: 0.02; }
           88% { opacity: 0.1; }
          100% { opacity: 0; }
        }
      `}</style>
      <Ripples active={over} />
      <TunnelLight mounted={over} growing={light} seconds={LIGHT_SECONDS} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000000",
          opacity: over
            ? 1
            : phase === "hall" || phase === "white" || phase === "monolith"
            ? 0
            : 1,
          transition: over
            ? // al acabar la cancion no hay corte: el negro se come la escena
              `opacity ${BLACK_SECONDS}s cubic-bezier(0.4, 0, 0.7, 1)`
            : phase === "dark" || phase === "dark2"
            ? "opacity 1.05s cubic-bezier(0.05, 0.85, 0.25, 1)"
            : "none",
          animation:
            phase === "flicker" || phase === "flicker2"
              ? "r99-flicker 2.6s steps(1, end) forwards"
              : "none",
          pointerEvents: "none",
          zIndex: 25,
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
            color: "#c3d0d8",
            pointerEvents: "none",
          }}
        >
          click para activar el sonido
        </div>
      )}
    </div>
  );
}
