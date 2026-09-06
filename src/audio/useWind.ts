import { useEffect } from "react";

/**
 * Viento: ruido filtrado, a volumen bajo.
 *
 * El ruido blanco crudo suena a television sin senal. Lo que lo convierte en
 * viento son dos modulaciones lentas y desincronizadas: una sobre la
 * frecuencia de corte del filtro (el silbido sube y baja) y otra sobre el
 * volumen (las rachas). Al ir a periodos distintos y primos entre si, nunca
 * caen en fase y no se oye un patron.
 */
export function useWind({
  active = true,
  gain = 0.055,
  fadeIn = 4,
}: {
  active?: boolean;
  gain?: number;
  fadeIn?: number;
} = {}) {
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const ctx = new AudioContext();

    // 3 s de ruido rosado-ish en bucle: mas corto se nota la repeticion
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      // filtro de un polo x3: quita el brillo agudo del ruido blanco
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.288;
      b2 = 0.57 * b2 + w * 1.022;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    // rampa en los extremos para que la costura del bucle no chasquee
    const ramp = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < ramp; i++) {
      const t = i / ramp;
      d[i] *= t;
      d[len - 1 - i] *= t;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    lp.Q.value = 0.7;

    // modulacion del corte: el silbido va y viene
    const swirl = ctx.createOscillator();
    swirl.frequency.value = 0.063;
    const swirlAmt = ctx.createGain();
    swirlAmt.gain.value = 260;
    swirl.connect(swirlAmt).connect(lp.frequency);

    const out = ctx.createGain();
    out.gain.value = 0;

    // rachas, a otro periodo para que no coincidan nunca
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.041;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 0.4;
    gust.connect(gustAmt).connect(out.gain);

    src.connect(lp).connect(out).connect(ctx.destination);
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(gain, ctx.currentTime + fadeIn);

    src.start();
    swirl.start();
    gust.start();

    const resume = () => void ctx.resume().catch(() => {});
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resume));
    resume();

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, resume));
      for (const n of [src, swirl, gust]) {
        try {
          n.stop();
        } catch {
          /* ya detenido */
        }
      }
      void cancelled;
      ctx.close().catch(() => {});
    };
  }, [active, gain, fadeIn]);
}
