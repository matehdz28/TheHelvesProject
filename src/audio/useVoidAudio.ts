import { useEffect, useState } from "react";
import { sliceLoop } from "./sliceLoop";

/**
 * Las dos capas del vacio, de una misma pista.
 *
 *  - `stutter`: una ventana cortisima en bucle, a volumen fijo y bajo. Es el
 *    sonido de estar atascado.
 *  - `release` : la pista siguiendo desde donde acaba ese bucle. Arranca muda
 *    y sube segun te acercas al portal, asi que el avance parece soltar lo que
 *    estaba trabado.
 *
 * La proximidad llega por REFERENCIA, no por prop: se escribe desde el bucle
 * de render de three y se lee en un rAF propio, sin renders de React de por
 * medio.
 */
export type VoidAudioOptions = {
  src: string;
  active: boolean;
  stutter: { start: number; end: number; gain: number };
  /** la continuacion; `end` deja cola para el crossfade del bucle */
  release: { start: number; end: number; gain: number };
  /** >1 = entra mas tarde y de golpe al final */
  curve?: number;
  crossfade?: number;
  fadeIn?: number;
};

export function useVoidAudio(
  proximity: React.MutableRefObject<number>,
  {
    src,
    active,
    stutter,
    release,
    curve = 1.4,
    crossfade = 0.06,
    fadeIn = 1.6,
  }: VoidAudioOptions
) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    const nodes: AudioBufferSourceNode[] = [];

    const unlockEvents = ["pointerdown", "keydown", "touchstart"] as const;
    let onUnlock: (() => void) | null = null;

    (async () => {
      try {
        ctx = new AudioContext();

        const res = await fetch(src);
        if (!res.ok) throw new Error(`${res.status} al cargar ${src}`);
        const raw = await res.arrayBuffer();
        if (cancelled) return;

        const full = await ctx.decodeAudioData(raw);
        if (cancelled) return;

        const stutterBuf = sliceLoop(ctx, full, stutter.start, stutter.end, crossfade);
        const releaseBuf = sliceLoop(ctx, full, release.start, release.end, crossfade);

        const out = ctx.createGain();
        out.connect(ctx.destination);
        out.gain.setValueAtTime(0.0001, ctx.currentTime);
        out.gain.linearRampToValueAtTime(1, ctx.currentTime + Math.max(0.01, fadeIn));

        const stutterGain = ctx.createGain();
        stutterGain.gain.value = stutter.gain;
        stutterGain.connect(out);

        const releaseGain = ctx.createGain();
        releaseGain.gain.value = 0; // la sube la cercania al portal
        releaseGain.connect(out);

        const start = (buf: AudioBuffer, dest: GainNode) => {
          const n = ctx!.createBufferSource();
          n.buffer = buf;
          n.loop = true;
          n.loopStart = 0;
          n.loopEnd = buf.duration;
          n.connect(dest);
          n.start();
          nodes.push(n);
        };

        start(stutterBuf, stutterGain);
        start(releaseBuf, releaseGain);

        const resume = async () => {
          if (!ctx || cancelled) return;
          try {
            await ctx.resume();
          } catch {
            /* al siguiente gesto */
          }
        };
        onUnlock = () => void resume();
        unlockEvents.forEach((e) => window.addEventListener(e, onUnlock!));
        void resume();

        const tick = () => {
          const p = Math.min(1, Math.max(0, proximity.current || 0));
          releaseGain.gain.value = release.gain * Math.pow(p, curve);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (onUnlock) unlockEvents.forEach((e) => window.removeEventListener(e, onUnlock!));
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* ya detenido */
        }
        n.disconnect();
      }
      ctx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, src, stutter.start, stutter.end, release.start, release.end, crossfade]);

  return { error };
}
