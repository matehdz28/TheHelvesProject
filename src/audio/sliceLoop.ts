/**
 * Recorta una ventana de un AudioBuffer y le aplica un crossfade en la
 * costura del bucle, mezclando el material que venia justo despues del final
 * sobre el arranque.
 *
 * Sin esto, cortar en un punto arbitrario chasquea: en las pistas de este
 * proyecto la costura cruda llega a saltar 377 veces la pendiente normal de
 * la senal, o sea un golpe muy audible en cada vuelta.
 */
export function sliceLoop(
  ctx: BaseAudioContext,
  src: AudioBuffer,
  start: number,
  end: number,
  crossfade: number
): AudioBuffer {
  const sr = src.sampleRate;
  const s0 = Math.max(0, Math.floor(start * sr));
  const s1 = Math.min(src.length, Math.floor(end * sr));
  const len = Math.max(1, s1 - s0);

  // solo podemos cruzar con lo que exista despues del final
  const x = Math.max(
    0,
    Math.min(Math.floor(crossfade * sr), src.length - s1, Math.floor(len / 2))
  );

  const out = ctx.createBuffer(src.numberOfChannels, len, sr);

  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const inD = src.getChannelData(ch);
    const outD = out.getChannelData(ch);
    outD.set(inD.subarray(s0, s1));

    for (let i = 0; i < x; i++) {
      const t = i / x;
      outD[i] = outD[i] * Math.sqrt(t) + inD[s1 + i] * Math.sqrt(1 - t);
    }
  }

  return out;
}
