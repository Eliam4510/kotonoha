// Ayuda común de las pruebas: arranca con el service worker recién compilado.

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mientras se recarga, las API de Chrome fallan con «No SW» o no responden. */
const responde = (w) =>
  Promise.race([
    w.evaluate(() => chrome.storage.local.get('__prueba').then(() => true)).catch(() => false),
    dormir(2000).then(() => false),
  ]);

/**
 * El perfil conserva el service worker de la sesión anterior aunque el archivo en disco haya cambiado.
 * Recargar la extensión obliga a registrar el recién compilado. Devuelve el trabajador ya listo.
 *
 * La orden se da desde una página de la extensión: al arrancar, el trabajador que conoce Playwright
 * puede estar ya muerto y no atenderla, y entonces nunca se notifica uno nuevo.
 */
export async function recargarExtension(contexto) {
  const inicial = contexto.serviceWorkers().at(-1) ?? (await contexto.waitForEvent('serviceworker'));
  const id = new URL(inicial.url()).host;
  for (let intento = 0; intento < 4; intento++) {
    const nuevo = contexto.waitForEvent('serviceworker', { timeout: 8000 }).catch(() => null);
    const p = await contexto.newPage();
    await p.goto(`chrome-extension://${id}/popup.html`).catch(() => {});
    await p.evaluate(() => chrome.runtime.reload()).catch(() => {});
    await p.close().catch(() => {});
    if (await nuevo) {
      for (let i = 0; i < 40; i++) {
        const actual = contexto.serviceWorkers().at(-1);
        if (actual && (await responde(actual))) return actual;
        await dormir(250);
      }
    }
  }
  throw new Error('El service worker no arrancó tras recargar la extensión');
}

/**
 * Confirma un borrado. Lo que se borra y no vuelve pide una segunda pulsación, en el mismo botón o en un diálogo, y el
 * botón no atiende a un doble clic: entre una y otra hay que esperar un poco.
 */
export async function confirmarBorrado(pagina) {
  const boton = pagina.locator('.confirmar-borrado').first();
  await boton.waitFor({ timeout: 5000 });
  await pagina.waitForTimeout(450);
  await boton.click();
}
