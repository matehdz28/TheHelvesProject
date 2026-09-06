import { useCallback, useEffect, useRef, useState } from "react";
import { sliceLoop } from "./sliceLoop";

/**
 * Ambiente de una sala: una ventana de pista en bucle, opcionalmente con una
 * primera pasada mas larga y con un segundo bucle al que saltar despues.
 *
 * Con `intro`, la estructura es la clasica de intro + bucle: la primera vuelta
 * va de `intro` a `end`, y a partir de ahi se repite `start` → `end`.
 *
 * Los trozos se programan en el RELOJ DE AUDIO, no con temporizadores de
 * JavaScript: el empalme cae en la muestra exacta y no se desliza aunque la
 * pestana se atasque.
 *
 * Las tres ventanas se recortan AL CARGAR. Cambiar de bucle no vuelve a pedir
 * ni a decodificar nada: solo cruza dos ganancias, asi que el salto es
 * instantaneo y sin hueco.
 */
export type LoopWindow = { start: number; end: number; gain?: number };

export type LoopTrackOptions = {
  src: string;
  /** a false ni carga ni suena: para entrar directo a una etapa posterior */
  active?: boolean;
  /** ventana a repetir, en segundos */
  start: number;
  end: number;
  /** si se indica, la primera pasada arranca aqui en vez de en `start` */
  intro?: number;
  /** segundo bucle, al que se salta con switchToAlt() */
  alt?: LoopWindow;
  gain?: number;
  /** crossfade en la costura. 0 = corte seco */
  crossfade?: number;
  /** segundos que tarda en entrar al arrancar */
  fadeIn?: number;
  /** segundos del cruce entre bucles */
  switchTime?: number;
};

type Status = "loading" | "waiting-gesture" | "playing" | "error";

type Graph = {
  ctx: AudioContext;
  out: GainNode;
  mainGain: GainNode;
  altGain: GainNode;
  altBuffer: AudioBuffer | null;
  altGainValue: number;
  switchTime: number;
  switched: boolean;
};

export function useLoopTrack({
  active = true,
  src,
  start,
  end,
  intro,
  alt,
  gain = 0.7,
  crossfade = 0.06,
  fadeIn = 2.5,
  switchTime = 0.9,
}: LoopTrackOptions) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const graph = useRef<Graph | null>(null);

  /** Apaga esta pista del todo. Idempotente. */
  const fadeOut = useCallback((seconds = 1.4) => {
    const g = graph.current;
    if (!g) return;
    const now = g.ctx.currentTime;
    g.out.gain.cancelScheduledValues(now);
    g.out.gain.setValueAtTime(g.out.gain.value, now);
    g.out.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.01, seconds));
  }, []);

  /** Cruza al segundo bucle. Idempotente. */
  const switchToAlt = useCallback(() => {
    const g = graph.current;
    if (!g || g.switched || !g.altBuffer) return;
    g.switched = true;

    const now = g.ctx.currentTime;
    const node = g.ctx.createBufferSource();
    node.buffer = g.altBuffer;
    node.loop = true;
    node.loopStart = 0;
    node.loopEnd = g.altBuffer.duration;
    node.connect(g.altGain);
    node.start(now);

    g.mainGain.gain.cancelScheduledValues(now);
    g.mainGain.gain.setValueAtTime(g.mainGain.gain.value, now);
    g.mainGain.gain.linearRampToValueAtTime(0.0001, now + g.switchTime);

    g.altGain.gain.cancelScheduledValues(now);
    g.altGain.gain.setValueAtTime(0.0001, now);
    g.altGain.gain.linearRampToValueAtTime(g.altGainValue, now + g.switchTime);
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
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

        // decodeAudioData expande la pista entera a PCM; nos quedamos con las
        // ventanas y soltamos el buffer grande enseguida
        const full = await ctx.decodeAudioData(raw);
        if (cancelled) return;

        // El bucle lleva crossfade en su costura; la intro no lo necesita
        // porque solo suena una vez y no se cierra sobre si misma.
        const loopBuf = sliceLoop(ctx, full, start, end, crossfade);
        const introBuf =
          intro !== undefined ? sliceLoop(ctx, full, intro, end, 0) : null;
        const altBuf = alt
          ? sliceLoop(ctx, full, alt.start, alt.end, crossfade)
          : null;

        const out = ctx.createGain();
        out.connect(ctx.destination);
        out.gain.setValueAtTime(0.0001, ctx.currentTime);
        out.gain.linearRampToValueAtTime(1, ctx.currentTime + Math.max(0.01, fadeIn));

        const mainGain = ctx.createGain();
        mainGain.gain.value = gain;
        mainGain.connect(out);

        const altGain = ctx.createGain();
        altGain.gain.value = 0.0001;
        altGain.connect(out);

        const t0 = ctx.currentTime + 0.05;

        if (introBuf) {
          const n = ctx.createBufferSource();
          n.buffer = introBuf;
          n.connect(mainGain);
          n.start(t0);
          nodes.push(n);
        }

        const loopNode = ctx.createBufferSource();
        loopNode.buffer = loopBuf;
        loopNode.loop = true;
        loopNode.loopStart = 0;
        loopNode.loopEnd = loopBuf.duration;
        loopNode.connect(mainGain);
        // el bucle entra justo cuando termina la intro, al sample
        loopNode.start(introBuf ? t0 + introBuf.duration : t0);
        nodes.push(loopNode);

        graph.current = {
          ctx,
          out,
          mainGain,
          altGain,
          altBuffer: altBuf,
          altGainValue: alt?.gain ?? gain,
          switchTime,
          switched: false,
        };

        // los navegadores no dejan sonar nada hasta un gesto del usuario
        const resume = async () => {
          if (!ctx || cancelled) return;
          try {
            await ctx.resume();
            if (!cancelled && ctx.state === "running") setStatus("playing");
          } catch {
            /* reintenta al siguiente gesto */
          }
        };
        onUnlock = () => void resume();
        unlockEvents.forEach((e) => window.addEventListener(e, onUnlock!));
        void resume();

        if (!cancelled) setStatus(ctx.state === "running" ? "playing" : "waiting-gesture");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (onUnlock) unlockEvents.forEach((e) => window.removeEventListener(e, onUnlock!));
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* ya detenido o aun sin arrancar */
        }
        n.disconnect();
      }
      graph.current = null;
      ctx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, src, start, end, intro, alt?.start, alt?.end, crossfade, gain, fadeIn]);

  return { status, error, switchToAlt, fadeOut };
}
