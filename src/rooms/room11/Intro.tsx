import { useEffect, useState } from "react";

/**
 * Rotulo de entrada: aparece entero, se queda unos segundos y se va.
 *
 * La fuente va con Georgia primero y Gelasio detras. Georgia es propietaria y
 * no se puede importar, asi que quien la tenga instalada (Windows, macOS, iOS)
 * usa la de verdad, y en Android o Linux entra Gelasio, que esta hecha como
 * sustituta metricamente compatible. El peso es 700 porque ese ES el corte
 * bold de Georgia: pedir 900 no da una version mas gorda, obliga al navegador
 * a engordar la negrita por software y el trazo sale sucio.
 *
 * Va en DOM y no como plano en la escena porque es texto de titulo: asi sale
 * nitido a cualquier resolucion, sin depender del filtrado de una textura.
 * Anclado arriba a la derecha, o sea en la esquina opuesta a la lectura de
 * coordenadas, para que no se estorben.
 */
export default function Intro({
  text,
  /** segundos antes de aparecer */
  delay = 1.0,
  /** segundos que tarda en entrar */
  fadeIn = 0.9,
  /** segundos que se queda entero */
  hold = 3.4,
  /** segundos que tarda en irse */
  fadeOut = 1.2,
  /**
   * Tamano de letra, en vw. Los topes minimo y maximo se derivan de el, asi
   * que un solo numero escala el rotulo entero sin romper el comportamiento
   * responsive: en pantallas pequenas no se queda ilegible y en grandes no se
   * dispara.
   */
  size = 4.2,
}: {
  text: string;
  delay?: number;
  fadeIn?: number;
  hold?: number;
  fadeOut?: number;
  size?: number;
}) {
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShown(true), delay * 1000),
      setTimeout(() => setShown(false), (delay + fadeIn + hold) * 1000),
      setTimeout(() => setGone(true), (delay + fadeIn + hold + fadeOut) * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [delay, fadeIn, hold, fadeOut]);

  if (gone) return null;

  const min = (size * 8.6).toFixed(1);
  const max = (size * 16.4).toFixed(1);

  return (
    <div
      style={{
        position: "absolute",
        top: "7%",
        left: "5%",
        margin: 0,
        font: `700 clamp(${min}px, ${size}vw, ${max}px)/1.4 Georgia, Gelasio, "Times New Roman", serif`,
        color: "#ffffff",
        textAlign: "left",
        // puede caer sobre cielo claro: la sombra lo despega del fondo
        textShadow: "0 1px 16px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.35)",
        whiteSpace: "pre-line",
        opacity: shown ? 1 : 0,
        transition: `opacity ${shown ? fadeIn : fadeOut}s ease-out`,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 28,
        
      }}
    >
      {text}
    </div>
  );
}
