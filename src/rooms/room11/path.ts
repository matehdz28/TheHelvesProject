import * as THREE from "three";
import { WATER_Y, SHORE_Z } from "./layers";
import { PORTAL } from "./Portals";

/**
 * El camino del pasillo.
 *
 * No es fijo: nace en el punto EXACTO por donde se pisa el agua y serpentea
 * hasta el portal. Entrar por la izquierda o por la derecha da trazados
 * distintos, porque tanto la amplitud del serpenteo como su sentido salen de
 * esa coordenada.
 *
 * El ultimo tramo va recto y de frente al portal a proposito: asi se llega
 * mirandolo de cara y no de refilon.
 */
export const CORRIDOR_HALF = 7;
export const CORRIDOR_HEIGHT = 42;
/** ancho de cada tira de imagenes, en metros */
export const COLUMN_WIDTH = 3;

export function buildPath(entryX: number) {
  const z0 = SHORE_Z;
  const z1 = PORTAL.position.z;

  // el serpenteo se aleja primero del lado por el que entraste
  const side = entryX >= 0 ? 1 : -1;
  const amp = THREE.MathUtils.clamp(11 + Math.abs(entryX) * 0.5, 11, 30);

  const pts: THREE.Vector3[] = [new THREE.Vector3(entryX, WATER_Y, z0)];

  for (const t of [0.2, 0.45, 0.7]) {
    const z = THREE.MathUtils.lerp(z0, z1, t);
    const wobble = Math.sin(t * Math.PI * 1.6) * amp * -side;
    const x = THREE.MathUtils.lerp(entryX, 0, t * t) + wobble;
    pts.push(new THREE.Vector3(x, WATER_Y, z));
  }

  // aproximacion final recta
  pts.push(new THREE.Vector3(0, WATER_Y, z1 + 30));
  pts.push(new THREE.Vector3(0, WATER_Y, z1));

  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
}

/**
 * Cinta de muro siguiendo la curva.
 *
 * La U guarda la LONGITUD DE ARCO en metros, no un 0..1 normalizado: asi las
 * columnas miden lo mismo en los tramos rectos y en las curvas, que si no se
 * estirarian por la parte de fuera de cada giro.
 */
export function wallGeometry(
  curve: THREE.CatmullRomCurve3,
  side: 1 | -1,
  segments = 240
) {
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const lat = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  let arc = 0;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPoint(t, p);
    curve.getTangent(t, tan);
    tan.y = 0;
    tan.normalize();
    lat.crossVectors(tan, up).normalize();

    if (i > 0) arc += p.distanceTo(prev);
    prev.copy(p);

    const x = p.x + lat.x * side * CORRIDOR_HALF;
    const z = p.z + lat.z * side * CORRIDOR_HALF;

    pos.push(x, WATER_Y, z, x, WATER_Y + CORRIDOR_HEIGHT, z);
    uv.push(arc, 0, arc, 1);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    index.push(a, c, d, a, d, b);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/**
 * Mantiene al jugador dentro del pasillo.
 *
 * Proyecta su posicion sobre la linea central y recorta el desplazamiento
 * lateral. Sin esto, al curvarse el camino se saldria por un muro caminando
 * recto, y el pasillo dejaria de llevar a ningun sitio.
 */
export function makeConstrainer(curve: THREE.CatmullRomCurve3, samples = 300) {
  const pts = curve.getSpacedPoints(samples);
  const maxLat = CORRIDOR_HALF - 0.9;

  return (pos: THREE.Vector3) => {
    // Se proyecta sobre el SEGMENTO mas cercano, no sobre el vertice mas
    // cercano: en las curvas cerradas el vertice mas proximo puede pertenecer
    // a un tramo cuya normal apunta a otro lado, y el recorte saldria torcido.
    let bestD = Infinity;
    let bx = 0;
    let bz = 0;
    let nx = 0;
    let nz = 0;

    for (let i = 0; i < samples; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const tx = b.x - a.x;
      const tz = b.z - a.z;
      const len2 = tx * tx + tz * tz;
      if (len2 < 1e-9) continue;

      let u = ((pos.x - a.x) * tx + (pos.z - a.z) * tz) / len2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;

      const cx = a.x + tx * u;
      const cz = a.z + tz * u;
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d = dx * dx + dz * dz;

      if (d < bestD) {
        bestD = d;
        bx = cx;
        bz = cz;
        const len = Math.sqrt(len2);
        nx = tz / len;
        nz = -tx / len;
      }
    }

    if (bestD === Infinity) return;

    const lat = (pos.x - bx) * nx + (pos.z - bz) * nz;
    if (Math.abs(lat) > maxLat) {
      const over = lat - Math.sign(lat) * maxLat;
      pos.x -= nx * over;
      pos.z -= nz * over;
    }
  };
}
