import * as THREE from "three";
import { PHRASES, ATLAS_COLS, ATLAS_ROWS } from "./phrases";

/**
 * Atlas de hojas: una celda por frase, 7 x 4.
 *
 * Ojo con la orientacion. CanvasTexture llega con flipY, asi que la fila 0 del
 * calculo de UV cae en la fila de ABAJO del canvas. Por eso al dibujar se
 * invierte la fila: sin eso, las frases saldrian en hojas distintas de las que
 * les tocan y el reparto garantizado no serviria de nada.
 */
const CELL_W = 292;
const CELL_H = 410; // ~1:1.4, la proporcion de la hoja

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function makePaperAtlas() {
  const W = CELL_W * ATLAS_COLS;
  const H = CELL_H * ATLAS_ROWS;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);

  let seed = 11;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  PHRASES.forEach((phrase, i) => {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const x0 = col * CELL_W;
    // fila invertida: compensa el flipY de la textura
    const y0 = (ATLAS_ROWS - 1 - row) * CELL_H;

    const m = CELL_W * 0.035;

    // el papel, con su tono propio
    const warm = 233 + Math.floor(rnd() * 16);
    ctx.fillStyle = `rgb(${warm}, ${warm - 3}, ${warm - 11})`;
    ctx.fillRect(x0 + m, y0 + m, CELL_W - m * 2, CELL_H - m * 2);

    // manchas de uso
    ctx.globalAlpha = 0.16;
    for (let k = 0; k < 7; k++) {
      const r = CELL_W * (0.08 + rnd() * 0.22);
      const gx = x0 + rnd() * CELL_W;
      const gy = y0 + rnd() * CELL_H;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, rnd() > 0.5 ? "#c8bfa9" : "#ffffff");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // la frase
    const pad = CELL_W * 0.13;
    const maxW = CELL_W - pad * 2;
    let size = CELL_W * 0.115;
    let lines: string[] = [];
    // se reduce el cuerpo hasta que la frase quepa en cinco renglones
    for (let attempt = 0; attempt < 8; attempt++) {
      ctx.font = `${size}px Georgia, Gelasio, "Times New Roman", serif`;
      lines = wrap(ctx, phrase, maxW);
      if (lines.length <= 5) break;
      size *= 0.87;
    }

    ctx.fillStyle = "rgba(28,26,24,0.88)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lh = size * 1.32;
    const startY = y0 + CELL_H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, k) => {
      ctx.fillText(ln, x0 + CELL_W / 2, startY + k * lh);
    });

    // subrayado suelto, para que no sea solo texto flotando
    ctx.strokeStyle = "rgba(40,38,34,0.35)";
    ctx.lineWidth = Math.max(1, CELL_W * 0.005);
    ctx.beginPath();
    const uy = startY + lines.length * lh - lh * 0.25;
    ctx.moveTo(x0 + pad + rnd() * 12, uy);
    ctx.lineTo(x0 + CELL_W - pad - rnd() * 20, uy + (rnd() - 0.5) * 6);
    ctx.stroke();

    // sombra de doblez
    const sh = ctx.createLinearGradient(x0, y0, x0 + CELL_W, y0 + CELL_H);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = sh;
    ctx.fillRect(x0 + m, y0 + m, CELL_W - m * 2, CELL_H - m * 2);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
