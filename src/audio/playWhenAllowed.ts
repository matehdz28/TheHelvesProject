/**
 * Arranca un <audio>, y si el navegador lo rechaza, lo vuelve a intentar en
 * cuanto haya un gesto del usuario.
 *
 * Sin esto una pista puede no sonar NUNCA y sin dejar rastro: la politica de
 * reproduccion automatica rechaza el play() con una promesa, y si esa promesa
 * se ignora el fallo no aparece por ningun lado. En un recorrido largo no se
 * nota, porque para cuando entra la musica ya se ha hecho clic mil veces; pero
 * al entrar directo a una escena, el primer play() ocurre antes que cualquier
 * gesto y la sala se queda muda.
 *
 * Devuelve la funcion de limpieza, que hay que llamar al desmontar para no
 * dejar escuchas colgados.
 */
export function playWhenAllowed(el: HTMLMediaElement): () => void {
  let done = false;
  const events = ["pointerdown", "keydown", "touchstart"] as const;

  const off = () => events.forEach((e) => window.removeEventListener(e, retry));

  const attempt = () => {
    if (done) return;
    void el.play().then(
      () => {
        done = true;
        off();
      },
      () => {
        /* aun no se permite: se reintenta con el proximo gesto */
      }
    );
  };

  function retry() {
    attempt();
  }

  events.forEach((e) => window.addEventListener(e, retry));
  attempt();

  return off;
}
