/**
 * La luz del fondo del tunel: un punto que crece como si te acercaras, hasta
 * dejar la pantalla en blanco.
 *
 * Van dos capas, y hace falta que sean dos. El resplandor solo da la sensacion
 * de acercamiento: como es un degradado radial, su nucleo blanco desborda la
 * pantalla mucho antes del final, asi que por si solo no sirve para cronometrar
 * el blanco. El velo se encarga de eso, entrando en el ultimo 45% del tramo,
 * y garantiza que en el instante del salto la pantalla este completamente
 * blanca.
 *
 * Va en DOM y por encima del negro y de las ondas: para entonces la escena 3D
 * esta tapada.
 */
export default function TunnelLight({
  mounted,
  growing,
  seconds,
}: {
  /** montado (invisible) desde que empieza el negro, para que la transicion
   *  tenga un estado inicial del que partir */
  mounted: boolean;
  growing: boolean;
  seconds: number;
}) {
  if (!mounted) return null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 30,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            width: growing ? "95vmax" : "0.7vmax",
            height: growing ? "95vmax" : "0.7vmax",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, #ffffff 0%, #ffffff 30%, rgba(255,255,255,0.45) 54%, rgba(255,255,255,0) 76%)",
            opacity: growing ? 1 : 0,
            // ease-in fuerte: acercarse a velocidad constante hace que el
            // tamano aparente se dispare al final, no que crezca parejo
            transition: `width ${seconds}s cubic-bezier(0.66,0,0.92,0.36),
                         height ${seconds}s cubic-bezier(0.66,0,0.92,0.36),
                         opacity ${Math.min(4, seconds * 0.16)}s linear`,
            willChange: "width, height, opacity",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          opacity: growing ? 1 : 0,
          transition: `opacity ${seconds * 0.45}s ease-in ${seconds * 0.55}s`,
          pointerEvents: "none",
          zIndex: 31,
        }}
      />
    </>
  );
}
