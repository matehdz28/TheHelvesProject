/**
 * Ondas del desenlace: un aro blanco tenue que nace pequeno, crece hasta
 * salirse de la pantalla y se apaga. Va en DOM, no en la escena 3D, porque
 * para cuando aparece la pantalla ya esta cubierta por el negro.
 *
 * El periodo no es arbitrario: la autocorrelacion de la envolvente de la
 * pista del desenlace pica justo en 17 s, o sea que es SU periodo. La
 * animacion arranca a la vez que la pista, asi que los aros caen sobre los
 * hinchamientos de la musica.
 */
export default function Ripples({
  active,
  period = 17,
  /** opacidad de pico: "blanco no muy luminoso" */
  peak = 0.26,
}: {
  active: boolean;
  period?: number;
  peak?: number;
}) {
  if (!active) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 25,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes onda-expandir {
          0%   { width: 2vmax;   height: 2vmax;   opacity: 0; }
          7%   { opacity: ${peak}; }
          38%  { width: 130vmax; height: 130vmax; opacity: 0; }
          100% { width: 130vmax; height: 130vmax; opacity: 0; }
        }
      `}</style>
      <div
        style={{
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.75)",
          filter: "blur(0.6px)",
          animation: `onda-expandir ${period}s linear infinite`,
          flex: "0 0 auto",
        }}
      />
    </div>
  );
}
