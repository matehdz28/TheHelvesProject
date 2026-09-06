import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import Sky from "./Sky";
import Ground from "./Ground";
import Trees from "./Trees";
import { makeRevealUniforms } from "./reveal";

/**
 * Paisaje del mundo B y el frente de onda que lo pinta.
 *
 * El origen del frente NO esta hardcodeado: se captura la posicion de la
 * camara en el instante del cruce. Asi queda anclado exactamente donde
 * apareces, sin depender de la aritmetica de pivotes entre los dos mundos
 * (pivotB vive desplazado en z respecto a pivotA).
 */
export default function Landscape({
  collidableMeshes,
  crossed,
  /** cuanto tarda en pintarse todo, en segundos */
  duration = 9,
  /** hasta donde llega el frente */
  maxRadius = 700,
  /** >1 = arranca lento cerca tuyo y despues se dispara al horizonte */
  ease = 2.0,
}: {
  collidableMeshes: React.MutableRefObject<THREE.Mesh[]>;
  crossed: boolean;
  duration?: number;
  maxRadius?: number;
  ease?: number;
}) {
  const uniforms = useMemo(() => makeRevealUniforms(), []);
  const startedAt = useRef<number | null>(null);

  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    if (!crossed) {
      startedAt.current = null;
      uniforms.uRevealRadius.value = 0;
      return;
    }

    // primer frame del cruce: aqui es donde aparecimos, el frente nace aqui
    if (startedAt.current === null) {
      startedAt.current = t;
      camera.getWorldPosition(uniforms.uRevealOrigin.value);
    }

    const p = Math.min(1, (t - startedAt.current) / duration);
    const r = maxRadius * Math.pow(p, ease);

    uniforms.uRevealRadius.value = r;
    // el frente se ensancha al alejarse, si no se ve como un hilo
    uniforms.uRevealFeather.value = Math.max(4, r * 0.18);
  });

  return (
    <>
      <Sky uniforms={uniforms} />
      <Ground uniforms={uniforms} collidableMeshes={collidableMeshes} />
      <Trees uniforms={uniforms} />
      <directionalLight position={[40, 60, 20]} intensity={1.1} />
    </>
  );
}
