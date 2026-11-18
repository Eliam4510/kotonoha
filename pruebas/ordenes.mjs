// Las órdenes del visor desde las pruebas: se ejecutan por la paleta (Ctrl+K), que las lista todas, cada una con su
// nombre en data-orden (src/visor/ordenesVisor.ts). Así las pruebas no dependen del menú en que va cada una.

/** Abre la paleta y espera a que liste las órdenes. */
async function abrirPaleta(v) {
  // La barra de menús sale cuando el libro está abierto: antes, Ctrl+K no tiene órdenes que ofrecer.
  await v.waitForSelector('.vs-menus', { timeout: 30000 });
  if (!(await v.$('.vs-paleta'))) await v.keyboard.press('Control+k');
  await v.waitForSelector('.vs-paleta [data-orden]', { timeout: 5000 });
}

/** Ejecuta una orden del visor por su nombre, como si se eligiera en la paleta. */
export async function orden(v, id) {
  await abrirPaleta(v);
  const item = v.locator(`.vs-paleta [data-orden="${id}"]`);
  if (!(await item.count())) throw new Error(`La paleta no tiene la orden «${id}»`);
  await item.click();
  await v.waitForSelector('.vs-paleta', { state: 'detached', timeout: 5000 }).catch(() => {});
}

/** Espera a que una orden exista (algunas solo aparecen cuando hacen falta, como «Texto del PDF») y dice cómo está. */
export async function esperarOrden(v, id, ms = 15000) {
  const limite = Date.now() + ms;
  for (;;) {
    const e = await estadoOrden(v, id);
    if (e.existe || Date.now() > limite) return e;
    await v.waitForTimeout(300);
  }
}

/** Cómo está una orden: si existe, si está marcada (casillas y opciones) y si se puede ejecutar. Cierra la paleta. */
export async function estadoOrden(v, id) {
  await abrirPaleta(v);
  const e = await v.evaluate((id) => {
    const el = document.querySelector(`.vs-paleta [data-orden="${id}"]`);
    return el ? { existe: true, marcada: el.getAttribute('data-marcada') === 'true', deshabilitada: el.getAttribute('aria-disabled') === 'true', etiqueta: el.querySelector('.vs-menu-etiqueta')?.textContent ?? '' } : { existe: false, marcada: false, deshabilitada: false, etiqueta: '' };
  }, id);
  await v.keyboard.press('Escape');
  await v.waitForSelector('.vs-paleta', { state: 'detached', timeout: 5000 }).catch(() => {});
  return e;
}
