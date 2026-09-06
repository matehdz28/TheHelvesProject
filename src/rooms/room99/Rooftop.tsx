import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TOP, ROOFS } from "./Monolith";
import { makeRandom } from "./layout";

/**
 * La fiesta de la azotea, a quinientos veinte metros.
 *
 * Todo lo que se ve aqui es SILUETA CONTRA RESPLANDOR: la gente es negra y
 * plana, y solo se lee porque detras hay luz. Por eso el disco del fondo es lo
 * primero que se monta y lo que fija la escala; sin el, ciento sesenta figuras
 * negras sobre hormigon oscuro son una mancha.
 *
 * La multitud va en mallas INSTANCIADAS, una por parte del cuerpo. Con un
 * grupo de mallas por persona serian mas de mil llamadas de dibujo por
 * fotograma; asi son seis, y el baile se calcula componiendo matrices a mano:
 * la del cuerpo por la de cada miembro, que es lo que hace un esqueleto pero
 * sin construir un grafo de escena por bailarin.
 *
 * La escena se mueve con la pista por DOS vias, y cada una hace lo que la otra
 * no puede. El analizador da el pulso: va siempre en fase porque mide lo que
 * esta saliendo por los altavoces, y no se desincroniza aunque el audio
 * arranque tarde. Pero solo sabe del instante presente, asi que no puede
 * anticipar. Para eso esta el mapa de la cancion, medido fuera: las caidas y
 * los subidones estan en segundos concretos, y saberlo por adelantado permite
 * apagar antes de una caida y tensar antes de un golpe.
 *
 * El grupo entero se OCULTA de dia en vez de desmontarse. Crear ciento sesenta
 * bailarines cuesta un tiron, y si ese tiron cae mientras subes la escalera se
 * nota; construyendolo durante el apagon y solo escondiendolo, la azotea
 * aparece sin coste.
 */

/**
 * Mapa de la pista, medido con FFT sobre el archivo: 123 BPM, y estos son los
 * segundos donde cambia. Los tramos "break" son donde desaparece el grave; los
 * "drop", donde vuelve de golpe.
 */
const BPM = 123;
/**
 * El tempo sirve como VELOCIDAD, no como rejilla. Medido sobre el ataque del
 * grave, la mejor fase fija solo mejora un 10% sobre una al azar: la pista no
 * esta cuadriculada, y un compas clavado por reloj se desincronizaria a lo
 * largo de dos minutos y medio.
 *
 * Por eso el ACENTO sale del analizador y no del reloj. El salto de cada uno
 * corre libre a la velocidad del tempo, y encima se le suma el grave que suena
 * ahora mismo: eso hace que la sala entera suba a la vez en cada bombo sin
 * depender de que ninguna cuenta cuadre.
 */
const HOP_HZ = BPM / 60;
const BREAKS: [number, number][] = [
  [18, 24],
  [44, 48],
  [64, 84],
  [122, 126],
];
/** 1:32 a 2:00, el maximo de energia de toda la pista */
const CLIMAX: [number, number] = [92, 120];
/** 2:02, unico punto donde el agudo se dispara con el grave fuera */
const HISS: [number, number] = [122, 126];
const OUTRO = 142;

/**
 * El viaje. A partir del gran golpe el mundo empieza a no cuadrar, y la cosa
 * solo va a mas hasta el final. Levitar entra mas tarde, ya con todo torcido:
 * si empezara a la vez se leeria como un ascensor mas y no como perder pie.
 */
// Arranca en 1:04, con la caida larga: la musica se vacia veinte segundos y
// es ahi donde el mundo empieza a no cuadrar, antes del golpe y no despues.
export const TRIP = { from: 64, to: 146 };
export const LEVITATE = { from: 118, to: 151 };

const COUNT = 160;

/**
 * TODOS bailan con el mismo compas y la misma fase. No es un descuido: una
 * multitud coordinada al milimetro no se lee como gente, se lee como una sola
 * cosa con muchos cuerpos, y eso es justo lo que se busca aqui.
 *
 * Lo que sigue variando es lo que no es tiempo: sitio, tamano, hacia donde
 * miran y cuanto saltan. Con eso no parecen el mismo muneco repetido, pero
 * caen todos en el mismo instante.
 *
 * La deriva del viaje SI es propia de cada uno, y por eso al final la
 * coordinacion se deshace: primero son un organismo y luego se dispersan.
 */
const UNISON_RATE = Math.PI * HOP_HZ;

/** cuanta gente cabe en una azotea, por su superficie */
const crowdFor = (w: number, d: number) =>
  Math.max(14, Math.min(84, Math.round((w * d) / 55)));

const inRange = (t: number, r: [number, number]) => t >= r[0] && t < r[1];
const anyRange = (t: number, rs: [number, number][]) => rs.some((r) => inRange(t, r));

/** azotea del este: es donde desemboca el ultimo rellano de la escalera */
export const ROOF = { x: 46, z: 30, w: 62, d: 56 };
const DJ_Z = ROOF.z - ROOF.d / 2 + 8;
type Dancer = {
  x: number;
  y: number;
  x0: number;
  z: number;
  yaw: number;
  scale: number;
  phase: number;
  /** compases por segundo de ESTE bailarin: nadie va exactamente al mismo */
  rate: number;
  bounce: number;
  /** brazos en alto casi todo el rato, o colgando */
  hands: number;
  sway: number;
  /** semilla propia para la deriva del viaje */
  drift: number;
};

export default function Rooftop({
  night,
  bands,
  time,
}: {
  night: React.MutableRefObject<number>;
  bands: React.MutableRefObject<{ bass: number; mid: number; high: number }>;
  /** segundo de la pista entera, o -1 si aun va el bucle de la subida */
  time: React.MutableRefObject<number>;
}) {
  const group = useRef<THREE.Group>(null!);
  const head = useRef<THREE.InstancedMesh>(null!);
  const torso = useRef<THREE.InstancedMesh>(null!);
  const hips = useRef<THREE.InstancedMesh>(null!);
  const armL = useRef<THREE.InstancedMesh>(null!);
  const armR = useRef<THREE.InstancedMesh>(null!);
  const legs = useRef<THREE.InstancedMesh>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const lamps = useRef<THREE.Group>(null!);
  const bars = useRef<THREE.Group>(null!);
  const strobe = useRef<THREE.PointLight>(null!);

  const dancers = useMemo<Dancer[]>(() => {
    const rnd = makeRandom(4471);
    const out: Dancer[] = [];

    // la pista del dj: apretados hacia delante y mirando al disco
    for (let i = 0; i < COUNT; i++) {
      // Mas apretados cuanto mas cerca del disco: una pista se llena por
      // delante, y repartirlos parejo la deja con aspecto de rejilla.
      //
      // El exponente va por ENCIMA de 1 para sesgar hacia cero, que es el
      // extremo del dj. Por debajo de 1 sesga al contrario y vacia la primera
      // fila, que es justo lo que no queria.
      const pull = Math.pow(rnd(), 1.7);
      const z = DJ_Z + 6 + pull * (ROOF.d - 22);
      const spread = 0.42 + pull * 0.55;
      const x = ROOF.x + (rnd() - 0.5) * ROOF.w * spread;
      out.push({
        x,
        x0: x,
        y: TOP,
        z,
        // mirando al disco, con desvio: en una pista nadie esta perfectamente alineado
        yaw: Math.atan2(ROOF.x - x, DJ_Z - z) + (rnd() - 0.5) * 1.5,
        scale: 0.86 + rnd() * 0.26,
        phase: 0,
        // |sin| tiene periodo PI, asi que esto es un bote por tiempo
        rate: UNISON_RATE,
        bounce: 0.12 + rnd() * rnd() * 0.62,
        hands: rnd() < 0.42 ? 1 : 0,
        sway: 0.5 + rnd() * 1.4,
        drift: rnd() * Math.PI * 2,
      });
    }

    // y el resto del horizonte. Toda azotea con sitio tiene su propia fiesta:
    // desde la del dj se ven encenderse los demas edificios
    for (const r of ROOFS) {
      const n = crowdFor(r.w, r.d);
      for (let i = 0; i < n; i++) {
        const x = r.x + (rnd() - 0.5) * (r.w - 6);
        const z = r.z + (rnd() - 0.5) * (r.d - 6);
        out.push({
          x,
          x0: x,
          y: r.y,
          z,
          yaw: rnd() * Math.PI * 2,
          scale: 0.86 + rnd() * 0.26,
          phase: 0,
          rate: UNISON_RATE,
          bounce: 0.12 + rnd() * rnd() * 0.62,
          hands: rnd() < 0.42 ? 1 : 0,
          sway: 0.5 + rnd() * 1.4,
          drift: rnd() * Math.PI * 2,
        });
      }
    }
    return out;
  }, []);

  const black = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#03040a", fog: false }),
    []
  );

  // el origen de brazos y piernas se lleva al hombro y a la cadera, para que
  // girar la matriz de la parte baste y no haga falta un nodo intermedio
  const geo = useMemo(() => {
    const arm = new THREE.CapsuleGeometry(0.085, 1.1, 4, 8);
    arm.translate(0, -0.58, 0);
    const leg = new THREE.CapsuleGeometry(0.108, 1.2, 4, 8);
    leg.translate(0, -0.65, 0);
    return {
      head: new THREE.SphereGeometry(0.35, 12, 9),
      torso: new THREE.CapsuleGeometry(0.23, 0.62, 4, 9),
      hips: new THREE.SphereGeometry(0.22, 10, 8),
      arm,
      leg,
    };
  }, []);

  /** disco del fondo: el resplandor que recorta a todo el mundo */
  const glowMap = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, "rgba(255,238,224,1)");
    rad.addColorStop(0.18, "rgba(255,120,40,1)");
    rad.addColorStop(0.46, "rgba(226,26,10,0.85)");
    rad.addColorStop(0.78, "rgba(120,8,6,0.32)");
    rad.addColorStop(1, "rgba(60,4,4,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  /** el plato: surcos concentricos que recogen el rojo */
  const vinylMap = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0a0a0d";
    g.fillRect(0, 0, 512, 512);
    for (let r = 26; r < 250; r += 2.4) {
      g.beginPath();
      g.arc(256, 256, r, 0, Math.PI * 2);
      g.strokeStyle = `rgba(190,205,225,${0.05 + 0.05 * Math.sin(r * 0.7)})`;
      g.lineWidth = 1;
      g.stroke();
    }
    g.beginPath();
    g.arc(256, 256, 74, 0, Math.PI * 2);
    g.fillStyle = "#c9cfd6";
    g.fill();
    g.beginPath();
    g.arc(256, 256, 8, 0, Math.PI * 2);
    g.fillStyle = "#0a0a0d";
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      black.dispose();
      glowMap.dispose();
      vinylMap.dispose();
    },
    [geo, black, glowMap, vinylMap]
  );

  const dBody = useMemo(() => new THREE.Matrix4(), []);
  const dPart = useMemo(() => new THREE.Matrix4(), []);
  const out = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s3 = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Euler(), []);

  useFrame(({ clock }) => {
    const n = night.current;
    const on = n > 0.12;
    if (group.current) group.current.visible = on;
    if (!on) return;

    const t = clock.elapsedTime;
    const { bass, mid, high } = bands.current;
    const song = time.current;

    // en una caida el grave desaparece: la gente deja de saltar y se mece, y
    // eso es lo que hace que el golpe siguiente se note
    const brk = song >= 0 && anyRange(song, BREAKS) ? 1 : 0;
    const climax = song >= 0 && inRange(song, CLIMAX) ? 1 : 0;
    const fade = song >= OUTRO ? Math.max(0, 1 - (song - OUTRO) / 9) : 1;
    // los segundos que faltan para el proximo golpe, para tensar antes
    const nextDrop = BREAKS.map((b) => b[1]).find((d) => d > song && d - song < 3);
    const brace = nextDrop !== undefined ? 1 - (nextDrop - song) / 3 : 0;
    const kick = Math.pow(bass, 1.7);
    // el viaje: de 0 a 1 entre el gran golpe y el final
    const trip =
      song < 0 ? 0 : THREE.MathUtils.smoothstep(song, TRIP.from, TRIP.to);

    for (let i = 0; i < dancers.length; i++) {
      const d = dancers[i];
      const beat = t * d.rate + d.phase;
      // dos tercios de golpe y uno de bote propio: el golpe los junta a todos
      // en el bombo, el bote propio evita que parezcan un solo muneco repetido
      const drive = (1 - brk * 0.82) * fade;
      const hop =
        d.bounce * drive * (0.34 * Math.abs(Math.sin(beat)) + 1.5 * kick);
      const lean = Math.sin(beat * 0.5) * 0.09 * d.sway * (1 + brk * 1.6);

      // Con el viaje se sueltan del suelo: suben, se ladean y se estiran, y
      // cada uno a su ritmo. Que pierdan la vertical a la vez seria una
      // coreografia; que la pierdan por separado es que ya no hay suelo.
      const dr = t * 0.21 + d.drift;
      const rise = trip * (2.5 + Math.sin(dr) * 2.2 + d.bounce * 9);
      const tilt = trip * Math.sin(dr * 1.37) * 0.9;
      const stretch = 1 + trip * Math.sin(dr * 0.83) * 0.35;

      e.set(tilt * 0.6, d.yaw + Math.sin(beat * 0.34) * 0.22 * d.sway + trip * dr * 0.35, lean + tilt);
      q.setFromEuler(e);
      v.set(
        d.x0 + trip * Math.sin(dr * 0.61) * 6,
        d.y + hop + rise,
        d.z + trip * Math.cos(dr * 0.47) * 6
      );
      s3.set(d.scale, d.scale * stretch, d.scale);
      dBody.compose(v, q, s3);

      const put = (
        mesh: THREE.InstancedMesh | null,
        px: number,
        py: number,
        rx: number
      ) => {
        if (!mesh) return;
        e.set(rx, 0, 0);
        q.setFromEuler(e);
        v.set(px, py, 0);
        s3.setScalar(1);
        dPart.compose(v, q, s3);
        out.multiplyMatrices(dBody, dPart);
        mesh.setMatrixAt(i, out);
      };

      put(head.current, 0, 2.14, 0);
      put(torso.current, 0, 1.62, 0);
      put(hips.current, 0, 1.28, 0);
      put(legs.current, 0, 1.28, Math.sin(beat * 2) * 0.12);

      // brazos: arriba y meciendose, o colgando siguiendo el compas
      // en el subidon levantan las manos hasta los que no las tenian arriba
      const raised = d.hands || climax > 0;
      const up = raised
        ? -2.45 + Math.sin(beat * 1.02) * 0.34 * (0.4 + mid)
        : -0.18 + Math.sin(beat) * 0.42 * (0.3 + bass);
      put(armL.current, -0.27, 1.8, up);
      put(armR.current, 0.27, 1.8, up + (d.hands ? Math.sin(beat * 0.7) * 0.2 : 0));
    }

    [head, torso, hips, armL, armR, legs].forEach((r) => {
      if (r.current) r.current.instanceMatrix.needsUpdate = true;
    });

    // el disco respira con el bombo, y se abre en el subidon
    if (glow.current) {
      const p = 1 + kick * 0.12 + climax * 0.16 + brace * 0.1 + trip * 0.9;
      glow.current.scale.set(p, p, 1);
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = n * fade * (0.5 + kick * 0.45 + climax * 0.12) * (1 - brk * 0.45);
    }

    // las barras son lo unico que marca el pulso seco: sin inercia, para que
    // el golpe se lea como un golpe
    if (bars.current) {
      const v = 0.25 + kick * 0.75;
      bars.current.children.forEach((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        // en el viaje el color se va: el rojo deja de ser rojo
        const h = trip * (0.5 + Math.sin(t * 0.31) * 0.5);
        m.color.setRGB(
          v * fade,
          v * (0.13 + h * 0.7) * fade + climax * 0.32 * v,
          v * (0.05 + h * 0.85) * fade
        );
      });
    }

    if (lamps.current) {
      lamps.current.children.forEach((c, k) => {
        const l = c as THREE.PointLight;
        if (!l.isPointLight) return;
        // el medio sostiene el nivel y el agudo lo hace parpadear
        const flick = 1 + high * Math.sin(t * 41 + k * 2.1) * 0.35;
        l.intensity = n * fade * (60 + mid * 240) * flick * (1 - brk * 0.55);
      });
    }

    // 2:02: unico punto de la pista donde el agudo se dispara sin grave. Ahi
    // va el estrobo blanco, que no se usa en ningun otro momento para que
    // cuando aparezca signifique algo
    if (strobe.current) {
      // el destello lo dispara el propio agudo, no una cuenta: asi cae donde
      // esta el siseo aunque la pista arranque con retraso
      const on = song >= 0 && inRange(song, HISS);
      strobe.current.intensity = on && high > 0.55 ? 1400 * (high - 0.55) : 0;
    }
  });

  return (
    <group ref={group} visible={false}>
      {/* disco del fondo, detras del dj: la fuente de todas las siluetas */}
      <mesh ref={glow} position={[ROOF.x, TOP + 15, DJ_Z - 7]}>
        <planeGeometry args={[74, 52]} />
        <meshBasicMaterial
          map={glowMap}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </mesh>

      {/* plato: el dj va encima */}
      <mesh position={[ROOF.x, TOP + 1.1, DJ_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[9, 64]} />
        <meshBasicMaterial map={vinylMap} toneMapped={false} />
      </mesh>
      <mesh position={[ROOF.x, TOP + 0.55, DJ_Z]}>
        <cylinderGeometry args={[9, 9, 1.1, 48]} />
        <meshStandardMaterial color="#15161a" roughness={1} />
      </mesh>

      {/* la mesa y el dj, de espaldas al disco */}
      <mesh position={[ROOF.x, TOP + 2.35, DJ_Z + 1.4]}>
        <boxGeometry args={[6.4, 1.4, 1.6]} />
        <meshBasicMaterial color="#05060b" fog={false} />
      </mesh>
      <group position={[ROOF.x, TOP + 1.1, DJ_Z]}>
        <mesh position={[0, 2.14, 0]}>
          <sphereGeometry args={[0.36, 12, 9]} />
          <meshBasicMaterial color="#03040a" fog={false} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <capsuleGeometry args={[0.25, 0.68, 4, 9]} />
          <meshBasicMaterial color="#03040a" fog={false} />
        </mesh>
        <mesh position={[-0.3, 1.85, 0.5]} rotation={[-1.1, 0, 0]}>
          <capsuleGeometry args={[0.09, 1, 4, 8]} />
          <meshBasicMaterial color="#03040a" fog={false} />
        </mesh>
        <mesh position={[0.3, 1.85, 0.5]} rotation={[-1.1, 0, 0]}>
          <capsuleGeometry args={[0.09, 1, 4, 8]} />
          <meshBasicMaterial color="#03040a" fog={false} />
        </mesh>
      </group>

      {/* barras rojas por los cantos, como el tubo de la referencia */}
      <group ref={bars}>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[ROOF.x + (side * ROOF.w) / 2 - side * 1.2, TOP + 4.2, ROOF.z]}
          rotation={[0, 0, side * 0.14]}
        >
          <boxGeometry args={[0.5, 0.5, ROOF.d - 8]} />
          <meshBasicMaterial color="#ff2408" toneMapped={false} fog={false} />
        </mesh>
      ))}
      </group>

      {/* estrobo del 2:02 */}
      <pointLight
        ref={strobe}
        position={[ROOF.x, TOP + 12, DJ_Z + 12]}
        color="#fff0e4"
        distance={130}
        decay={2}
        intensity={0}
      />

      {/* lamparas colgadas: los pocos focos que dan volumen a la niebla */}
      <group ref={lamps}>
        {[
          [ROOF.x - 17, DJ_Z + 17],
          [ROOF.x + 17, DJ_Z + 17],
          [ROOF.x - 13, DJ_Z + 36],
          [ROOF.x + 13, DJ_Z + 36],
        ].map(([lx, lz], i) => (
          <pointLight
            key={i}
            position={[lx, TOP + 9, lz]}
            color="#ff3a12"
            distance={62}
            decay={2}
            intensity={0}
          />
        ))}
      </group>
      {[
        [ROOF.x - 17, DJ_Z + 17],
        [ROOF.x + 17, DJ_Z + 17],
        [ROOF.x - 13, DJ_Z + 36],
        [ROOF.x + 13, DJ_Z + 36],
      ].map(([lx, lz], i) => (
        <group key={i} position={[lx, TOP + 9, lz]}>
          <mesh>
            <sphereGeometry args={[0.45, 10, 8]} />
            <meshBasicMaterial color="#ff8a4a" toneMapped={false} fog={false} />
          </mesh>
          {/* cono de la lampara: la niebla iluminada bajo cada foco */}
          <mesh position={[0, -4.4, 0]}>
            <coneGeometry args={[4.6, 8.8, 18, 1, true]} />
            <meshBasicMaterial
              color="#ff2c0e"
              transparent
              opacity={0.11}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
            />
          </mesh>
        </group>
      ))}

      <instancedMesh ref={head} args={[geo.head, black, dancers.length]} frustumCulled={false} />
      <instancedMesh ref={torso} args={[geo.torso, black, dancers.length]} frustumCulled={false} />
      <instancedMesh ref={hips} args={[geo.hips, black, dancers.length]} frustumCulled={false} />
      <instancedMesh ref={legs} args={[geo.leg, black, dancers.length]} frustumCulled={false} />
      <instancedMesh ref={armL} args={[geo.arm, black, dancers.length]} frustumCulled={false} />
      <instancedMesh ref={armR} args={[geo.arm, black, dancers.length]} frustumCulled={false} />
    </group>
  );
}
