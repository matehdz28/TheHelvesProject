import * as THREE from "three";

/**
 * Texturas de la sala blanca, pintadas en canvas.
 *
 * La referencia es oleo con espatula: lo que se busca no es suciedad
 * fotografica sino HUELLA DE BROCHA. De ahi que todo sean trazos rectos,
 * largos y de bordes duros, en vez de manchas difusas.
 */
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function finish(c: HTMLCanvasElement, repeat: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

/** Hormigon: trazos VERTICALES, como la espatula bajando por el muro. */
export function makeConcrete(base: string, seed = 5) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const rnd = seeded(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  const col = new THREE.Color(base);
  const tint = (k: number) => {
    const x = col.clone().multiplyScalar(k);
    return `#${x.getHexString()}`;
  };

  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 190; i++) {
    const w = 2 + rnd() * 13;
    const h = S * (0.2 + rnd() * 0.8);
    ctx.fillStyle = tint(0.9 + rnd() * 0.2);
    ctx.fillRect(rnd() * S, rnd() * S - h * 0.4, w, h);
  }
  // algun trazo horizontal, como juntas de encofrado
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = tint(0.86 + rnd() * 0.1);
    ctx.fillRect(0, rnd() * S, S, 1 + rnd() * 3);
  }
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : tint(0.72);
    ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 4, 4 + rnd() * 40);
  }
  ctx.globalAlpha = 1;

  return finish(c, [1, 1]);
}

/**
 * Explanada: paneles con junta, y manchas de tono verdoso y amarillento.
 * Las juntas son lo que da escala al suelo; sin ellas no se sabe si mides dos
 * metros o doscientos.
 */
export function makeGround(base: string, seed = 19) {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const rnd = seeded(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    const w = 40 + rnd() * 200;
    const h = 30 + rnd() * 150;
    ctx.fillStyle = rnd() > 0.55 ? "#d7dfa4" : rnd() > 0.4 ? "#f2f4d6" : "#c9d49a";
    ctx.fillRect(rnd() * S, rnd() * S, w, h);
  }
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "#8ea55a";
    ctx.fillRect(rnd() * S, rnd() * S, 30 + rnd() * 90, 14 + rnd() * 40);
  }
  ctx.globalAlpha = 1;

  // juntas de losa
  ctx.strokeStyle = "rgba(120,126,86,0.42)";
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const y = (S * (i + 0.5)) / 6 + (rnd() - 0.5) * 20;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + (rnd() - 0.5) * 10);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const x = (S * (i + 0.5)) / 5 + (rnd() - 0.5) * 24;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rnd() - 0.5) * 12, S);
    ctx.stroke();
  }

  return finish(c, [14, 14]);
}

/** Cielo: degradado vertical, mas denso arriba, como en la referencia. */
export function makeSkyGradient(top: string, horizon: string) {
  const { c, ctx } = canvas(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.62, horizon);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Grano fino y denso, el de la referencia monocroma.
 *
 * Nada que ver con el hormigon de brocha: aqui no hay trazo, solo ruido
 * apretado. Es lo que convierte una cara plana en superficie, y sin el, a esta
 * escala, los monolitos se leerian como poligonos de color liso.
 */
export function makeGrain(base: string, seed = 31) {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const rnd = seeded(seed);

  const col = new THREE.Color(base);
  const img = ctx.createImageData(S, S);
  const d = img.data;

  for (let i = 0; i < S * S; i++) {
    // dos escalas de ruido: una fina y otra de mancha, para que no sea
    // television sin senal
    const fine = (rnd() - 0.5) * 0.19;
    const x = i % S;
    const y = (i / S) | 0;
    const blot = (Math.sin(x * 0.06 + seed) + Math.cos(y * 0.045 - seed)) * 0.018;
    const k = 1 + fine + blot;
    d[i * 4] = Math.max(0, Math.min(255, col.r * 255 * k));
    d[i * 4 + 1] = Math.max(0, Math.min(255, col.g * 255 * k));
    d[i * 4 + 2] = Math.max(0, Math.min(255, col.b * 255 * k));
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  return finish(c, [10, 10]);
}

/**
 * Grano NEUTRO, para usar como `map` sobre materiales de color.
 *
 * Casi blanco: no tine, solo modula. Asi una sola textura sirve para todos los
 * volumenes y el gris de cada cara lo pone el material, no el mapa. Si el
 * grano llevara color, habria que generar uno por tono y ademas se pelearia
 * con la iluminacion.
 *
 * Dos escalas mezcladas: el punteado fino del yeso lijado y una veta lenta que
 * evita que se lea como ruido de television.
 */
export function makeGrainMap(seed = 41, size = 512) {
  const { c, ctx } = canvas(size, size);
  const rnd = seeded(seed);
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = (i / size) | 0;
    const fine = (rnd() - 0.5) * 0.26;
    const slow =
      (Math.sin(x * 0.021 + seed) + Math.cos(y * 0.017 - seed * 0.7)) * 0.022;
    const v = Math.max(0, Math.min(255, 236 * (1 + fine + slow)));
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, [1, 1]);
}
