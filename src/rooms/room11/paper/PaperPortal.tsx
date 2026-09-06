import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { archShape } from "../Portals";
import { COLLAPSE_AT } from "./choreography";

/**
 * El portal que aparece cuando todo se derrumba.
 *
 * Se coloca en la direccion a la que el jugador estuviera mirando en ESE
 * instante, y se captura una sola vez. Si siguiera la mirada seria inalcanzable
 * por definicion: caminarias eternamente hacia algo que se aparta contigo.
 *
 * Y se pone MAS ALLA del campo de hojas, no dentro: la idea es cruzarlas todas
 * para llegar. Por eso la distancia se mide contra el radio sembrado, no como
 * un numero suelto.
 *
 * Al acercarse, el blanco lo conduce la DISTANCIA, igual que en el portal del
 * agua: el paso depende de como camines, no de un reloj.
 */
const WIDTH = 9;
const HEIGHT = 15;

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
  halo *= 0.7 + 0.3 * sin(uTime * 0.7);
  gl_FragColor = vec4(vec3(1.0), halo);
}
`;

export default function PaperPortal({
  songTime,
  whiteEl,
  onArrive,
  /** radio del campo de hojas: el portal cae fuera de el */
  fieldRadius = 34,
  margin = 18,
  floorY = 0,
}: {
  songTime: React.MutableRefObject<number>;
  whiteEl?: React.RefObject<HTMLDivElement | null>;
  onArrive?: () => void;
  fieldRadius?: number;
  margin?: number;
  floorY?: number;
}) {
  const [spot, setSpot] = useState<{ x: number; z: number; rotY: number } | null>(null);
  const fired = useRef(false);

  const geometry = useMemo(() => new THREE.ShapeGeometry(archShape(WIDTH, HEIGHT)), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const arrived = useRef(false);

  useFrame(({ camera, clock }) => {
    uniforms.uTime.value = clock.elapsedTime;

    // ya colocado: solo queda vigilar la llegada
    if (fired.current) {
      if (!spot || arrived.current) return;
      camera.getWorldPosition(pos);
      const d = Math.hypot(pos.x - spot.x, pos.z - spot.z);
      const white = THREE.MathUtils.smoothstep(d, 2.5, 16);
      if (whiteEl?.current) whiteEl.current.style.opacity = String(1 - white);
      if (d <= 2.5) {
        arrived.current = true;
        onArrive?.();
      }
      return;
    }

    if (songTime.current < COLLAPSE_AT) return;
    fired.current = true;

    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();

    // desde donde estas, en la direccion que miras, pasado el campo de hojas
    const reach = Math.max(fieldRadius + margin, pos.length() + margin);
    setSpot({
      x: pos.x + dir.x * reach,
      z: pos.z + dir.z * reach,
      // el arco mira a +Z; se gira para que de la cara al jugador
      rotY: Math.atan2(-dir.x, -dir.z),
    });
  });

  if (!spot) return null;

  return (
    <group position={[spot.x, floorY, spot.z]} rotation={[0, spot.rotY, 0]}>
      <mesh position={[0, HEIGHT * 0.45, -1]}>
        <planeGeometry args={[WIDTH * 6, HEIGHT * 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={haloVert}
          fragmentShader={haloFrag}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh geometry={geometry}>
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
