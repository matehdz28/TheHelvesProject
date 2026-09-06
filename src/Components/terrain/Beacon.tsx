import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getTerrain } from "./terrainData";
import { BANDS, type AudioLevels } from "../../audio/usePortalAudio";

/**
 * La cosa blanca que nunca se alcanza, y que respira con la musica.
 *
 * Posicion: cada frame se recoloca en (camara + direccion de vista * DISTANCE),
 * asi que siempre esta justo delante a la misma distancia y por mucho que se
 * avance nunca se llega. Va amortiguada, no clavada, para que al girar el
 * mouse bascule hasta su sitio en vez de parecer pegada a la pantalla.
 *
 * Forma: el espectro se enrolla alrededor del eje vertical. Cada vertice mira
 * el angulo que ocupa y estira su radio segun la banda que le toca, asi que
 * los graves inflan un lado y los agudos rizan el otro, y el conjunto gira.
 *
 * Su material ignora la niebla a proposito: a 520 unidades se la comeria casi
 * entera, y tiene que leerse siempre nitida.
 */
const DISTANCE = 520;
const SIZE = 55;
const FOLLOW = 2.5;
const MIN_CLEARANCE = 70;
const RADIAL = 40;
const RINGS = 34;
const TAU = Math.PI * 2;

/** perfil de gota: redonda arriba, afilada abajo */
function dropProfile(segments: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const y = Math.cos(u * Math.PI);
    const s = Math.sin(u * Math.PI);
    const taper = Math.pow((1 + y) / 2, 0.35);
    pts.push(new THREE.Vector2(s * (0.32 + 0.68 * taper) * 0.92, y * 1.18));
  }
  return pts;
}

export default function Beacon({
  levels,
  visible,
}: {
  levels: React.MutableRefObject<AudioLevels>;
  visible: boolean;
}) {
  const group = useRef<THREE.Group>(null!);
  const { heightAt } = getTerrain();

  const body = useMemo(() => new THREE.LatheGeometry(dropProfile(RINGS), RADIAL), []);

  /** copia intacta de los vertices: la deformacion siempre parte de aqui */
  const rest = useMemo(
    () => Float32Array.from(body.attributes.position.array as Float32Array),
    [body]
  );
  /** banda del espectro que le toca a cada vertice, precalculada */
  const vertexBand = useMemo(() => {
    const n = rest.length / 3;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(rest[i * 3 + 2], rest[i * 3]);
      const u = a / TAU + 0.5;
      out[i] = Math.min(BANDS - 1, Math.floor(u * BANDS));
    }
    return out;
  }, [rest]);

  const wire = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        wireframe: true,
        fog: false,
        transparent: true,
      }),
    []
  );
  // relleno apenas mas oscuro que el cielo: sin el, la malla blanca se
  // perderia contra un fondo claro
  const fill = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#c9cedd",
        fog: false,
        transparent: true,
      }),
    []
  );

  useEffect(
    () => () => {
      wire.dispose();
      fill.dispose();
      body.dispose();
    },
    [wire, fill, body]
  );

  const target = useRef(new THREE.Vector3());
  const camPos = useRef(new THREE.Vector3()).current;
  const dir = useRef(new THREE.Vector3()).current;
  const placed = useRef(false);
  const appear = useRef(0);

  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g) return;

    const step = Math.min(dt, 0.1);

    // entrada suave al aparecer
    appear.current = THREE.MathUtils.damp(appear.current, visible ? 1 : 0, 3.2, step);
    if (appear.current < 0.002) {
      g.visible = false;
      return;
    }
    g.visible = true;
    wire.opacity = appear.current;
    fill.opacity = appear.current;

    // --- posicion: siempre delante, nunca alcanzable ---
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(dir);
    target.current.copy(dir).multiplyScalar(DISTANCE).add(camPos);

    // sin esto, mirar hacia abajo la enterraria dentro de una montana
    const floor = heightAt(target.current.x, target.current.z) + MIN_CLEARANCE;
    if (target.current.y < floor) target.current.y = floor;

    if (!placed.current) {
      placed.current = true;
      g.position.copy(target.current);
    } else {
      g.position.lerp(target.current, 1 - Math.exp(-FOLLOW * step));
    }

    // --- forma: el espectro enrollado alrededor del eje ---
    const a = levels.current;
    const pulse = 1 + a.level * 0.45;
    const pos = body.attributes.position.array as Float32Array;

    for (let i = 0; i < vertexBand.length; i++) {
      const k = 1 + a.bands[vertexBand[i]] * 0.7;
      pos[i * 3] = rest[i * 3] * k * pulse;
      pos[i * 3 + 1] = rest[i * 3 + 1] * pulse;
      pos[i * 3 + 2] = rest[i * 3 + 2] * k * pulse;
    }
    body.attributes.position.needsUpdate = true;

    g.rotation.y += step * (0.2 + a.treble * 0.9);
    g.scale.setScalar(SIZE * (0.35 + 0.65 * appear.current));
  });

  return (
    <group ref={group} scale={SIZE}>
      <mesh geometry={body} material={fill} scale={0.985} />
      <mesh geometry={body} material={wire} />
    </group>
  );
}
