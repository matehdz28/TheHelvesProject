import { useEffect, useRef } from "react";
import { sliceLoop } from "./sliceLoop";
import { playWhenAllowed } from "./playWhenAllowed";

/**
 * La pista de la subida por la escalera.
 *
 * Tiene dos vidas: mientras se sube suena SOLO una ventana corta en bucle, y
 * su volumen lo dicta la altura del jugador. Al coronar, la misma pista
 * arranca desde el mismo punto y ya sigue entera.
 *
 * Del archivo se decodifica todo pero solo se CONSERVA la ventana. Dos minutos
 * y medio de estereo descodificados son decenas de megas residentes, y de eso
 * aqui solo se usan dos segundos; el resto se suelta en cuanto esta recortado.
 * Para la reproduccion entera se usa un elemento <audio>, que va en flujo y no
 * necesita tener nada en memoria.
 *
 * El volumen no se escribe directamente sino con setTargetAtTime: el nivel
 * viene de la posicion del jugador, que cambia cada fotograma, y asignarlo en
 * crudo produce chasquidos.
 *
 * El bucle y la pista entera tienen ganancias SEPARADAS. El bucle acompana la
 * subida y va de fondo; la pista entera es el final y suena a volumen normal.
 * Con un solo numero para las dos no se puede bajar el fondo sin apagar
 * tambien el desenlace.
 *
 * Y ademas del nivel por altura hay una ENTRADA lenta e independiente: la
 * pista puede empezar con el jugador ya a media escalera, y sin ella entraria
 * de golpe a lo que marque su altura en ese momento.
 *
 * Todo pasa por un ANALIZADOR antes de salir, para que la escena pueda
 * moverse con lo que suena. Se mide en tres bandas y no en volumen total
 * porque no reaccionan a lo mismo: el bombo esta en el grave, el ambiente en
 * el medio y los platos en el agudo, y mezclarlos da un numero que sube y baja
 * sin corresponderse con nada que se oiga.
 *
 * Cada banda se normaliza contra su PROPIO maximo reciente, que decae. Con una
 * escala fija, una pista mas apagada no moveria nada y otra mas caliente
 * saturaria siempre; asi el rango util se ajusta solo a lo que este sonando.
 */
export function useAscentTrack({
  active,
  src,
  from,
  to,
  loopGain = 0.28,
  fullGain = 0.85,
  floor = 0.02,
  fadeIn = 12,
  onEnded,
}: {
  active: boolean;
  src: string;
  /** ventana que se repite mientras se sube, en segundos */
  from: number;
  to: number;
  /** techo del bucle de la subida, en el remate de la escalera */
  loopGain?: number;
  /** la pista entera, ya arriba */
  fullGain?: number;
  /** volumen al pie de la escalera: casi nada, pero no cero */
  floor?: number;
  /** cuanto tarda el bucle en aparecer, independiente de la altura */
  fadeIn?: number;
  /** al acabarse la pista entera: aqui se apaga todo */
  onEnded?: () => void;
}) {
  /** 0 al pie de la escalera, 1 en el remate. Lo escribe la escena. */
  const level = useRef(0);
  /** llamar al coronar: cambia el bucle por la pista entera */
  const playFull = useRef<() => void>(() => {});
  /** grave, medio y agudo de lo que suena ahora, de 0 a 1 */
  const bands = useRef({ bass: 0, mid: 0, high: 0 });
  /** segundo de la pista entera, o -1 mientras solo va el bucle */
  const time = useRef(-1);
  // por referencia, para que cambiarla al vuelo no reinicie la reproduccion
  const ended = useRef(onEnded);
  ended.current = onEnded;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let raf = 0;
    let full = false;
    let started = 0;
    const ctx = new AudioContext();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    // suaviza lo justo: mas alto se pierde el ataque del bombo, mas bajo
    // tiembla y el salto de la gente parece un temblor en vez de un compas
    analyser.smoothingTimeConstant = 0.68;
    analyser.connect(ctx.destination);
    const spectrum = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const peak = { bass: 0.06, mid: 0.06, high: 0.06 };

    const loopOut = ctx.createGain();
    loopOut.gain.value = 0;
    loopOut.connect(analyser);

    let loopSrc: AudioBufferSourceNode | null = null;
    let el: HTMLAudioElement | null = null;
    let stopRetry = () => {};

    void (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`${res.status} al cargar ${src}`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (cancelled) return;
        const win = sliceLoop(ctx, buf, from, to, 0.05);
        loopSrc = ctx.createBufferSource();
        loopSrc.buffer = win;
        loopSrc.loop = true;
        loopSrc.connect(loopOut);
        loopSrc.start();
        started = ctx.currentTime;
      } catch {
        /* sin pista, la escena sigue con el viento */
      }
    })();

    playFull.current = () => {
      if (full || cancelled) return;
      full = true;

      const now = ctx.currentTime;
      loopOut.gain.cancelScheduledValues(now);
      loopOut.gain.setValueAtTime(loopOut.gain.value, now);
      loopOut.gain.linearRampToValueAtTime(0.0001, now + 3);

      el = new Audio();
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.src = src;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, now);
      out.gain.linearRampToValueAtTime(fullGain, now + 3);
      out.connect(analyser);
      ctx.createMediaElementSource(el).connect(out);

      const begin = () => {
        if (cancelled || !el) return;
        try {
          el.currentTime = from;
        } catch {
          /* aun no es seekable */
        }
        stopRetry = playWhenAllowed(el);
      };
      if (el.readyState >= 1) begin();
      else el.addEventListener("loadedmetadata", begin, { once: true });
      el.addEventListener("ended", () => ended.current?.(), { once: true });
    };

    const tick = () => {
      analyser.getByteFrequencyData(spectrum);
      const avg = (lo: number, hi: number) => {
        const a = Math.max(1, Math.round(lo / binHz));
        const b2 = Math.min(spectrum.length - 1, Math.round(hi / binHz));
        let s = 0;
        for (let k = a; k <= b2; k++) s += spectrum[k];
        return s / ((b2 - a + 1) * 255);
      };
      const raw = { bass: avg(25, 160), mid: avg(160, 2000), high: avg(2000, 9000) };
      (["bass", "mid", "high"] as const).forEach((k) => {
        peak[k] = Math.max(raw[k], peak[k] * 0.999 + 0.00004);
        bands.current[k] = Math.min(1, raw[k] / peak[k]);
      });
      if (el && !el.paused) time.current = el.currentTime;

      if (!full && started) {
        const v = Math.max(0, Math.min(1, level.current));
        const entry = Math.min(1, (ctx.currentTime - started) / fadeIn);
        loopOut.gain.setTargetAtTime(
          loopGain * (floor + (1 - floor) * v) * entry,
          ctx.currentTime,
          0.5
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const resume = () => void ctx.resume().catch(() => {});
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resume));
    resume();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      events.forEach((e) => window.removeEventListener(e, resume));
      try {
        loopSrc?.stop();
      } catch {
        /* aun no habia arrancado */
      }
      stopRetry();
      if (el) {
        el.pause();
        el.src = "";
      }
      ctx.close().catch(() => {});
    };
  }, [active, src, from, to, loopGain, fullGain, floor, fadeIn]);

  return { level, playFull, bands, time };
}
