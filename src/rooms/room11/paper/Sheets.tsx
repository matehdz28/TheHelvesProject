import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makePaperAtlas } from "./paperTexture";
import { PHRASES, ATLAS_COLS, ATLAS_ROWS } from "./phrases";
import { vortexAt, COLLAPSE_AT } from "./choreography";

/**
 * El suelo de hojas, y lo que pasa al pisarlas.
 *
 * Simulacion en CPU sobre arrays planos, no objetos: son miles de hojas y cada
 * frame se recorren enteras. Con objetos, el recolector de basura se notaria.
 *
 * Cada hoja guarda posicion, velocidad, angulos de Euler y velocidad angular.
 * Al acercarse el jugador reciben un empujon hacia AFUERA y hacia ARRIBA, mas
 * un giro aleatorio; despues caen con mucho arrastre, que es lo que hace que
 * el papel planee en vez de desplomarse. Al tocar suelo se acuestan solas y se
 * quedan donde cayeron: por eso se van mezclando.
 *
 * Encima de eso actua el VORTICE, que va creciendo con la cancion. Tiene tres
 * componentes: atraccion hacia un radio objetivo, giro tangencial y empuje
 * hacia arriba. El radio objetivo crece con la altura: eso da el embudo,
 * estrecho abajo y abierto arriba. El eje se queda clavado en el centro; lo
 * que se mueve son las hojas.
 *
 * Cada hoja lleva su PROPIO radio y su propia altura preferida. Sin esa
 * variacion, todas convergen al mismo radio a cada altura y el tornado sale
 * como un cono liso, un circulo perfecto. Con ella queda el desorden: unas
 * pegadas al eje, otras muy abiertas, y a alturas distintas.
 */

const SHEET_W = 0.30;
const SHEET_H = 0.42;

export default function Sheets({
  songTime,
  count = 4200,
  /** radio de la zona sembrada */
  radius = 34,
  floorY = 0,
  /** a que distancia el paso las levanta */
  kickRadius = 2.6,
  kickStrength = 5.2,
}: {
  /** posicion de la pista, en segundos: es el reloj de la coreografia */
  songTime: React.MutableRefObject<number>;
  count?: number;
  radius?: number;
  floorY?: number;
  kickRadius?: number;
  kickStrength?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const atlas = useMemo(() => makePaperAtlas(), []);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H);
    // atributo por instancia: que celda del atlas le toca a cada hoja
    return g;
  }, []);

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({
      map: atlas,
      side: THREE.DoubleSide,
    });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute vec2 aCell;\nvarying vec2 vCell;\n" +
        shader.vertexShader.replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\n  vCell = aCell;"
        );
      shader.fragmentShader =
        "varying vec2 vCell;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec2 cellUv = (vMapUv + vCell) / vec2(${ATLAS_COLS.toFixed(1)}, ${ATLAS_ROWS.toFixed(1)});
           vec4 sampledDiffuseColor = texture2D( map, cellUv );
           diffuseColor *= sampledDiffuseColor;`
        );
    };
    return m;
  }, [atlas]);

  /** estado de la simulacion, en arrays planos */
  const sim = useMemo(() => {
    const n = count;
    const s = {
      px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
      rx: new Float32Array(n), ry: new Float32Array(n), rz: new Float32Array(n),
      ax: new Float32Array(n), ay: new Float32Array(n), az: new Float32Array(n),
      cell: new Float32Array(n * 2),
      /** multiplicador de radio: rompe el cono liso */
      jr: new Float32Array(n),
      /** multiplicador de succion: reparte las alturas */
      jh: new Float32Array(n),
      /** fase propia de turbulencia */
      ph: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      // reparto por area: sqrt evita que se apelotonen en el centro
      const r = Math.sqrt(Math.random()) * radius;
      const a = Math.random() * Math.PI * 2;
      s.px[i] = Math.cos(a) * r;
      s.pz[i] = Math.sin(a) * r;
      // casi la mitad arranca en el aire y repartida en toda la altura: asi la
      // sala ya esta llena al entrar, como en la referencia, y no es una
      // alfombra plana
      s.py[i] =
        Math.random() < 0.46
          ? floorY + Math.pow(Math.random(), 0.75) * 22
          : floorY + Math.random() * 0.05;
      s.rx[i] = s.py[i] > floorY + 0.2 ? Math.random() * Math.PI : -Math.PI / 2 + (Math.random() - 0.5) * 0.25;
      s.ry[i] = Math.random() * Math.PI * 2;
      s.rz[i] = (Math.random() - 0.5) * 0.3;
      s.jr[i] = 0.35 + Math.random() * 1.5;
      s.jh[i] = 0.45 + Math.random() * 1.4;
      s.ph[i] = Math.random() * 100;
    }

    /**
     * Reparto de frases. Las primeras N hojas reciben una frase cada una y el
     * resto va al azar; despues se baraja el array entero.
     *
     * El barajado importa por dos motivos: sin el, las frases garantizadas
     * caerian todas en las primeras hojas del array, que son las que se
     * siembran juntas, y quedarian amontonadas en una zona. Y ademas asi cada
     * carga reparte distinto.
     */
    const P = PHRASES.length;
    const ids = new Int32Array(n);
    for (let i = 0; i < n; i++) ids[i] = i < P ? i : Math.floor(Math.random() * P);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ids[i];
      ids[i] = ids[j];
      ids[j] = tmp;
    }
    for (let i = 0; i < n; i++) {
      s.cell[i * 2] = ids[i] % ATLAS_COLS;
      s.cell[i * 2 + 1] = Math.floor(ids[i] / ATLAS_COLS);
    }

    return s;
  }, [count, radius, floorY]);

  useEffect(() => {
    geometry.setAttribute(
      "aCell",
      new THREE.InstancedBufferAttribute(sim.cell, 2)
    );
  }, [geometry, sim]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      atlas.dispose();
    },
    [geometry, material, atlas]
  );

  const fell = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cam = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }, delta) => {
    const m = mesh.current;
    if (!m) return;

    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    camera.getWorldPosition(cam);

    const song = songTime.current;
    const v = vortexAt(song);

    /**
     * Desplome del final. El vortice ya viene a cero desde vortexAt; aqui se
     * cambia ademas la fisica: mucha mas gravedad y mucho menos arrastre, para
     * que caigan de golpe en vez de planear un minuto. Y en el primer frame se
     * les corta la velocidad de subida, si no las que iban lanzadas hacia
     * arriba seguirian trepando varios segundos despues del corte.
     */
    const collapsing = song >= COLLAPSE_AT;
    if (collapsing && !fell.current) {
      fell.current = true;
      for (let i = 0; i < count; i++) {
        if (sim.vy[i] > 0) sim.vy[i] = 0;
        sim.ax[i] *= 2.2;
        sim.ay[i] *= 2.2;
        sim.az[i] *= 2.2;
      }
    }
    const active = v.spin > 0.001 || v.gather > 0.001 || v.lift > 0.001 || v.free > 0.001;
    // cuanto obedecen todavia al tornado
    const order = 1 - v.chaos;
    // el vortice se traga la gravedad segun se forma, si no la pelea
    const g = collapsing
      ? 22 * dt
      : 3.4 * dt * (1 - Math.min(1, v.lift / 3.4) * 0.85);
    // y el paso deja de importar cuando ya vuelan todas
    const kick = kickStrength * (1 - Math.min(1, v.spin / 2.5));

    const kr2 = kickRadius * kickRadius;
    // arrastre: alto para que el papel planee, pero mas suelto que antes para
    // que conserve velocidad y el conjunto se mueva mas
    const drag = Math.exp(-(collapsing ? 0.55 : 1.75) * dt);
    const spinDamp = Math.exp(-1.15 * dt);


    for (let i = 0; i < count; i++) {
      const dx = sim.px[i] - cam.x;
      const dz = sim.pz[i] - cam.z;
      const d2 = dx * dx + dz * dz;

      // el paso solo levanta lo que tiene cerca y por debajo de la cintura
      if (d2 < kr2 && sim.py[i] < cam.y + 0.4) {
        const d = Math.sqrt(d2) || 0.0001;
        const f = (1 - d / kickRadius) * kick;
        sim.vx[i] += (dx / d) * f * 0.55;
        sim.vz[i] += (dz / d) * f * 0.55;
        sim.vy[i] += f * (0.85 + Math.random() * 0.7);
        sim.ax[i] += (Math.random() - 0.5) * f * 2.4;
        sim.ay[i] += (Math.random() - 0.5) * f * 2.4;
        sim.az[i] += (Math.random() - 0.5) * f * 2.4;
      }

      const airborne = sim.py[i] > floorY + 0.06;

      if (airborne) {
        sim.vy[i] -= g;
        if (!collapsing) {
          // remolino: cada hoja con su fase, si no ondulan todas a la vez
          const ph = sim.ph[i];
          sim.vx[i] += Math.sin(t * 1.3 + ph) * 1.15 * dt;
          sim.vz[i] += Math.cos(t * 1.1 + ph * 1.7) * 1.15 * dt;
          // turbulencia VERTICAL: rompe las capas y reparte alturas
          sim.vy[i] += Math.sin(t * 0.9 + ph * 2.3) * 0.85 * dt;
        }
      }

      if (active) {
        const rx = sim.px[i];
        const rz = sim.pz[i];
        const r = Math.hypot(rx, rz) || 0.001;
        const ux = rx / r;
        const uz = rz / r;
        const h = Math.max(0, sim.py[i] - floorY);

        // embudo: el radio al que "quiere" estar crece con la altura, pero
        // cada hoja tiene el suyo
        const rTarget = (v.core + h * v.flare) * sim.jr[i];
        const radial = (rTarget - r) * v.gather * order;
        sim.vx[i] += ux * radial * dt;
        sim.vz[i] += uz * radial * dt;

        // giro: mas rapido cerca del eje, como en un remolino real
        const w = v.spin * (14 / (6 + r)) * order;
        sim.vx[i] += -uz * w * dt;
        sim.vz[i] += ux * w * dt;

        // succion: fuerte abajo y se apaga arriba, para que no se escapen.
        // El techo propio de cada hoja hace que unas se queden a media altura
        // y otras suban del todo.
        const top = 30 * sim.jh[i];
        const rise = v.lift * sim.jh[i] * (1 - Math.min(1, h / top));
        sim.vy[i] += rise * dt * 2.6;

        // al girar, tambien voltean
        sim.ax[i] += (-uz * w) * dt * 0.9;
        sim.az[i] += (ux * w) * dt * 0.9;

        /**
         * Movimiento libre. Cuando el tornado pierde el orden, esto lo
         * sustituye: cada hoja empujada por su PROPIA fase, en las tres
         * direcciones y a frecuencias distintas entre si. Al no compartir
         * fase ni periodo, no queda nada colectivo que se lea como patron:
         * es lo que hace que parezcan sueltas y no una masa ondulando.
         */
        if (v.free > 0.001) {
          const ph = sim.ph[i];
          const f = v.free;
          sim.vx[i] += Math.sin(t * 2.1 + ph * 1.31) * f * dt;
          sim.vz[i] += Math.cos(t * 1.83 + ph * 0.77) * f * dt;
          sim.vy[i] += Math.sin(t * 1.57 + ph * 2.93) * f * 0.55 * dt;
          sim.ax[i] += Math.cos(t * 2.4 + ph) * f * 0.5 * dt;
          sim.ay[i] += Math.sin(t * 2.7 + ph * 1.9) * f * 0.5 * dt;
        }
      }

      sim.vx[i] *= drag;
      sim.vy[i] *= drag;
      sim.vz[i] *= drag;

      sim.px[i] += sim.vx[i] * dt;
      sim.py[i] += sim.vy[i] * dt;
      sim.pz[i] += sim.vz[i] * dt;

      sim.rx[i] += sim.ax[i] * dt;
      sim.ry[i] += sim.ay[i] * dt;
      sim.rz[i] += sim.az[i] * dt;
      sim.ax[i] *= spinDamp;
      sim.ay[i] *= spinDamp;
      sim.az[i] *= spinDamp;

      if (sim.py[i] <= floorY && v.lift < 0.4) {
        sim.py[i] = floorY;
        sim.vy[i] = 0;
        sim.vx[i] *= 0.25;
        sim.vz[i] *= 0.25;
        sim.ax[i] *= 0.2;
        sim.az[i] *= 0.2;
        sim.ay[i] *= 0.6;
        // se acuestan: el plano mira a +Z, asi que tumbarlo es -90 en X
        sim.rx[i] += (-Math.PI / 2 - sim.rx[i]) * Math.min(1, 9 * dt);
        sim.rz[i] += (0 - sim.rz[i]) * Math.min(1, 9 * dt);
      }

      // que no se escapen del recinto
      const rr = Math.hypot(sim.px[i], sim.pz[i]);
      if (rr > radius * 1.12) {
        const k = (radius * 1.12) / rr;
        sim.px[i] *= k;
        sim.pz[i] *= k;
        sim.vx[i] *= -0.3;
        sim.vz[i] *= -0.3;
      }

      dummy.position.set(sim.px[i], sim.py[i] + 0.004, sim.pz[i]);
      dummy.rotation.set(sim.rx[i], sim.ry[i], sim.rz[i]);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }

    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow={false}
    />
  );
}
