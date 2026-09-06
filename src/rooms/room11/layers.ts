import * as THREE from "three";

/**
 * Diorama de "la casa junto al fiordo".
 *
 * Es un decorado de teatro: bastidores planos a distintas profundidades que,
 * vistos desde el punto de entrada, se recomponen en la foto. Al caminar el
 * paralaje los separa y se atraviesan uno a uno.
 *
 * Las distancias y alturas NO son a ojo. Para que una banda caiga en la
 * fraccion de pantalla `f` (0 arriba, 1 abajo) con la camara a nivel:
 *
 *   angulo sobre el horizonte = (0.5 - f) * FOV
 *   altura del bastidor       = ojo + distancia * tan(angulo)
 *
 * Cada capa lleva anotada la fraccion que le toca segun la foto.
 */

export const FOV = 38;
export const EYE = 1.7;

/** el prado baja hasta el agua a esta distancia */
export const SHORE_Z = -81;
/** nivel del agua */
export const WATER_Y = -8;
/** hasta donde llega el agua */
export const WATER_END_Z = -729;

/** altura del suelo pisable en funcion de la profundidad */
export function groundY(z: number) {
  if (z >= 0) return 0;
  if (z <= SHORE_Z) return WATER_Y;
  return (z / SHORE_Z) * WATER_Y; // rampa suave prado → orilla
}

export type Flat = {
  name: string;
  /** profundidad (negativa) */
  z: number;
  /** altura del borde superior */
  top: number;
  /** hasta donde baja */
  bottom: number;
  /** ancho del bastidor */
  width: number;
  /** cuanto ondula el perfil superior */
  relief: number;
  color: string;
  /** fuerza del moteado de laderas, 0 = liso */
  mottle?: number;
  seed: number;
  /** fraccion de pantalla que deberia ocupar su borde superior */
  targetFraction: number;
};

/**
 * De atras hacia delante. Los colores llevan ya la bruma metida: no hay fog
 * en la escena, para que las capas se lean como laminas planas y el color sea
 * exactamente el elegido.
 */
export const FLATS: Flat[] = [
  {
    name: "cresta lejana",
    mottle: 0.16,
    z: -4200,
    top: 705,
    bottom: -40,
    width: 9000,
    relief: 55,
    color: "#8d8578",
    seed: 3.1,
    targetFraction: 0.25,
  },
  {
    name: "meseta",
    mottle: 0.24,
    z: -2600,
    top: 401,
    bottom: -40,
    width: 6000,
    relief: 40,
    color: "#7d7159",
    seed: 1.4,
    targetFraction: 0.27,
  },
  {
    name: "loma olivo",
    mottle: 0.3,
    z: -1400,
    top: 76,
    bottom: -30,
    width: 4000,
    relief: 12,
    color: "#8f9269",
    seed: 5.7,
    targetFraction: 0.42,
  },
  {
    name: "ribera verde",
    mottle: 0.34,
    z: -729,
    top: 21,
    bottom: WATER_Y,
    width: 2600,
    relief: 4.5,
    color: "#5f8534",
    seed: 2.2,
    targetFraction: 0.46,
  },
];

/** cielo azul, en la linea del ejemplo volumetrico */
export const SKY_TOP = "#22496f";
export const SKY_MID = "#3d6690";
export const SKY_HORIZON = "#8aa5be";
export const WATER_COLOR = "#1c3a66";
/** tonos del prado: de la sombra al agostado, como en la referencia */
export const GRASS_COLOR = "#5d7a2c";
export const GRASS_DARK = "#3c5320";
export const GRASS_YELLOW = "#8d9445";
/** bruma con la que se funden el fondo y el horizonte */
export const HAZE = "#93a8ba";

/** hasta donde llega el prado por detras de la camara */
export const GRASS_BEHIND = 420;

/**
 * Bastidores a la ESPALDA. Sin estos, al darse la vuelta no habia nada que
 * mirar. Se dibujan girados 180 grados para que den la cara.
 */
export const BACK_FLATS: Flat[] = [
  {
    name: "loma trasera",
    z: 1250,
    top: 58,
    bottom: -30,
    width: 4000,
    relief: 14,
    color: "#6d7f4a",
    seed: 8.3,
    targetFraction: 0,
  },
  {
    name: "sierra trasera",
    z: 3000,
    top: 245,
    bottom: -40,
    width: 7000,
    relief: 45,
    color: "#8a8377",
    seed: 4.9,
    targetFraction: 0,
  },
];

/**
 * Bastidor con el borde superior ondulado, en el plano XY.
 *
 * Cinco octavas en vez de tres: las ondas largas dan la forma de la sierra y
 * las cortas el detalle de cumbres. Con 360 segmentos la mas rapida (58
 * ciclos) sale a mas de 6 muestras por ciclo, o sea se resuelve sin aliasing.
 */
export function ridgeShape(f: Flat, segments = 360) {
  const half = f.width / 2;
  const s = new THREE.Shape();
  s.moveTo(-half, f.bottom);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const n =
      Math.sin(t * 7.1 + f.seed) * 0.46 +
      Math.sin(t * 13.7 + f.seed * 1.7) * 0.27 +
      Math.sin(t * 23.3 + f.seed * 2.3) * 0.16 +
      Math.sin(t * 37.1 + f.seed * 3.1) * 0.08 +
      Math.sin(t * 58.3 + f.seed * 1.3) * 0.045;
    s.lineTo(-half + t * f.width, f.top + n * f.relief);
  }

  s.lineTo(half, f.bottom);
  s.closePath();
  return s;
}

/** Donde cae en pantalla el borde superior de un bastidor. 0 arriba, 1 abajo. */
export function screenFraction(top: number, z: number) {
  const deg = (Math.atan2(top - EYE, Math.abs(z)) * 180) / Math.PI;
  return 0.5 - deg / FOV;
}
