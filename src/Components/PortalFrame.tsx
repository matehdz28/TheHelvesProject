import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/**
 * Marco del portal del mundo A.
 * - Moldura física (con hueco real) alrededor de la apertura.
 * - Tira de luz interior con shader: respira, barre el perímetro
 *   y se "carga" a medida que el jugador se acerca.
 * - Luz puntual que derrama sobre el piso reflectivo.
 *
 * El hueco interior coincide con `opening`, que DEBE ser el mismo
 * `size` que recibe <PortalBridge/>: ahí es donde se recorta el canvas B.
 */

const ringShape = (ow: number, oh: number, iw: number, ih: number) => {
  const s = new THREE.Shape();
  const OW = ow / 2, OH = oh / 2;
  s.moveTo(-OW, -OH); s.lineTo(OW, -OH); s.lineTo(OW, OH); s.lineTo(-OW, OH); s.closePath();

  const h = new THREE.Path();
  const IW = iw / 2, IH = ih / 2;
  h.moveTo(-IW, -IH); h.lineTo(-IW, IH); h.lineTo(IW, IH); h.lineTo(IW, -IH); h.closePath();

  s.holes.push(h);
  return s;
};

const rimVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rimFragment = /* glsl */ `
  uniform float uTime;
  uniform float uCharge;   // 0 = dormido, 1 = jugador encima
  uniform vec3  uCold;
  uniform vec3  uHot;
  uniform vec2  uHalf;
  varying vec2  vPos;

  const float TAU = 6.28318530718;

  void main() {
    // parametro 0..1 recorriendo el perimetro del rectangulo
    float a = atan(vPos.y / uHalf.y, vPos.x / uHalf.x);
    float t = a / TAU + 0.5;

    // respiracion de fondo
    float breathe = 0.5 + 0.5 * sin(uTime * 1.1);
    float base = mix(0.10, 0.50, uCharge) + breathe * mix(0.05, 0.20, uCharge);

    // dos cabezas de luz opuestas girando; mas rapidas y nitidas al cargarse
    float head = fract(uTime * mix(0.10, 0.50, uCharge));
    float d1 = abs(fract(t - head + 0.5) - 0.5);
    float d2 = abs(fract(t - head) - 0.5);
    float w  = mix(0.16, 0.06, uCharge);
    float sweep = smoothstep(w, 0.0, d1) + 0.55 * smoothstep(w, 0.0, d2);

    float intensity = base + sweep * mix(0.7, 2.4, uCharge);
    vec3  col = mix(uCold, uHot, clamp(uCharge * 0.65 + sweep * 0.55, 0.0, 1.0));

    gl_FragColor = vec4(col * intensity, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Props = {
  position?: [number, number, number];
  /** Apertura del portal. Debe coincidir con el `size` de <PortalBridge/>. */
  opening?: [number, number];
  /** Grosor de la tira de luz. */
  rim?: number;
  /** Grosor de la moldura. */
  molding?: number;
  /** Profundidad de la moldura. */
  depth?: number;
  coldColor?: string;
  hotColor?: string;
  /** [distancia a la que ya está a tope, distancia a la que está dormido] */
  range?: [number, number];
  /** ref donde publicar la carga 0..1 cada frame (la consume el audio) */
  chargeRef?: React.MutableRefObject<number>;
};

export default function PortalFrame({
  position = [0, 1.7, -6],
  opening = [2.2, 3.3],
  rim = 0.07,
  molding = 0.16,
  depth = 0.14,
  coldColor = "#5f6f8a",
  hotColor = "#ffd9a8",
  range = [2, 11],
  chargeRef,
}: Props) {
  const group = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const moldMat = useRef<THREE.MeshStandardMaterial>(null!);
  const charge = useRef(0);

  const [ow, oh] = opening;
  const rimW = ow + rim * 2;
  const rimH = oh + rim * 2;
  const outW = rimW + molding * 2;
  const outH = rimH + molding * 2;

  const moldingShape = useMemo(() => ringShape(outW, outH, rimW, rimH), [outW, outH, rimW, rimH]);
  const rimShape = useMemo(() => ringShape(rimW, rimH, ow, oh), [rimW, rimH, ow, oh]);

  const uniforms = useMemo(
    () => ({
      uTime:   { value: 0 },
      uCharge: { value: 0 },
      uCold:   { value: new THREE.Color(coldColor) },
      uHot:    { value: new THREE.Color(hotColor) },
      uHalf:   { value: new THREE.Vector2(ow / 2, oh / 2) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const cold = useMemo(() => new THREE.Color(coldColor), [coldColor]);
  const hot = useMemo(() => new THREE.Color(hotColor), [hotColor]);
  const center = useMemo(() => new THREE.Vector3(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }, dt) => {
    if (!group.current) return;

    group.current.getWorldPosition(center);
    camera.getWorldPosition(camPos);

    const [near, far] = range;
    const d = camPos.distanceTo(center);
    const target = THREE.MathUtils.clamp((far - d) / (far - near), 0, 1);
    charge.current = THREE.MathUtils.damp(charge.current, target, 3.5, dt);

    const c = charge.current;
    if (chargeRef) chargeRef.current = c;

    const t = clock.elapsedTime;
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.1);

    uniforms.uTime.value = t;
    uniforms.uCharge.value = c;

    if (light.current) {
      light.current.intensity = (0.6 + 5.5 * c) * (0.75 + 0.25 * breathe);
      light.current.color.copy(cold).lerp(hot, c);
    }
    if (moldMat.current) {
      moldMat.current.emissiveIntensity = 0.02 + 0.3 * c * (0.7 + 0.3 * breathe);
    }
  });

  return (
    <group ref={group} position={position}>
      {/* moldura con hueco real */}
      <mesh position={[0, 0, -depth / 2]}>
        <extrudeGeometry args={[moldingShape, { depth, bevelEnabled: false }]} />
        <meshStandardMaterial
          ref={moldMat}
          color="#e9e9ec"
          roughness={0.55}
          metalness={0.08}
          emissive={hotColor}
          emissiveIntensity={0.02}
        />
      </mesh>

      {/* tira de luz, apenas por delante del plano del portal */}
      <mesh position={[0, 0, 0.02]}>
        <shapeGeometry args={[rimShape]} />
        <shaderMaterial uniforms={uniforms} vertexShader={rimVertex} fragmentShader={rimFragment} />
      </mesh>

      {/* derrame sobre el piso reflectivo */}
      <pointLight ref={light} position={[0, 0, 0.9]} distance={16} decay={2} intensity={0.6} />
    </group>
  );
}
