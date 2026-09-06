import { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { WATER_Y, SHORE_Z } from "./layers";

/**
 * El portal. Es UNO SOLO, sobre el agua, y cambia de color.
 *
 * Mientras hay paisaje es negro puro y sin iluminar: no se lee como un objeto
 * sino como un agujero recortado en el mundo. Al pisar el agua todo se apaga
 * y ese mismo agujero se vuelve blanco: pasa de ser lo unico oscuro del cuadro
 * a lo unico luminoso, sin moverse de sitio.
 *
 * El halo aditivo solo aparece en blanco. Sin el seria un rectangulo plano; con
 * el se lee como una luz al fondo de la nada.
 */

export const PORTAL = {
  position: new THREE.Vector3(0, WATER_Y, -210),
  width: 11,
  height: 17,
};

/**
 * Silueta de arco: lados rectos y remate semicircular. Construida a mano
 * punto a punto en vez de con absarc, para poder comprobar la geometria.
 */
export function archShape(w: number, h: number, segments = 48) {
  const hw = w / 2;
  const straight = Math.max(0, h - hw);
  const s = new THREE.Shape();

  s.moveTo(-hw, 0);
  s.lineTo(-hw, straight);
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI - (i / segments) * Math.PI;
    s.lineTo(Math.cos(a) * hw, straight + Math.sin(a) * hw);
  }
  s.lineTo(hw, 0);
  s.closePath();
  return s;
}

const haloVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const haloFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float halo = pow(max(0.0, 1.0 - r), 2.6);
  // latido muy lento, para que no parezca una calcomania
  halo *= 0.72 + 0.28 * sin(uTime * 0.7);
  gl_FragColor = vec4(vec3(1.0), halo);
}
`;

export function Portal({ white }: { white: boolean }) {
  const geo = useMemo(
    () => new THREE.ShapeGeometry(archShape(PORTAL.width, PORTAL.height)),
    []
  );
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  const p = PORTAL.position;

  return (
    <group>
      {white && (
        <mesh position={[p.x, p.y + PORTAL.height * 0.45, p.z - 1]}>
          <planeGeometry args={[PORTAL.width * 6, PORTAL.height * 4]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader={haloVert}
            fragmentShader={haloFrag}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh geometry={geo} position={p}>
        <meshBasicMaterial color={white ? "#ffffff" : "#000000"} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Avisa la primera vez que el jugador pisa el agua.
 *
 * El umbral es la orilla, o sea el mismo punto donde la funcion de suelo pasa
 * del prado al nivel del agua: se dispara justo al entrar en lo azul.
 */
export function WaterTrigger({ onEnter }: { onEnter: () => void }) {
  const fired = useMemo(() => ({ done: false }), []);
  const pos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    if (fired.done) return;
    camera.getWorldPosition(pos);
    if (pos.z <= SHORE_Z) {
      fired.done = true;
      onEnter();
    }
  });

  return null;
}

/**
 * Publica la cercania al portal y conduce la entrada.
 *
 * El blanqueo NO va por temporizador: lo manda la DISTANCIA. Al acercarte, la
 * luz del portal va comiendo la pantalla de forma continua, asi que el paso
 * es fluido y depende de como camines, no de un reloj. Al llegar al fondo del
 * blanco se avisa una sola vez.
 *
 * La opacidad se escribe directa en el nodo del DOM: hacerlo por estado seria
 * re-renderizar la sala entera sesenta veces por segundo.
 */
export function PortalApproach({
  proximity,
  whiteEl,
  onArrive,
  near = 8,
  whiteFrom = 16,
  whiteTo = 2.5,
}: {
  proximity: React.MutableRefObject<number>;
  whiteEl: React.RefObject<HTMLDivElement | null>;
  onArrive: () => void;
  near?: number;
  whiteFrom?: number;
  whiteTo?: number;
}) {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const state = useMemo(() => ({ far: 0, arrived: false }), []);

  useFrame(({ camera }) => {
    camera.getWorldPosition(pos);
    const d = Math.hypot(pos.x - PORTAL.position.x, pos.z - PORTAL.position.z);

    if (state.far === 0) state.far = Math.max(near + 20, d);
    proximity.current = THREE.MathUtils.clamp(
      1 - (d - near) / (state.far - near),
      0,
      1
    );

    const white = THREE.MathUtils.smoothstep(d, whiteTo, whiteFrom);
    const el = whiteEl.current;
    if (el) el.style.opacity = String(1 - white);

    if (!state.arrived && d <= whiteTo) {
      state.arrived = true;
      onArrive();
    }
  });

  return null;
}
