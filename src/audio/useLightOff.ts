import { useCallback, useEffect, useRef } from "react";

/**
 * El golpe de una luz industrial al apagarse, sintetizado.
 *
 * No es un solo sonido sino cuatro capas simultaneas, que es de lo que se
 * compone el de verdad:
 *
 *  1. CLIC del interruptor: rafaga de ruido cortisima por un pasa-banda agudo.
 *  2. GOLPE grave: barrido de 160 a 40 Hz en 200 ms. Es el que da el peso;
 *     sin el suena a chasquido de juguete.
 *  3. ZUMBIDO de red muriendo: dos tonos en 100 y 120 Hz que se apagan. La
 *     leve desafinacion entre ambos produce el batido caracteristico.
 *  4. LLORIQUEO descendente: sierra filtrada que cae de 1200 a 70 Hz, el
 *     sonido de la electronica quedandose sin corriente.
 */
export function useLightOff({ gain = 0.55 }: { gain?: number } = {}) {
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    ctx.current = new AudioContext();
    const resume = () => void ctx.current?.resume().catch(() => {});
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, resume));
    resume();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resume));
      ctx.current?.close().catch(() => {});
      ctx.current = null;
    };
  }, []);

  /** Chasquido de arranque, para cada parpadeo del tubo al reencenderse. */
  const strike = useCallback(
    (at = 0, level = 1) => {
      const c = ctx.current;
      if (!c) return;
      const t = c.currentTime + 0.02 + at;

      const out = c.createGain();
      out.gain.value = gain * level;
      out.connect(c.destination);

      // chispazo: ruido corto y agudo, el cebador del tubo
      const len = Math.floor(c.sampleRate * 0.09);
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = c.createBufferSource();
      n.buffer = b;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const env = c.createGain();
      env.gain.setValueAtTime(0.75, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      n.connect(hp).connect(env).connect(out);
      n.start(t);
      n.stop(t + 0.1);

      // y el zumbido que se engancha detras
      const h = c.createOscillator();
      h.type = "sawtooth";
      h.frequency.value = 118;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 380;
      const he = c.createGain();
      he.gain.setValueAtTime(0.0001, t);
      he.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      he.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      h.connect(lp).connect(he).connect(out);
      h.start(t);
      h.stop(t + 0.26);
    },
    [gain]
  );

  const off = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    const t = c.currentTime + 0.02;

    const out = c.createGain();
    out.gain.value = gain;
    out.connect(c.destination);

    // 1. clic del interruptor
    const noiseLen = Math.floor(c.sampleRate * 0.05);
    const nb = c.createBuffer(1, noiseLen, c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = nb;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2600;
    bp.Q.value = 1.4;
    const clickEnv = c.createGain();
    clickEnv.gain.setValueAtTime(0.9, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    noise.connect(bp).connect(clickEnv).connect(out);
    noise.start(t);
    noise.stop(t + 0.06);

    // 2. golpe grave
    const thunk = c.createOscillator();
    thunk.type = "sine";
    thunk.frequency.setValueAtTime(160, t);
    thunk.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const thunkEnv = c.createGain();
    thunkEnv.gain.setValueAtTime(0.0001, t);
    thunkEnv.gain.exponentialRampToValueAtTime(0.85, t + 0.012);
    thunkEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    thunk.connect(thunkEnv).connect(out);
    thunk.start(t);
    thunk.stop(t + 0.4);

    // 3. zumbido de red muriendo
    const humEnv = c.createGain();
    humEnv.gain.setValueAtTime(0.32, t);
    humEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    humEnv.connect(out);
    for (const f of [100, 120.5]) {
      const h = c.createOscillator();
      h.type = "sawtooth";
      h.frequency.setValueAtTime(f, t);
      h.frequency.linearRampToValueAtTime(f * 0.82, t + 0.5);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      h.connect(lp).connect(humEnv);
      h.start(t);
      h.stop(t + 0.6);
    }

    // 4. lloriqueo descendente
    const whine = c.createOscillator();
    whine.type = "sawtooth";
    whine.frequency.setValueAtTime(1200, t + 0.01);
    whine.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    const wlp = c.createBiquadFilter();
    wlp.type = "lowpass";
    wlp.frequency.setValueAtTime(2600, t);
    wlp.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    const wEnv = c.createGain();
    wEnv.gain.setValueAtTime(0.0001, t);
    wEnv.gain.exponentialRampToValueAtTime(0.24, t + 0.03);
    wEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    whine.connect(wlp).connect(wEnv).connect(out);
    whine.start(t);
    whine.stop(t + 0.6);
  }, [gain]);

  return { off, strike };
}
