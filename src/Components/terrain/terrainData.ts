import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";

/**
 * Puerto del ejemplo webgl_geometry_terrain de three.js.
 *
 * Unica desviacion deliberada: el ejemplo PISA window.Math.random con su
 * generador con semilla y nunca lo restaura, lo que envenenaria Math.random
 * para toda la app. Aca el generador es local y se pasa a mano, en el mismo
 * orden de llamadas, asi que el terreno sale identico.
 */

export const WORLD_WIDTH = 256;
export const WORLD_DEPTH = 256;
export const PLANE_SIZE = 7500;
export const HEIGHT_SCALE = 10;
/** Blanco glaciar. Medido del GIF de referencia: la banda de horizonte
 *  promedia #ebeaed y el terreno tiene un sesgo frio de ~+10 de azul sobre
 *  rojo, con el rango de luma completo (grietas negras sobre nieve). */
export const FOG_COLOR = 0xf2f4f7;
/** Mas suelta que el 0.0025 del ejemplo: hay que ver el terreno espejado de
 *  arriba, que queda mas lejos que el suelo. */
export const FOG_DENSITY = 0.00115;
/** Altura a la que se vuela sobre el terreno. Se va pegado a el. */
export const RIDE_HEIGHT = 90;
/**
 * Separacion vertical entre el terreno y su copia de arriba.
 *
 * El techo es una copia TRASLADADA, no un espejo. Con un espejo sobre un
 * plano fijo la separacion vale 2P - 2h: cambia con el terreno y se abre
 * enormemente en los valles, que es justo lo que dejaba solo blanco al
 * frente. Trasladada, la ranura mide CEILING_SLOT en todos los puntos, asi
 * que yendo pegado al suelo el techo queda SIEMPRE a la misma distancia y
 * nunca se pueden cruzar.
 */
export const CEILING_SLOT = 650;

function makeRandom() {
  let seed = Math.PI / 4;
  return () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

function generateHeight(width: number, height: number, random: () => number) {
  const size = width * height;
  const data = new Uint8Array(size);
  const perlin = new ImprovedNoise();
  const z = random() * 100;

  let quality = 1;

  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < size; i++) {
      const x = i % width;
      const y = ~~(i / width);
      data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
    }
    quality *= 5;
  }

  return data;
}

/**
 * Envuelve una coordenada de mundo dentro del tile, REFLEJANDO en cada
 * frontera. El terreno se tesela infinito con copias alternas espejadas: al
 * compartir la fila del borde, dos tiles vecinos encajan exacto y no hay
 * costura, cosa que con repeticion simple si habria (los bordes opuestos del
 * heightmap no coinciden).
 */
export function mirrorWrap(u: number) {
  const period = PLANE_SIZE * 2;
  let t = ((u + PLANE_SIZE / 2) % period + period) % period;
  if (t > PLANE_SIZE) t = period - t;
  return t - PLANE_SIZE / 2;
}

/** signo de espejado del tile i: los impares van reflejados */
export const tileSign = (i: number) => (((i % 2) + 2) % 2 === 0 ? 1 : -1);

type Palette = (shade: number, height: number) => [number, number, number];

/**
 * Hielo. Valores resueltos numericamente contra el GIF de referencia, no a
 * ojo: en este terreno `shade` promedia 0.129 (rango -0.80..1.00), no ~0.58,
 * porque las laderas son tan escarpadas que las normales apuntan de lado.
 * Va algo mas oscura que la referencia a proposito: la niebla la levanta
 * hacia el blanco al renderizar.
 */
export const icePalette: Palette = (shade, h) => {
  const L = (165 + shade * 140) * (0.55 + h * 0.005);
  return [L - 4, L, L + 8];
};

/**
 * Azul con cimas blancas. La altura pesa mas que la luz para que sean las
 * CIMAS las que se vuelven blancas, no las caras iluminadas. El azul arranca
 * alto y sube despacio, asi que las sombras quedan azul saturado en vez de
 * negras, y solo lo mas alto llega a blanco diamante.
 */
export const bluePalette: Palette = (shade, h) => {
  const lit = (shade + 0.8) / 1.8;
  const k = Math.max(0, Math.min(1, lit * 0.42 + (h / 163) * 0.78));
  return [
    16 + 228 * Math.pow(k, 1.6),
    20 + 226 * Math.pow(k, 1.5),
    140 + 115 * Math.pow(k, 0.7),
  ];
};

function generateTexture(
  data: Uint8Array,
  width: number,
  height: number,
  random: () => number,
  palette: Palette
) {
  const vector3 = new THREE.Vector3(0, 0, 0);
  const sun = new THREE.Vector3(1, 1, 1);
  sun.normalize();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  let context = canvas.getContext("2d")!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);

  let image = context.getImageData(0, 0, canvas.width, canvas.height);
  let imageData = image.data;

  for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
    vector3.x = data[j - 2] - data[j + 2];
    vector3.y = 2;
    vector3.z = data[j - width * 2] - data[j + width * 2];
    vector3.normalize();

    const shade = vector3.dot(sun);

    // Rampa de hielo en vez de la de arena del ejemplo. La luminancia la
    // manda el sombreado (rango amplio: grietas oscuras, nieve quemada) y la
    // altura aclara las cimas. El tinte frio va como offset constante para
    // que las sombras salgan azules, como en la nieve real.
    const [r, g, b] = palette(shade, data[j]);
    imageData[i] = r;
    imageData[i + 1] = g;
    imageData[i + 2] = b;
  }

  context.putImageData(image, 0, 0);

  // Scaled 4x
  const canvasScaled = document.createElement("canvas");
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext("2d")!;
  context.scale(4, 4);
  context.drawImage(canvas, 0, 0);

  image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
  imageData = image.data;

  for (let i = 0, l = imageData.length; i < l; i += 4) {
    const v = ~~(random() * 5);
    imageData[i] += v;
    imageData[i + 1] += v;
    imageData[i + 2] += v;
  }

  context.putImageData(image, 0, 0);

  return canvasScaled;
}

export type Terrain = {
  data: Uint8Array;
  /** altura maxima del terreno, en unidades de mundo */
  maxHeight: number;
  /** desplazamiento vertical de la copia de arriba */
  ceilingOffsetY: number;
  geometry: THREE.PlaneGeometry;
  /** textura de hielo (fase 1) */
  texture: THREE.CanvasTexture;
  /** textura azul con cimas blancas (fase 3) */
  blueTexture: THREE.CanvasTexture;
  /** altura del terreno en coordenadas de mundo, con interpolacion bilineal */
  heightAt: (x: number, z: number) => number;
  /** semiextension del terreno en X/Z */
  half: number;
};

let cached: Terrain | null = null;

/**
 * Se genera una sola vez: son 65k evaluaciones de Perlin y ~1M de llamadas
 * al generador para el ruido de la textura. La malla y el sampler de altura
 * comparten el mismo array `data`, asi que caminas exactamente sobre lo que
 * ves, sin raycast.
 */
export function getTerrain(): Terrain {
  if (cached) return cached;

  const random = makeRandom();
  const data = generateHeight(WORLD_WIDTH, WORLD_DEPTH, random);

  const geometry = new THREE.PlaneGeometry(
    PLANE_SIZE,
    PLANE_SIZE,
    WORLD_WIDTH - 1,
    WORLD_DEPTH - 1
  );
  geometry.rotateX(-Math.PI / 2);

  const vertices = geometry.attributes.position.array as Float32Array;
  for (let i = 0, j = 0; i < data.length; i++, j += 3) {
    vertices[j + 1] = data[i] * HEIGHT_SCALE;
  }
  geometry.attributes.position.needsUpdate = true;

  const makeTex = (palette: Palette) => {
    const tex = new THREE.CanvasTexture(
      generateTexture(data, WORLD_WIDTH, WORLD_DEPTH, random, palette)
    );
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  // ambas se generan al cargar: hacerlo a mitad del vuelo daria un tiron
  const texture = makeTex(icePalette);
  const blueTexture = makeTex(bluePalette);

  const half = PLANE_SIZE / 2;

  let peak = 0;
  for (const v of data) if (v > peak) peak = v;
  const maxHeight = peak * HEIGHT_SCALE;

  const ceilingOffsetY = CEILING_SLOT;

  /**
   * Tras rotateX(-PI/2): mundo x = plano x, mundo z = -plano y. Como el plano
   * genera y de +half a -half, tanto ix como iy crecen con x y z de mundo.
   * Vertice i = iy * WORLD_WIDTH + ix, que es el mismo indice que usa
   * generateHeight (i = y * width + x).
   */
  const heightAt = (x: number, z: number) => {
    const lx = mirrorWrap(x);
    const lz = mirrorWrap(z);
    const u = ((lx + half) / PLANE_SIZE) * (WORLD_WIDTH - 1);
    const v = ((lz + half) / PLANE_SIZE) * (WORLD_DEPTH - 1);

    const x0 = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(u)));
    const z0 = Math.max(0, Math.min(WORLD_DEPTH - 1, Math.floor(v)));
    const x1 = Math.min(WORLD_WIDTH - 1, x0 + 1);
    const z1 = Math.min(WORLD_DEPTH - 1, z0 + 1);

    const fx = u - x0;
    const fz = v - z0;

    const h00 = data[z0 * WORLD_WIDTH + x0];
    const h10 = data[z0 * WORLD_WIDTH + x1];
    const h01 = data[z1 * WORLD_WIDTH + x0];
    const h11 = data[z1 * WORLD_WIDTH + x1];

    const a = h00 + (h10 - h00) * fx;
    const b = h01 + (h11 - h01) * fx;
    return (a + (b - a) * fz) * HEIGHT_SCALE;
  };

  cached = { data, maxHeight, ceilingOffsetY, geometry, texture, blueTexture, heightAt, half };
  return cached;
}
