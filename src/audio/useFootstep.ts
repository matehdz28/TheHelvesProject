import { useCallback, useEffect, useRef } from "react";

/**
 * El pisoton de algo enorme.
 *
 * Tres capas, y la clave esta en la tercera: el subgrave da el golpe, el ruido
 * da el impacto, pero lo que hace que se lea como ALGO GIGANTE es la cola de
 * retumbo larga. Un golpe corto suena a puerta; el mismo golpe con dos
 * segundos de resonancia suena a masa.
 */
export function useFootstep({ gain = 0.7 }: { gain?: number } = {}) {
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

  /** `distance` 0..1: 0 = encima, 1 = lejos. Atenua y apaga los agudos. */
  return useCallback(
    (distance = 0.5) => {
      const c = ctx.current;
      if (!c) return;
      const t = c.currentTime + 0.02;
      const near = 1 - Math.min(1, Math.max(0, distance));

      const out = c.createGain();
      out.gain.value = gain * (0.25 + near * 0.75);
      out.connect(c.destination);

      // 1. subgrave: el golpe
      const sub = c.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(58, t);
      sub.frequency.exponentialRampToValueAtTime(24, t + 0.45);
      const subEnv = c.createGain();
      subEnv.gain.setValueAtTime(0.0001, t);
      subEnv.gain.exponentialRampToValueAtTime(1, t + 0.02);
      subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      sub.connect(subEnv).connect(out);
      sub.start(t);
      sub.stop(t + 1.2);

      // 2. impacto: ruido corto, mas apagado cuanto mas lejos
      const len = Math.floor(c.sampleRate * 0.4);
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const n = c.createBufferSource();
      n.buffer = b;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240 + near * 900;
      const nEnv = c.createGain();
      nEnv.gain.setValueAtTime(0.5 * (0.3 + near * 0.7), t);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      n.connect(lp).connect(nEnv).connect(out);
      n.start(t);
      n.stop(t + 0.42);

      // 3. cola de retumbo: lo que da la escala
      const rum = c.createBufferSource();
      const rlen = Math.floor(c.sampleRate * 2.4);
      const rb = c.createBuffer(1, rlen, c.sampleRate);
      const rd = rb.getChannelData(0);
      let last = 0;
      for (let i = 0; i < rlen; i++) {
        last = last * 0.995 + (Math.random() * 2 - 1) * 0.06;
        rd[i] = last * Math.pow(1 - i / rlen, 2.2);
      }
      rum.buffer = rb;
      const rlp = c.createBiquadFilter();
      rlp.type = "lowpass";
      rlp.frequency.value = 130;
      const rEnv = c.createGain();
      rEnv.gain.value = 0.9;
      rum.connect(rlp).connect(rEnv).connect(out);
      rum.start(t + 0.01);
      rum.stop(t + 2.5);
    },
    [gain]
  );
}
