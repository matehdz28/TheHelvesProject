import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makeGrainMap } from "./whiteTextures";
import type { Solid } from "./solids";
import Stairs, { STAIR, STAIR_SOLIDS } from "./Stairs";

/**
 * El monolito, al modo de las maquetas de hormigon de la referencia.
 *
 * Lo que define esas fotografias es que la LUZ hace el trabajo. No hay color:
 * hay una sola luz dura desde arriba y algo por delante, y todo el dibujo sale
 * de que cada cara reciba un angulo distinto. Por eso aqui los materiales SI
 * estan iluminados, al reves que en el acto anterior, que era pintura plana.
 *
 * Valores que persigue el montaje, medidos de la referencia:
 *   caras superiores  ~90%   (casi blancas, son las que rematan los cuerpos)
 *   caras frontales   ~70%
 *   caras laterales   ~50%
 *   caras en sombra   ~35%
 *   huecos             ~8%
 *
 * Los huecos son geometria REAL, hundida en el muro. Pintarlos como rectangulo
 * negro es lo que delata una maqueta falsa: en la referencia se ve el canto del
 * derrame y el dintel proyectando su sombrita.
 *
 * MASSES es la unica lista: de ella salen los cuerpos que se dibujan Y los que
 * colisionan. Los huecos y remates son adorno y no colisionan; lo que para el
 * paso son los volumenes.
 */
export const SKY = "#d3d1cc";
export const GROUND = "#b4b2ad";
export const CONCRETE = "#dedcd7";

export const TOP = 520;
export const RISE_SECONDS = 26;

/** una torre del racimo, con su rejilla de huecos */
type Tower = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  windows: [number, number];
};

const TOWERS: Tower[] = [
  { x: -96, z: -40, w: 54, h: 300, d: 46, windows: [4, 2] },
  { x: -48, z: -96, w: 46, h: 402, d: 44, windows: [6, 2] },
  { x: -8, z: -34, w: 40, h: 214, d: 38, windows: [3, 2] },
  { x: 62, z: -70, w: 58, h: 350, d: 50, windows: [5, 3] },
  { x: 120, z: -26, w: 44, h: 246, d: 40, windows: [3, 2] },
  { x: 150, z: -110, w: 52, h: 430, d: 46, windows: [6, 2] },
  { x: -150, z: -100, w: 60, h: 366, d: 50, windows: [5, 3] },
  { x: 20, z: -160, w: 48, h: 470, d: 44, windows: [7, 2] },
];

/** altura de la azotea a la que sube el ascensor */
export const ROOF_Y = 352;

/**
 * La torre del ascensor va DELANTE del racimo y suelta.
 *
 * Pegada al resto quedaba entre muros, y para llegar a ella habia que caminar
 * ya metido en el conjunto: desde ahi los cuerpos tapan el cuadro entero y se
 * pierde justo lo que se busca, que es verlos desde abajo. Aislada, se
 * reconoce de lejos y hace de meta.
 */
export const SHAFT = { x: 20, z: 100, w: 44, d: 40 };

/**
 * Todos los volumenes, en un solo sitio. `base` va desde el suelo del grupo,
 * asi el mismo dato sirve para dibujar y para colisionar.
 */
const CENTRAL_ROOF = TOP * 0.62;

/**
 * EL RECORRIDO.
 *
 * Sin el, la escena es un descampado con cuerpos sueltos: se puede ir a
 * cualquier parte y por eso no se sabe adonde ir. Estas piezas no cambian la
 * arquitectura, solo la ordenan: una calzada que apunta al ascensor, y arriba
 * un puente con escalinata que baja a la gran terraza.
 *
 * La escalinata es de PELDANOS y no una rampa por un motivo tecnico: la
 * colision resuelve cajas alineadas a los ejes, y el apoyo devuelve la tapa de
 * la caja. Un plano inclinado no tendria tapa que pisar y se atravesaria. Cada
 * peldano es una caja, asi que funciona por construccion, y ademas la
 * escalinata monumental es lo que sale en la propia referencia.
 */
export const ROUTE: Solid[] = (() => {
  const x = SHAFT.x;
  // el puente se centra entre el eje del ascensor y el del rellano, y es
  // ancho para cubrir ambos: si se alineara con uno solo, el otro quedaria
  // fuera del tablero
  const bx = (x + (STAIR.xA - STAIR.landing / 2)) / 2;
  return [
    // calzada del suelo, del pie del ascensor hacia fuera
    { x, z: 212, w: 13, d: 136, base: 0, h: 0.45 },
    { x: x - 7.6, z: 212, w: 2.2, d: 136, base: 0, h: 1 },
    { x: x + 7.6, z: 212, w: 2.2, d: 136, base: 0, h: 1 },

    // Pasarela de la plataforma a la azotea de la torre. La plataforma ya no
    // roza la torre: sube por fuera, separada, y arriba se cruza por aqui.
    // Igual que el otro puente, sus extremos SOLAPAN con lo que unen.
    { x, z: 123.5, w: 8, d: 11, base: ROOF_Y - 1.4, h: 1.4 },
    { x: x - 5.4, z: 123.5, w: 2, d: 11, base: ROOF_Y - 1.4, h: 3 },
    { x: x + 5.4, z: 123.5, w: 2, d: 11, base: ROOF_Y - 1.4, h: 3 },

    // Puente de la azotea al arranque de la escalera.
    //
    // Sus extremos SOLAPAN con lo que conecta, no se quedan a tocar: la
    // azotea llega a z=80 y el rellano empieza en z=69, asi que el tablero va
    // de 68 a 88. Un puente que acaba justo donde empieza el siguiente apoyo
    // deja un hueco por el que se cae, y es un fallo que no se ve leyendo el
    // codigo, solo caminandolo.
    { x: bx, z: 78, w: 16, d: 20, base: STAIR.fromY - 1.4, h: 1.4 },
    { x: bx - 8.6, z: 78, w: 2.2, d: 20, base: STAIR.fromY - 1.4, h: 3 },
    { x: bx + 8.6, z: 78, w: 2.2, d: 20, base: STAIR.fromY - 1.4, h: 3 },
    { x: bx, z: 78, w: 7, d: 7, base: 0, h: STAIR.fromY - 1.4 },

    // Pretiles del remate.
    //
    // El hueco entre el rellano y la azotea NO se puede tapar con una losa: el
    // ultimo tramo de escalera pasa justo por debajo, y cualquier suelo puesto
    // a 520 le cae encima a los peldanos que todavia no han llegado a esa
    // cota. Ese fue el error: una losa de 23x18 a 518.6 dejaba cinco peldanos
    // con menos de un metro de techo, y la escalera quedaba tapiada.
    //
    // Asi que en vez de rellenar el hueco se CIERRA el paso hacia el. Son
    // pretiles, no suelo, y ademas es lo que llevaria un edificio de verdad
    // en el borde de un patio de escaleras.
    //
    // Tienen que pasar de 1.8 m, que es el escalon que se sube sin saltar: por
    // debajo de esa altura la colision los ignora y se cruzan andando.

    // Explanada de llegada, del rellano a la pista.
    //
    // Va toda al SUR de z=58.4, y esa es la clave: la escalera sube por el
    // lado norte (sus carriles empiezan en z=58.5), asi que ahi abajo no hay
    // nada a lo que caerle encima. Puesta al norte, como estaba, su cara
    // inferior quedaba por debajo de los ultimos peldanos y tapiaba la
    // escalera. Misma pieza, mismo tamano, catorce metros mas al sur.
    { x: 69.5, z: 51.2, w: 23, d: 14.4, base: TOP - 1.4, h: 1.4 },

    // canto oeste del ultimo rellano, sobre el vacio del patio de escaleras
    { x: STAIR.xB, z: 69.75, w: 1, d: 8.5, base: TOP, h: 2.6 },
    // canto norte de la pista, que da al mismo patio. Llega solo hasta x=57:
    // mas alla los peldanos ya rozan los 520 y el pretil los taparia
    { x: 36, z: 58, w: 42, d: 1, base: TOP, h: 2.6 },
  ];
})();

/**
 * Superficies donde cabe gente: la azotea de cada torre y las terrazas del
 * cuerpo. Se derivan de la MISMA geometria que se dibuja, asi que si una torre
 * cambia de altura su multitud sube con ella en vez de quedarse flotando.
 */
export const ROOFS = [
  ...TOWERS.map((t) => ({ x: t.x, z: t.z, w: t.w, d: t.d, y: t.h })),
  // remate oeste, gemelo del de la fiesta
  { x: -46, z: 30, w: 62, d: 56, y: TOP },
  // la ranura entre los dos remates: una terraza mas baja
  { x: 0, z: 30, w: 26, d: 56, y: CENTRAL_ROOF },
  { x: -52, z: 74, w: 50, d: 32, y: TOP * 0.32 },
  { x: 68, z: 78, w: 64, d: 40, y: TOP * 0.2 },
];

export const MASSES: Solid[] = [
  ...TOWERS.map((t) => ({ x: t.x, z: t.z, w: t.w, d: t.d, base: 0, h: t.h })),

  // torre del ascensor: su azotea es el destino
  { x: SHAFT.x, z: SHAFT.z, w: SHAFT.w, d: SHAFT.d, base: 0, h: ROOF_Y },

  // cuerpo central y escalones delanteros
  { x: 0, z: 30, w: 154, d: 56, base: 0, h: CENTRAL_ROOF },
  { x: -52, z: 74, w: 50, d: 32, base: 0, h: TOP * 0.32 },
  { x: 68, z: 78, w: 64, d: 40, base: 0, h: TOP * 0.2 },

  // las dos masas del remate, con la ranura entre ellas
  { x: -46, z: 30, w: 62, d: 56, base: CENTRAL_ROOF, h: TOP * 0.38 },
  { x: 46, z: 30, w: 62, d: 56, base: CENTRAL_ROOF, h: TOP * 0.38 },
];

/** todo lo que para el paso: volumenes y recorrido */
export const ALL_SOLIDS: Solid[] = [...MASSES, ...ROUTE, ...STAIR_SOLIDS];

/**
 * Hueco hundido: derrame, fondo oscuro y dintel que sobresale.
 * Se coloca sobre la cara +Z de un cuerpo.
 */
function Opening({
  position,
  w = 7,
  h = 11,
  depth = 3.4,
  mat,
  dark,
}: {
  position: [number, number, number];
  w?: number;
  h?: number;
  depth?: number;
  mat: THREE.Material;
  dark: THREE.Material;
}) {
  return (
    <group position={position}>
      {/* fondo del hueco, retranqueado */}
      <mesh position={[0, 0, -depth]} material={dark}>
        <boxGeometry args={[w, h, 0.6]} />
      </mesh>
      {/* derrames: los cantos que se ven de canto y dan la profundidad */}
      <mesh position={[-w / 2, 0, -depth / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[0.7, h, depth]} />
      </mesh>
      <mesh position={[w / 2, 0, -depth / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[0.7, h, depth]} />
      </mesh>
      <mesh position={[0, -h / 2, -depth / 2]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w, 0.7, depth]} />
      </mesh>
      {/* dintel: sobresale y arroja su sombra sobre el hueco */}
      <mesh position={[0, h / 2 + 0.5, 0.5]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[w + 2.4, 1.6, depth + 1.4]} />
      </mesh>
    </group>
  );
}

export default function Monolith({ rise }: { rise: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!);

  const grain = useMemo(() => makeGrainMap(41), []);

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: CONCRETE,
      roughness: 1,
      metalness: 0,
      map: grain,
    });
    // el grano se repite por metro, no por cara: si no, un cuerpo de 400 m y
    // otro de 20 tendrian granos de tamano distinto y se notaria el truco
    m.map!.repeat.set(6, 6);
    return m;
  }, [grain]);

  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#2a2825", roughness: 1 }),
    []
  );

  useEffect(() => {
    return () => {
      grain.dispose();
      mat.dispose();
      dark.dispose();
    };
  }, [grain, mat, dark]);

  /**
   * La altura NO se cuenta aqui. La escena lleva ese reloj porque tambien
   * alimenta a los colisionadores, y con un contador propio en cada sitio los
   * dos se separan: la escena espera al encendido y esto no, asi que durante el
   * parpadeo se veia subir un edificio por el que todavia no se podia andar.
   * Un solo numero, dos consumidores.
   */
  useFrame(() => {
    if (group.current) group.current.position.y = rise.current;
  });

  return (
    // la altura inicial sale del mismo valor compartido: entrando directo a
    // una etapa el edificio ya esta puesto, sin un fotograma hundido
    <group ref={group} position={[0, rise.current, 0]}>
      {/* racimo del fondo, como la segunda referencia */}
      {TOWERS.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h / 2, 0]} material={mat} castShadow receiveShadow>
            <boxGeometry args={[t.w, t.h, t.d]} />
          </mesh>
          {/* remate: la losa clara que corona cada cuerpo */}
          <mesh position={[0, t.h + 1.2, 0]} material={mat} castShadow receiveShadow>
            <boxGeometry args={[t.w + 2.6, 2.4, t.d + 2.6]} />
          </mesh>

          {Array.from({ length: t.windows[0] }).map((_, r) =>
            Array.from({ length: t.windows[1] }).map((_, c) => (
              <Opening
                key={`${r}-${c}`}
                position={[
                  (c - (t.windows[1] - 1) / 2) * (t.w * 0.42),
                  t.h * (0.22 + (r * 0.62) / Math.max(1, t.windows[0] - 1)),
                  t.d / 2,
                ]}
                w={t.w * 0.13}
                h={t.w * 0.19}
                depth={3}
                mat={mat}
                dark={dark}
              />
            ))
          )}
        </group>
      ))}

      {/*
        El remate: la ranura de la primera y la cuarta referencia. Dos masas
        con una hendidura entre ellas, una repisa al fondo y dos puertecillas.
        Va ARRIBA DEL TODO, que es donde la pediste.
      */}
      <group position={[0, TOP * 0.62, 30]}>
        <mesh position={[-46, TOP * 0.19, 0]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[62, TOP * 0.38, 56]} />
        </mesh>
        <mesh position={[46, TOP * 0.19, 0]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[62, TOP * 0.38, 56]} />
        </mesh>
        {/* fondo de la ranura: la cara clara sobre la que cae la luz */}
        <mesh position={[0, TOP * 0.19, -24]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[32, TOP * 0.38, 8]} />
        </mesh>
        {/* repisa: su canto superior es lo mas claro de la composicion */}
        <mesh position={[0, 6, -4]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[32, 6, 44]} />
        </mesh>

        <Opening position={[-8, 17, -19]} w={7} h={13} depth={3} mat={mat} dark={dark} />
        <Opening position={[9.5, 16, -19]} w={4} h={11} depth={3} mat={mat} dark={dark} />

        {/* la diagonal clara que cruza la primera referencia */}
        <mesh position={[-18, -30, 22]} rotation={[0, 0, -0.62]} material={mat} castShadow>
          <boxGeometry args={[2.4, 96, 5]} />
        </mesh>
      </group>

      {/* El recorrido se dibuja desde ROUTE, la misma lista con la que
          colisiona: asi no puede quedar un peldano que se vea y no se pise. */}
      {ROUTE.map((r, i) => (
        <mesh
          key={`route-${i}`}
          position={[r.x, r.base + r.h / 2, r.z]}
          material={mat}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[r.w, r.h, r.d]} />
        </mesh>
      ))}

      {/* escalera exterior: del final del puente hasta el remate */}
      <Stairs material={mat} />

      {/* torre del ascensor: sube junto a ella y se sale a su azotea */}
      <mesh position={[SHAFT.x, ROOF_Y / 2, SHAFT.z]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[SHAFT.w, ROOF_Y, SHAFT.d]} />
      </mesh>
      <mesh position={[SHAFT.x, ROOF_Y + 1.2, SHAFT.z]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[SHAFT.w + 2.6, 2.4, SHAFT.d + 2.6]} />
      </mesh>

      {/* cuerpo de la torre central, bajo el remate */}
      <mesh position={[0, TOP * 0.31, 30]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[154, TOP * 0.62, 56]} />
      </mesh>
      {/* escalon delantero: el corte horizontal de la primera referencia */}
      <mesh position={[-52, TOP * 0.16, 74]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[50, TOP * 0.32, 32]} />
      </mesh>
      <mesh position={[68, TOP * 0.1, 78]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[64, TOP * 0.2, 40]} />
      </mesh>
    </group>
  );
}
