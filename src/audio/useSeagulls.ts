import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Graznidos de gaviota, sintetizados, con volumen por distancia.
 *
 * El atenuado NO se calcula a mano: lo hace un PannerNode con modelo de
 * distancia inverso. Se le da la posicion de la bandada y la del oyente
 * (la camara) y el navegador resuelve volumen y panorama estereo. Acercarse
 * sube el volumen y alejarse lo baja, con la curva fisica correcta.
 *
 * El graznido es sintetico porque no habia grabacion disponible: una sierra
 * con barrido descendente de tono, filtro de banda estrecha y un vibrato
 * rapido, que es lo que da el timbre chillon de la gaviota. Si aparece un
 * archivo real, se sustituye `scheduleCall` por un AudioBufferSourceNode y
 * todo lo demas sigue igual.
 */
export type SeagullOptions = {
  active: boolean;
  gain?: number;
  /** distancia a la que suena a volumen pleno */
  refDistance?: number;
  maxDistance?: number;
  rolloff?: number;
  /** segundos entre tandas de graznidos */
  minGap?: number;
  maxGap?: number;
};

type Graph = {
  ctx: AudioContext;
  panner: PannerNode;
  out: GainNode;
};

export function useSeagulls({
  active,
  gain = 0.55,
  refDistance = 60,
  maxDistance = 900,
  rolloff = 1.1,
  minGap = 1.4,
  maxGap = 4.2,
}: SeagullOptions) {
  const graph = useRef<Graph | null>(null);
  const [status, setStatus] = useState<"idle" | "playing" | "waiting-gesture">("idle");

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer = 0;
    const ctx = new AudioContext();

    const out = ctx.createGain();
    out.gain.value = gain;

    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = refDistance;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = rolloff;

    out.connect(panner);
    panner.connect(ctx.destination);
    graph.current = { ctx, panner, out };

    /** un graznido: barrido de tono descendente a traves de un pasa-banda */
    const scheduleCall = (when: number, f0: number, dur: number, level: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f0 * 1.18, when);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, when + dur);

      // vibrato rapido: sin el suena a sintetizador, no a bicho
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 26 + Math.random() * 10;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = f0 * 0.07;
      lfo.connect(lfoAmt).connect(osc.frequency);

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(f0 * 2.3, when);
      bp.frequency.exponentialRampToValueAtTime(f0 * 1.4, when + dur);
      bp.Q.value = 3.2;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 500;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(level, when + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);

      osc.connect(bp).connect(hp).connect(env).connect(out);
      osc.start(when);
      osc.stop(when + dur + 0.05);
      lfo.start(when);
      lfo.stop(when + dur + 0.05);
    };

    /** tanda de 1 a 3 graznidos encadenados, como llaman de verdad */
    const burst = () => {
      if (cancelled || ctx.state !== "running") return;
      const t = ctx.currentTime + 0.05;
      const n = 1 + Math.floor(Math.random() * 3);
      const f0 = 720 + Math.random() * 380;
      let at = t;
      for (let i = 0; i < n; i++) {
        const dur = 0.26 + Math.random() * 0.2;
        scheduleCall(at, f0 * (1 - i * 0.04), dur, 0.5 + Math.random() * 0.4);
        at += dur + 0.05 + Math.random() * 0.08;
      }
    };

    const loop = () => {
      burst();
      const gap = minGap + Math.random() * (maxGap - minGap);
      timer = window.setTimeout(loop, gap * 1000);
    };

    const resume = async () => {
      if (cancelled) return;
      try {
        await ctx.resume();
        if (!cancelled && ctx.state === "running") setStatus("playing");
      } catch {
        /* al siguiente gesto */
      }
    };
    const onGesture = () => void resume();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onGesture));
    void resume();
    setStatus(ctx.state === "running" ? "playing" : "waiting-gesture");

    timer = window.setTimeout(loop, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onGesture));
      graph.current = null;
      ctx.close().catch(() => {});
    };
  }, [active, gain, refDistance, maxDistance, rolloff, minGap, maxGap]);

  /** Se llama cada frame con la posicion de la bandada y la pose de la camara. */
  const update = useCallback(
    (
      flock: { x: number; y: number; z: number },
      cam: { x: number; y: number; z: number },
      fwd: { x: number; y: number; z: number },
      up: { x: number; y: number; z: number }
    ) => {
      const g = graph.current;
      if (!g) return;
      const t = g.ctx.currentTime;

      // API moderna con AudioParam; algunos navegadores solo tienen la vieja
      const p = g.panner as PannerNode & { setPosition?: (x: number, y: number, z: number) => void };
      if (p.positionX) {
        p.positionX.setValueAtTime(flock.x, t);
        p.positionY.setValueAtTime(flock.y, t);
        p.positionZ.setValueAtTime(flock.z, t);
      } else p.setPosition?.(flock.x, flock.y, flock.z);

      const l = g.ctx.listener as AudioListener & {
        setPosition?: (x: number, y: number, z: number) => void;
        setOrientation?: (...a: number[]) => void;
      };
      if (l.positionX) {
        l.positionX.setValueAtTime(cam.x, t);
        l.positionY.setValueAtTime(cam.y, t);
        l.positionZ.setValueAtTime(cam.z, t);
        l.forwardX.setValueAtTime(fwd.x, t);
        l.forwardY.setValueAtTime(fwd.y, t);
        l.forwardZ.setValueAtTime(fwd.z, t);
        l.upX.setValueAtTime(up.x, t);
        l.upY.setValueAtTime(up.y, t);
        l.upZ.setValueAtTime(up.z, t);
      } else {
        l.setPosition?.(cam.x, cam.y, cam.z);
        l.setOrientation?.(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
      }
    },
    []
  );

  return { update, status };
}
