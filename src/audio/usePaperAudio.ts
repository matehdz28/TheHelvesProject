import { useEffect, useRef } from "react";
import { playWhenAllowed } from "./playWhenAllowed";

/**
 * Pista de la sala de hojas, y RELOJ de la coreografia.
 *
 * Va por elemento <audio> y no por AudioBuffer justo para esto: un
 * AudioBufferSourceNode no dice por donde va, y aqui los movimientos de las
 * cartas tienen que caer en compases concretos de la cancion. Leyendo
 * `currentTime` del elemento, la coreografia queda ENGANCHADA a la pista: si
 * el navegador tarda en arrancar por la politica de autoplay, o el audio da
 * un tiron, los visuales lo siguen en vez de desfasarse.
 */
export function usePaperAudio({
  active,
  src,
  startAt,
  gain = 0.85,
  fadeIn = 2.2,
  onEnded,
}: {
  active: boolean;
  src: string;
  /** segundo de la pista por el que empieza */
  startAt: number;
  gain?: number;
  fadeIn?: number;
  /** al acabarse la pista: aqui empieza lo que venga despues */
  onEnded?: () => void;
}) {
  /** posicion actual de la pista, en segundos */
  const time = useRef(0);
  // por referencia, para que cambiarla al vuelo no reinicie la reproduccion
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let raf = 0;
    const ctx = new AudioContext();

    const el = new Audio();
    el.crossOrigin = "anonymous"; // antes de src, o no aplica a la carga
    el.preload = "auto";
    el.loop = false;
    el.src = src;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(gain, ctx.currentTime + fadeIn);
    out.connect(ctx.destination);
    ctx.createMediaElementSource(el).connect(out);

    let stopRetry = () => {};
    const begin = () => {
      if (cancelled) return;
      try {
        el.currentTime = startAt;
      } catch {
        /* aun no es seekable */
      }
      stopRetry = playWhenAllowed(el);
    };

    if (el.readyState >= 1) begin();
    else el.addEventListener("loadedmetadata", begin, { once: true });

    const finish = () => ended.current?.();
    el.addEventListener("ended", finish);

    const resume = () => void ctx.resume().catch(() => {});
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resume));
    resume();

    const tick = () => {
      time.current = el.currentTime;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      events.forEach((e) => window.removeEventListener(e, resume));
      stopRetry();
      el.removeEventListener("ended", finish);
      el.pause();
      el.src = "";
      ctx.close().catch(() => {});
    };
  }, [active, src, startAt, gain, fadeIn]);

  return time;
}
