import { useCallback, useEffect, useRef, useState } from "react";
import { sliceLoop } from "./sliceLoop";

/**
 * Audio del portal, en dos mundos.
 *
 * MUNDO A (antes de cruzar) — dos bucles cortos superpuestos:
 *   - `base` : suena siempre, volumen fijo.
 *   - `near` : se monta encima, su volumen sigue la cercania al portal (0..1).
 *   Duran distinto a proposito, asi que se desfasan y nunca repiten la misma
 *   combinacion.
 *
 * MUNDO B (despues de cruzar) — los bucles se disuelven y entra `tail`:
 *   la pista corriendo de largo desde un punto fijo. Al ser minutos de audio
 *   y no un bucle corto, va por <audio> en streaming en vez de PCM en RAM.
 *
 * Grafo:
 *   base → baseGain ┐
 *                   ├→ aGroup ┐
 *   near → nearGain ┘         ├→ master → salida
 *   tail(<audio>) → tailGain ─┘
 *
 * `aGroup` y `tailGain` se cruzan al atravesar el portal. El volumen de
 * proximidad sigue escribiendose en `nearGain`, por debajo, sin conflicto.
 */

export type Window = { start: number; end: number };

/** Numero de bandas espaciadas logaritmicamente que se extraen del espectro. */
export const BANDS = 24;

/**
 * Lo que el audio le pasa a los visuales, actualizado cada frame. Es un objeto
 * MUTABLE que se lee por referencia: no provoca renders de React.
 */
export type AudioLevels = {
  /** energia global 0..1 */
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** BANDAS log del espectro, 0..1 cada una */
  bands: Float32Array;
};

export type PortalAudioOptions = {
  src: string;
  base: Window;
  near: Window;
  /** capa del mundo B: arranca en `start` y sigue de largo */
  tail: { start: number; gain?: number; loop?: boolean };
  /** pista del desenlace: entra mientras todo lo demas se apaga */
  finale: { src: string; gain?: number };
  baseGain?: number;
  nearGain?: number;
  /** exponente de la curva de cercania: >1 = entra mas tarde y mas de golpe */
  curve?: number;
  /** crossfade en el punto de bucle, en segundos. 0 = corte seco */
  crossfade?: number;
  /** segundos que tardan en disolverse los bucles al cruzar */
  fadeOut?: number;
  /** segundos que tarda en entrar la capa del mundo B */
  fadeIn?: number;
  master?: number;
};

type Status = "loading" | "waiting-gesture" | "playing" | "error";

function ramp(p: AudioParam, to: number, dur: number, now: number) {
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(to, now + Math.max(0.01, dur));
}

type Graph = {
  ctx: AudioContext;
  aGroup: GainNode;
  tailGain: GainNode;
  /** salida final; solo la toca el fundido, para no pelearse con el bucle
   *  por frame que reescribe master */
  out: GainNode;
  el: HTMLAudioElement;
  finaleGain: GainNode;
  finaleEl: HTMLAudioElement;
};

export function usePortalAudio(
  chargeRef: React.MutableRefObject<number>,
  /** true una vez que el jugador esta del otro lado del portal */
  crossed: boolean,
  {
    src,
    base,
    near,
    tail,
    finale,
    baseGain = 0.55,
    nearGain = 0.9,
    curve = 1.6,
    crossfade = 0.06,
    fadeOut = 1.1,
    fadeIn = 0.4,
    master = 1,
  }: PortalAudioOptions
) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const graph = useRef<Graph | null>(null);

  const levels = useRef<AudioLevels>({
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    bands: new Float32Array(BANDS),
  });

  /**
   * Desenlace: cruza en `seconds` lo que sonaba hacia silencio mientras entra
   * la pista final. Al terminar detiene la primera del todo, para que no siga
   * decodificando en silencio.
   */
  const beginFinale = useCallback((seconds: number, finaleGain = 0.85) => {
    const g = graph.current;
    if (!g) return;
    const now = g.ctx.currentTime;

    ramp(g.out.gain, 0, seconds, now);
    ramp(g.finaleGain.gain, finaleGain, seconds, now);

    g.finaleEl.currentTime = 0;
    void g.finaleEl.play().catch(() => {});

    window.setTimeout(() => {
      graph.current?.el.pause();
    }, seconds * 1000 + 200);
  }, []);

  /** Salta la capa larga a un punto concreto de la pista, en segundos. */
  const seekTail = useCallback((seconds: number) => {
    const g = graph.current;
    if (!g) return;
    const jump = () => {
      try {
        g.el.currentTime = seconds;
      } catch {
        /* aun no es seekable */
      }
      void g.el.play().catch(() => {});
    };
    if (g.el.readyState >= 1) jump();
    else g.el.addEventListener("loadedmetadata", jump, { once: true });
  }, []);

  // refs para que cambiar volumenes no reinicie el audio
  const cfg = useRef({ baseGain, nearGain, curve, master });
  cfg.current = { baseGain, nearGain, curve, master };

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let sources: AudioBufferSourceNode[] = [];
    let el: HTMLAudioElement | null = null;
    let finaleEl: HTMLAudioElement | null = null;

    const unlockEvents = ["pointerdown", "keydown", "touchstart"] as const;
    let onUnlock: (() => void) | null = null;
    let onEnded: (() => void) | null = null;

    (async () => {
      try {
        ctx = new AudioContext();

        const res = await fetch(src);
        if (!res.ok) throw new Error(`${res.status} al cargar ${src}`);
        const raw = await res.arrayBuffer();
        if (cancelled) return;

        // decodeAudioData expande la pista entera a PCM. Nos quedamos solo
        // con las dos ventanas cortas y soltamos el buffer grande enseguida;
        // la capa larga del mundo B no pasa por aqui, va en streaming.
        const full = await ctx.decodeAudioData(raw);
        if (cancelled) return;

        const baseBuf = sliceLoop(ctx, full, base.start, base.end, crossfade);
        const nearBuf = sliceLoop(ctx, full, near.start, near.end, crossfade);

        const masterNode = ctx.createGain();
        masterNode.gain.value = cfg.current.master;

        // Nodo de salida aparte: el bucle por frame reescribe master.gain
        // cada frame, lo que pisaria cualquier automatizacion programada.
        const outNode = ctx.createGain();
        outNode.gain.value = 1;
        masterNode.connect(outNode);
        outNode.connect(ctx.destination);

        // Derivacion de analisis, DESPUES del fundido: asi la gota se va
        // calmando sola a medida que baja el volumen.
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.72;
        outNode.connect(analyser);
        const spectrum = new Uint8Array(analyser.frequencyBinCount);

        /**
         * Bordes de banda log. Repartir los bins linealmente dejaria casi
         * todas las bandas en agudos vacios: la energia musical se concentra
         * en la parte baja del espectro.
         */
        const topBin = Math.floor(analyser.frequencyBinCount * 0.55);
        const edges = new Uint16Array(BANDS + 1);
        for (let b = 0; b <= BANDS; b++) {
          edges[b] = Math.max(
            1,
            Math.round(Math.pow(topBin, b / BANDS))
          );
        }

        // grupo del mundo A: se disuelve entero al cruzar
        const aGroup = ctx.createGain();
        aGroup.gain.value = crossed ? 0 : 1;
        aGroup.connect(masterNode);

        const baseNode = ctx.createGain();
        baseNode.gain.value = cfg.current.baseGain;
        baseNode.connect(aGroup);

        const nearNode = ctx.createGain();
        nearNode.gain.value = 0; // lo sube la proximidad
        nearNode.connect(aGroup);

        const mk = (buf: AudioBuffer, out: GainNode) => {
          const n = ctx!.createBufferSource();
          n.buffer = buf;
          n.loop = true;
          n.loopStart = 0;
          n.loopEnd = buf.duration;
          n.connect(out);
          n.start();
          sources.push(n);
        };

        mk(baseBuf, baseNode);
        mk(nearBuf, nearNode);

        // capa del mundo B, en streaming desde el elemento
        el = new Audio();
        el.crossOrigin = "anonymous"; // antes de src, o no aplica a la carga
        el.preload = "auto";
        el.loop = false; // el bucle vuelve a `tail.start`, no a 0
        el.src = src;
        const tailGain = ctx.createGain();
        tailGain.gain.value = 0;
        tailGain.connect(masterNode);
        ctx.createMediaElementSource(el).connect(tailGain);

        if (tail.loop !== false) {
          onEnded = () => {
            if (!el || cancelled) return;
            el.currentTime = tail.start;
            void el.play().catch(() => {});
          };
          el.addEventListener("ended", onEnded);
        }

        // Pista del desenlace. Cuelga DIRECTO de la salida del contexto, sin
        // pasar por outNode: ese se esta desvaneciendo a cero y se la llevaria
        // por delante.
        finaleEl = new Audio();
        finaleEl.crossOrigin = "anonymous";
        finaleEl.preload = "auto";
        finaleEl.loop = false;
        finaleEl.src = finale.src;
        const finaleGain = ctx.createGain();
        finaleGain.gain.value = 0;
        finaleGain.connect(ctx.destination);
        ctx.createMediaElementSource(finaleEl).connect(finaleGain);

        graph.current = { ctx, aGroup, tailGain, out: outNode, el, finaleGain, finaleEl };

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

        if (!cancelled) {
          setStatus(ctx.state === "running" ? "playing" : "waiting-gesture");
        }

        const tick = () => {
          const c = Math.min(1, Math.max(0, chargeRef.current || 0));
          const { nearGain: ng, curve: cv, baseGain: bg, master: mv } = cfg.current;
          // charge ya viene amortiguado desde PortalFrame, no hay zipper
          nearNode.gain.value = ng * Math.pow(c, cv);
          baseNode.gain.value = bg;
          masterNode.gain.value = mv;

          analyser.getByteFrequencyData(spectrum);
          const L = levels.current;
          let sum = 0;
          for (let b = 0; b < BANDS; b++) {
            let acc = 0;
            let cnt = 0;
            for (let i = edges[b]; i < Math.max(edges[b] + 1, edges[b + 1]); i++) {
              acc += spectrum[i];
              cnt++;
            }
            const v = cnt ? acc / cnt / 255 : 0;
            // suavizado extra sobre el del analizador: sin el, la malla tirita
            L.bands[b] = L.bands[b] * 0.6 + v * 0.4;
            sum += L.bands[b];
          }
          const mean = (a: number, b: number) => {
            let t = 0;
            for (let i = a; i < b; i++) t += L.bands[i];
            return t / (b - a);
          };
          L.level = sum / BANDS;
          L.bass = mean(0, 6);
          L.mid = mean(6, 15);
          L.treble = mean(15, BANDS);

          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (onUnlock) unlockEvents.forEach((e) => window.removeEventListener(e, onUnlock!));
      if (el && onEnded) el.removeEventListener("ended", onEnded);
      if (el) {
        el.pause();
        el.src = "";
      }
      if (finaleEl) {
        finaleEl.pause();
        finaleEl.src = "";
      }
      sources.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* ya detenido */
        }
        n.disconnect();
      });
      sources = [];
      graph.current = null;
      ctx?.close().catch(() => {});
    };
    // el grafo se reconstruye solo si cambia la pista o las ventanas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, finale.src, base.start, base.end, near.start, near.end, tail.start, crossfade, chargeRef]);

  // cruce de mundos: disuelve los bucles, entra la pista larga
  useEffect(() => {
    const g = graph.current;
    if (!g) return;

    const now = g.ctx.currentTime;

    if (crossed) {
      ramp(g.aGroup.gain, 0, fadeOut, now);
      ramp(g.tailGain.gain, tail.gain ?? 0.85, fadeIn, now);

      const startTail = () => {
        if (!graph.current) return;
        try {
          g.el.currentTime = tail.start;
        } catch {
          /* aun no es seekable, lo reintenta loadedmetadata */
        }
        void g.el.play().catch(() => {});
      };

      if (g.el.readyState >= 1 /* HAVE_METADATA */) startTail();
      else g.el.addEventListener("loadedmetadata", startTail, { once: true });
    } else {
      ramp(g.aGroup.gain, 1, fadeIn, now);
      ramp(g.tailGain.gain, 0, fadeOut, now);
      g.el.pause();
    }
  }, [crossed, status, tail.start, tail.gain, fadeIn, fadeOut]);

  return { status, error, seekTail, beginFinale, levels };
}
