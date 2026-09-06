/**
 * Linea de tiempo del mundo B, en segundos desde que se cruza el portal.
 *
 *   0 → 60   "ice"   montanas de hielo, infinitas
 *   60       la pista salta al 2:05; las montanas siguen igual
 *   79 → ..  "blue"  las mismas montanas en azul, con cimas blancas
 *  150       en 3:35 arranca el fundido: 20 s hasta negro total, y entra la
 *            segunda pista con sus ondas cada 17 s
 *  190       20 s despues del negro asoma la luz del fondo (0:40 de la 2a)
 *  215       la luz ha llenado la pantalla (1:05 de la 2a) → salto de sala
 *
 * El instante del azul NO esta escrito a mano: sale de los tiempos de audio.
 * Saltando al 2:05 en el segundo 60, la pista llega al 2:24 diecinueve
 * segundos despues, o sea en el 79. Si se mueve cualquiera de los tiempos de
 * la pista, el corte visual se recoloca solo.
 */

/** segundos desde el cruce en que la pista da el salto */
export const AUDIO_SEEK_AT = 60;
/** 2:05, adonde salta */
export const AUDIO_SEEK_TO = 125;
/** 2:24, cuando el terreno se vuelve azul */
export const BLUE_AUDIO_TIME = 144;

/** 2:25, cuando aparece la gota: un segundo despues del corte azul */
export const BEACON_AUDIO_TIME = 145;
/** 3:35, cuando empieza el fundido a negro: 1:10 exacto despues de que
 *  aparece la gota en 2:25 */
export const FADE_AUDIO_TIME = 215;

/**
 * Duracion del fundido. La pista no baja sola: desde el 3:30 y hasta el final
 * (6:56) se mantiene plana en -17 dB, asi que no hay ningun punto musical al
 * que aterrizar y el fundido ES el final.
 */
export const FADE_SECONDS = 20;

const sinceSeek = (audioTime: number) =>
  AUDIO_SEEK_AT + (audioTime - AUDIO_SEEK_TO);

/** derivado: segundos desde el cruce en que aparece el azul */
export const BLUE_AT = sinceSeek(BLUE_AUDIO_TIME);
/** derivado: segundos desde el cruce en que aparece la gota */
export const BEACON_AT = sinceSeek(BEACON_AUDIO_TIME);
/** derivado: segundos desde el cruce en que arranca el fundido */
export const FADE_AT = sinceSeek(FADE_AUDIO_TIME);

/** la segunda pista arranca a la vez que el fundido */
export const FINALE_STARTS_AT = FADE_AT;
/** cuando la pantalla queda completamente negra */
export const BLACK_AT = FADE_AT + FADE_SECONDS;
/** la luz asoma 20 s despues de que todo quede negro */
export const LIGHT_AT = BLACK_AT + 20;
/** 1:05 de la segunda pista: el salto a la otra sala */
export const FINALE_REDIRECT_TIME = 65;
export const REDIRECT_AT = FINALE_STARTS_AT + FINALE_REDIRECT_TIME;
/** la luz crece hasta llenar la pantalla justo cuando toca saltar */
export const LIGHT_SECONDS = REDIRECT_AT - LIGHT_AT;

/** Adonde manda al terminar: el diorama del fiordo. */
export const NEXT_ROOM = "/room11";

export type Phase = "ice" | "blue";

export const phaseAt = (t: number): Phase => (t < BLUE_AT ? "ice" : "blue");

/** azul profundo de la segunda fase; el hielo usa FOG_COLOR */
export const BLUE_FOG = 0x1b2a8a;
