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
  await vozMuda(contexto);
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

const conVozMuda = new WeakSet();

/**
 * Las voces del sistema (en Windows, Haruka, Zira…) las reproduce el propio sistema, fuera del navegador: `--mute-audio`
 * no las calla, y de madrugada se oían las pruebas que leen con la voz del navegador (voz-local, producto). En cada página
 * de las pruebas, speechSynthesis habla en silencio: cada frase empieza y acaba como si sonara, con sus eventos, sin
 * llegar al sistema. La lista de voces sigue siendo la de verdad. `window.__frasesMudas` cuenta las que se «dijeron».
 * No llega al mundo aislado de un content script: una prueba que lea en voz alta desde la capa de una página web sí sonaría.
 */
export async function vozMuda(contexto) {
  if (conVozMuda.has(contexto)) return;
  conVozMuda.add(contexto);
  await contexto.addInitScript(() => {
    const s = window.speechSynthesis;
    // Si la prueba ya puso su propia voz falsa (lector-aumentado apunta lo que se dice), esa manda.
    if (!(s instanceof SpeechSynthesis) || window.__frasesMudas !== undefined) return;
    window.__frasesMudas = 0;
    const sonando = new Set();
    const evento = (tipo, u) => {
      try {
        u.dispatchEvent(new SpeechSynthesisEvent(tipo, { utterance: u, charIndex: 0, elapsedTime: 0 }));
      } catch {
        // Un manejador que lanza no debe parar los demás.
      }
    };
    const acabar = (u) => {
      if (sonando.delete(u)) evento('end', u);
    };
    s.speak = (u) => {
      window.__frasesMudas++;
      sonando.add(u);
      setTimeout(() => {
        if (!sonando.has(u)) return;
        evento('start', u);
        // Lo que tardaría en decirse, más o menos, sin hacer esperar a las pruebas.
        setTimeout(() => acabar(u), Math.min(2500, 150 + 30 * (u.text?.length ?? 0)));
      }, 10);
    };
    s.cancel = () => [...sonando].forEach(acabar);
    s.pause = () => {};
    s.resume = () => {};
    Object.defineProperty(s, 'speaking', { configurable: true, get: () => sonando.size > 0 });
    Object.defineProperty(s, 'pending', { configurable: true, get: () => false });
  });
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

/**
 * Olvida lo que recuerda el reproductor de archivos (0.47.0): dónde se dejó cada archivo, la última lista, la velocidad
 * y el volumen. Una prueba que vuelve a abrir un archivo ya visto en su perfil empezaría donde lo dejó otra pasada, quizá
 * pasados ya sus subtítulos. Se llama en la página del reproductor, antes de abrir nada: al final la recarga, porque el
 * reproductor lee la velocidad y el volumen guardados al montarse.
 */
export async function olvidarReproductor(pagina) {
  await pagina.evaluate(async () => {
    const db = await new Promise((ok, mal) => {
      const r = indexedDB.open('kotonoha-reproductor', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('vistos', { keyPath: 'clave' });
        r.result.createObjectStore('listas');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    await new Promise((ok, mal) => {
      const tx = db.transaction(['vistos', 'listas'], 'readwrite');
      tx.objectStore('vistos').clear();
      tx.objectStore('listas').clear();
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
    db.close();
    localStorage.removeItem('kk-reproductor-velocidad');
    localStorage.removeItem('kk-reproductor-volumen');
  });
  await pagina.reload();
  await pagina.waitForTimeout(800);
}
