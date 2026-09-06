import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  ChromaticAberration,
  Noise,
  Vignette,
  Bloom,
} from "@react-three/postprocessing";
import { TRIP, LEVITATE } from "./Rooftop";

/**
 * El viaje astral: la imagen dejando de comportarse.
 *
 * El compositor se monta SOLO cuando el viaje ya ha empezado, no durante toda
 * la sala. Meter una pasada de postproceso cambia como se resuelve el color de
 * toda la escena, y el acto de dia tiene la iluminacion del hormigon despejada
 * a mano contra valores concretos: pasarla por el compositor la alteraria sin
 * que nadie lo hubiera pedido. Al arrancar aqui, el cambio cae de noche, con
 * la pantalla ya roja y los efectos todavia en cero.
 *
 * Los efectos no se animan por props sino escribiendo en el objeto de cada uno
 * dentro del bucle. Cambiar una prop cada fotograma reconstruye el efecto y
 * con el la cadena entera.
 */
export default function Trip({
  time,
  bands,
  lift,
}: {
  time: React.MutableRefObject<number>;
  bands: React.MutableRefObject<{ bass: number; mid: number; high: number }>;
  /** cuanto se ha despegado del suelo el jugador, en metros */
  lift: React.MutableRefObject<number>;
}) {
  const [on, setOn] = useState(false);
  const ca = useRef<any>(null);
  const noise = useRef<any>(null);
  const vig = useRef<any>(null);
  const bloom = useRef<any>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const baseFov = useRef(camera.fov);

  useEffect(() => {
    baseFov.current = camera.fov;
    return () => {
      camera.fov = baseFov.current;
      camera.rotation.z = 0;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  useFrame(({ clock }) => {
    const song = time.current;
    if (song < 0) return;
    if (!on && song >= TRIP.from) setOn(true);

    const t = clock.elapsedTime;
    const trip = THREE.MathUtils.smoothstep(song, TRIP.from, TRIP.to);
    const { bass, high } = bands.current;

    // levitar entra despues, y no es lineal: se despega despacio y al final
    // sube de golpe, que es cuando la cancion tambien se va
    const lv = THREE.MathUtils.smoothstep(song, LEVITATE.from, LEVITATE.to);
    lift.current = Math.pow(lv, 2.1) * 34 + lv * Math.sin(t * 0.6) * 1.6;

    // la camara pierde el horizonte y respira: es lo que mas se nota de todo
    // esto, porque discute con lo unico que el ojo da por fijo
    camera.rotation.z =
      trip * (Math.sin(t * 0.23) * 0.42 + Math.sin(t * 0.61) * 0.16);
    camera.fov = baseFov.current + trip * (Math.sin(t * 0.37) * 13 + bass * 7);
    camera.updateProjectionMatrix();

    if (ca.current) {
      const v = trip * 0.006 + trip * high * 0.01;
      ca.current.offset.set(v, v * 0.55);
    }
    if (noise.current) noise.current.blendMode.opacity.value = trip * 0.34;
    if (vig.current) vig.current.darkness = 0.25 + trip * 0.55;
    if (bloom.current) bloom.current.intensity = 0.35 + trip * 2.2 + bass * 0.7;
  });

  if (!on) return null;

  return (
    <EffectComposer>
      <Bloom ref={bloom} intensity={0.35} luminanceThreshold={0.28} mipmapBlur />
      <ChromaticAberration ref={ca} offset={new THREE.Vector2(0, 0)} />
      <Noise ref={noise} premultiply />
      <Vignette ref={vig} eskil={false} offset={0.2} darkness={0.25} />
    </EffectComposer>
  );
}
