// Auditoría del acabado de una pantalla: busca, en la página tal como está, lo escrito que queda pegado al borde de su
// caja, lo que una caja corta, las lecturas (furigana) que tocan el borde o pisan otro texto, y lo que se sale de la
// ventana. No mira el diseño: solo lo que se puede medir. Entra también en los shadow roots, donde vive la interfaz
// sobre el video.
//
//   import { auditar } from './auditoria.mjs';
//   const hallazgos = await auditar(pagina, { minimo: 6 });
//
// Cada hallazgo: { tipo, aire, n, que, caja, texto }. `aire` es lo que queda hasta el borde, en píxeles (negativo si se
// sale); `n`, cuántas veces pasa con los mismos elementos.
//
// Lo que las cajas no dicen se mide en la tinta: `tintaDeLectura` fotografía una palabra con su lectura y cuenta los
// píxeles vacíos entre las dos. El navegador junta sus cajas, y lo que se ve depende de cuánto llena cada letra la
// suya: hay letras con las que la lectura toca la palabra aunque las cajas digan que no.

import { inflateSync } from 'node:zlib';

/** Se ejecuta dentro de la página. Sin dependencias: se envía tal cual. */
export function medirEnPagina({ minimo = 6, minimoLectura = 5, marcar = false, resaltados = '.pal, mark, ruby, .dic-resaltada' } = {}) {
  const todos = (raiz) => {
    const xs = [...raiz.querySelectorAll('*')];
    for (const e of [...xs]) if (e.shadowRoot) xs.push(...todos(e.shadowRoot));
    return xs;
  };
  const padre = (e) => e.parentElement ?? (e.getRootNode() instanceof ShadowRoot ? e.getRootNode().host : null);
  const alfa = (color) => {
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (!m) return color === 'transparent' ? 0 : 1;
    const p = m[1].split(/[,/\s]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  };
  const estilos = new WeakMap();
  const estilo = (e) => {
    let s = estilos.get(e);
    if (!s) estilos.set(e, (s = getComputedStyle(e)));
    return s;
  };
  /**
   * Los lados de una caja que se ven: todos si tiene fondo o un borde dibujado por dentro; si solo tiene bordes, los
   * suyos (una fila con una raya debajo solo tiene ese lado). Un resaltado dentro de un renglón no es una caja.
   */
  const ladosPintados = (e) => {
    const s = estilo(e);
    if (s.display === 'inline' || s.display === 'contents' || e.matches(resaltados)) return null;
    const fondo = alfa(s.backgroundColor) > 0.03 || s.backgroundImage !== 'none';
    const sombra = s.boxShadow !== 'none' && /inset/.test(s.boxShadow);
    if (fondo || sombra) return { top: true, right: true, bottom: true, left: true };
    const borde = (l) => parseFloat(s[`border${l}Width`]) > 0 && s[`border${l}Style`] !== 'none' && alfa(s[`border${l}Color`]) > 0.05;
    const lados = { top: borde('Top'), right: borde('Right'), bottom: borde('Bottom'), left: borde('Left') };
    return lados.top || lados.right || lados.bottom || lados.left ? lados : null;
  };
  const recorta = (e, eje) => {
    const v = estilo(e)[eje === 'x' ? 'overflowX' : 'overflowY'];
    return v === 'hidden' || v === 'clip' ? 'corta' : v === 'auto' || v === 'scroll' ? 'desplaza' : '';
  };
  const visible = (e) => {
    if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  };
  const nombre = (e) => {
    if (!e) return '—';
    const clases = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (clases ? `.${clases}` : '');
  };
  /** El interior de una caja: sin sus bordes. */
  const interior = (e) => {
    const r = e.getBoundingClientRect();
    const s = estilo(e);
    return { top: r.top + parseFloat(s.borderTopWidth), bottom: r.bottom - parseFloat(s.borderBottomWidth), left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth) };
  };
  /**
   * La caja pintada más cercana y lo que recorta el texto, él incluido, en cada eje. Tras una caja que se desplaza en
   * un eje, lo de más afuera ya no cuenta en ese eje: lo que no se ve se alcanza desplazando. `tras` dice si entre el
   * texto y su caja pintada hay algo que se desplaza: entonces el borde de la caja no es el del texto.
   */
  const contexto = (e) => {
    let caja = null;
    let lados = null;
    let tras = { x: false, y: false };
    const cortes = [];
    const cerrado = { x: false, y: false };
    for (let x = e; x && x !== document.documentElement; x = padre(x)) {
      for (const eje of ['x', 'y']) {
        if (cerrado[eje]) continue;
        const c = recorta(x, eje);
        if (c) cortes.push({ e: x, eje, c });
        if (c === 'desplaza') cerrado[eje] = true;
      }
      if (!caja && x !== e) {
        lados = ladosPintados(x);
        if (lados) {
          caja = x;
          tras = { ...cerrado };
        }
      }
      if (caja && cerrado.x && cerrado.y) break;
    }
    return { caja, lados, cortes, tras };
  };
  const hallazgos = new Map();
  const marcas = [];
  const anotar = (tipo, e, caja, aire, texto, r) => {
    const clave = `${tipo} | ${nombre(e)} | ${nombre(caja)}`;
    const limpio = texto.trim().replace(/\s+/g, ' ').slice(0, 28);
    const previo = hallazgos.get(clave);
    if (!previo) hallazgos.set(clave, { tipo, que: nombre(e), caja: nombre(caja), aire: Math.round(aire * 10) / 10, n: 1, texto: limpio });
    else {
      previo.n++;
      if (aire < previo.aire) {
        previo.aire = Math.round(aire * 10) / 10;
        previo.texto = limpio;
      }
    }
    if (marcar && r) marcas.push({ r: { left: r.left, top: r.top, width: r.right - r.left, height: r.bottom - r.top }, tipo });
  };
  /** Lo que de un rectángulo queda a la vista tras los recortes de sus cajas: null si no se ve nada. */
  const trasRecortes = (r, cortes) => {
    let { top, bottom, left, right } = r;
    for (const { e, eje } of cortes) {
      const c = interior(e);
      if (eje === 'x') {
        left = Math.max(left, c.left);
        right = Math.min(right, c.right);
      } else {
        top = Math.max(top, c.top);
        bottom = Math.min(bottom, c.bottom);
      }
    }
    return right - left > 0.5 && bottom - top > 0.5 ? { top, bottom, left, right } : null;
  };
  /** Lo que se recorta a propósito: puntos suspensivos o un tope de renglones. */
  const aProposito = (x) => {
    const sx = estilo(x);
    return sx.textOverflow === 'ellipsis' || (sx.webkitLineClamp && sx.webkitLineClamp !== 'none');
  };

  const elementos = todos(document);
  const rango = document.createRange();
  /** Los rectángulos de texto a la vista, para saber si una lectura pisa otro texto. */
  const textos = [];

  for (const e of elementos) {
    if (e.closest('svg, script, style, noscript, [hidden]') || !visible(e)) continue;
    const esLectura = e.tagName === 'RT';
    const propios = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propios.length) continue;
    const { caja, lados, cortes, tras } = contexto(e);
    const s = estilo(e);
    const conTope = cortes.some((c) => aProposito(c.e));
    // En vertical, el renglón corre hacia abajo y lo que sobra de su caja queda a los lados.
    const ejeDelRenglon = /vertical/.test(s.writingMode) ? 'x' : 'y';
    for (const n of propios) {
      rango.selectNodeContents(n);
      for (const r of rango.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        const v = trasRecortes(r, cortes);
        if (!v) continue;
        // De un renglón que un tope de renglones deja fuera puede asomar una rendija: no es texto a la vista.
        if (conTope && v.bottom - v.top < (r.bottom - r.top) * 0.6) continue;
        const texto = n.textContent;
        // Dónde está la tinta: el renglón de una letra mide más que lo que pinta, y con algunas, bastante más. Para
        // saber si una lectura pisa otro texto se comparan las tintas: las cajas se montan sin que nada se toque.
        const medio = (r.top + r.bottom) / 2;
        const alto = Math.min(r.bottom - r.top, parseFloat(s.fontSize));
        const tinta = { top: Math.max(v.top, medio - alto / 2), bottom: Math.min(v.bottom, medio + alto / 2), left: v.left, right: v.right };
        // 1) Lo que una caja corta sin querer (no lo que se alcanza desplazando ni lo que lleva puntos suspensivos).
        if (!conTope) {
          for (const { e: x, eje, c } of cortes) {
            if (c !== 'corta') continue;
            const i = interior(x);
            const fuera = eje === 'x' ? Math.max(i.left - r.left, r.right - i.right) : Math.max(i.top - r.top, r.bottom - i.bottom);
            // Con algo de margen: el alto del renglón de una letra pasa un poco de lo que pinta.
            const grueso = ejeDelRenglon === 'y' ? r.height : r.width;
            if (fuera > (eje === ejeDelRenglon ? Math.max(2, grueso * 0.18) : 1.5)) anotar(esLectura ? 'lectura cortada' : 'texto cortado', e, x, -fuera, texto, v);
          }
        }
        // 2) La lectura, cerca del borde de arriba de lo que la recorta o de su caja.
        if (esLectura) {
          for (const { e: x, eje, c } of cortes) {
            if (eje !== 'y' || c !== 'corta') continue;
            const aire = r.top - interior(x).top;
            if (aire >= 0 && aire < minimoLectura) anotar('lectura al límite', e, x, aire, texto, v);
          }
          if (caja) {
            const i = interior(caja);
            const aire = Math.min(lados.top ? v.top - i.top : Infinity, lados.left ? v.left - i.left : Infinity, lados.right ? i.right - v.right : Infinity);
            if (aire < minimoLectura) anotar('lectura pegada', e, caja, aire, texto, v);
          }
          textos.push({ r: tinta, e, lectura: true });
          continue;
        }
        // 3) El texto, cerca del borde de su caja. Si la caja es más pequeña que el texto, este va fuera a propósito.
        if (caja) {
          const i = interior(caja);
          // Un rótulo que va por fuera de su caja, encima o debajo, no está pegado a sus lados.
          const dentro = v.bottom > i.top + 1 && v.top < i.bottom - 1;
          if (dentro && !tras.x && i.right - i.left >= v.right - v.left) {
            const aire = Math.min(lados.left ? v.left - i.left : Infinity, lados.right ? i.right - v.right : Infinity);
            if (aire < minimo) anotar('texto pegado a los lados', e, caja, aire, texto, v);
          }
          // En vertical se mide la tinta, no el renglón: una letra ocupa más o menos su tamaño. Y no contra una caja
          // que se desplaza: ahí el borde es el de la ventana.
          const tinta = Math.min(v.bottom - v.top, parseFloat(s.fontSize) * 1.15);
          if (i.bottom - i.top >= tinta + 2 && !tras.y && !recorta(caja, 'y')) {
            const centro = (r.top + r.bottom) / 2;
            const aire = Math.min(lados.top ? centro - tinta / 2 - i.top : Infinity, lados.bottom ? i.bottom - (centro + tinta / 2) : Infinity);
            if (aire < minimo - 3) anotar('texto pegado arriba o abajo', e, caja, aire, texto, v);
          }
        }
        textos.push({ r: tinta, e, lectura: false });
      }
    }
  }
  // 4) Una lectura que pisa otro texto (el renglón de arriba, o la lectura de al lado). Solo dentro de una misma capa:
  // un panel flotante que tapa el texto de debajo no lo pisa, lo oculta.
  const capaDe = (e) => {
    for (let x = e; x; x = padre(x)) {
      const sx = estilo(x);
      if (sx.position === 'fixed' || ((sx.position === 'absolute' || sx.position === 'sticky') && sx.zIndex !== 'auto')) return x;
    }
    return null;
  };
  const lecturas = textos.filter((t) => t.lectura);
  for (const l of lecturas) {
    const ruby = l.e.closest('ruby');
    const capa = capaDe(l.e);
    for (const t of textos) {
      if (t === l || t.e === l.e || (ruby && ruby.contains(t.e)) || capaDe(t.e) !== capa) continue;
      const ancho = Math.min(l.r.right, t.r.right) - Math.max(l.r.left, t.r.left);
      const alto = Math.min(l.r.bottom, t.r.bottom) - Math.max(l.r.top, t.r.top);
      // Dos lecturas vecinas se rozan en horizontal: solo cuenta si se montan de verdad.
      if (ancho > (t.lectura ? 3 : 1.5) && alto > 2.5) anotar(t.lectura ? 'lecturas que se pisan' : 'lectura sobre otro texto', l.e, t.e, -Math.min(ancho, alto), `${l.e.textContent} ↔ ${t.e.textContent}`, l.r);
    }
  }
  // 5) Lo que hace más ancha la página que la ventana.
  const raiz = document.scrollingElement ?? document.documentElement;
  if (raiz.scrollWidth > raiz.clientWidth + 1) anotar('la página se sale a lo ancho', raiz, null, raiz.clientWidth - raiz.scrollWidth, '', null);
  // 6) Una caja que se desplaza en vertical y, por poco, también a lo ancho: sale una barra de desplazamiento que nadie
  // quiere (la de la lista de resultados la sacaba la pista invisible de una estrella). Lo que se desliza a lo ancho a
  // propósito, como una fila de tarjetas, se pasa de largo: le sobra mucho más que eso.
  for (const e of elementos) {
    if (!visible(e) || e === raiz) continue;
    const sx = estilo(e);
    if (!/auto|scroll/.test(sx.overflowX) || !/auto|scroll/.test(sx.overflowY)) continue;
    const sobra = e.scrollWidth - e.clientWidth;
    if (sobra > 1 && sobra <= Math.max(48, e.clientWidth * 0.25)) anotar('barra de desplazamiento de sobra', e, e, -sobra, '', e.getBoundingClientRect());
  }

  if (marcar) {
    const capa = document.createElement('div');
    capa.id = 'kk-auditoria';
    capa.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    for (const { r, tipo } of marcas) {
      const m = document.createElement('div');
      const color = /cortad|pisa|sobre/.test(tipo) ? '#ff3b30' : /lectura/.test(tipo) ? '#ff9f0a' : '#ffd60a';
      m.style.cssText = `position:absolute;left:${r.left - 2}px;top:${r.top - 2}px;width:${r.width + 4}px;height:${r.height + 4}px;outline:1.5px solid ${color};border-radius:3px`;
      capa.appendChild(m);
    }
    document.documentElement.appendChild(capa);
  }
  return [...hallazgos.values()].sort((a, b) => a.aire - b.aire);
}

/** Mide una página de Playwright. Con `marcar`, deja señalado en la página cada hallazgo (para la captura). */
export async function auditar(pagina, opciones = {}) {
  return pagina.evaluate(medirEnPagina, opciones);
}

/** Quita las marcas que dejó `auditar` con `marcar`. */
export const quitarMarcas = (pagina) => pagina.evaluate(() => document.getElementById('kk-auditoria')?.remove());

export function resumen(hallazgos, tope = 30) {
  return hallazgos.slice(0, tope).map((h) => `  ${String(h.aire).padStart(6)} px  ×${String(h.n).padEnd(3)} ${h.tipo}: ${h.que} en ${h.caja}  «${h.texto}»`);
}

/** Los grises de un PNG de 8 bits (RGB o RGBA, sin entrelazar), que es como salen las capturas. */
export function grisesDePng(png) {
  let ancho = 0;
  let alto = 0;
  let canales = 4;
  const partes = [];
  for (let p = 8; p < png.length; ) {
    const largo = png.readUInt32BE(p);
    const tipo = png.toString('latin1', p + 4, p + 8);
    const datos = png.subarray(p + 8, p + 8 + largo);
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0);
      alto = datos.readUInt32BE(4);
      if (datos[8] !== 8 || datos[12] !== 0 || (datos[9] !== 2 && datos[9] !== 6)) throw new Error('PNG de un tipo que no se sabe leer');
      canales = datos[9] === 6 ? 4 : 3;
    } else if (tipo === 'IDAT') partes.push(datos);
    else if (tipo === 'IEND') break;
    p += 12 + largo;
  }
  const crudo = inflateSync(Buffer.concat(partes));
  const paso = ancho * canales;
  const gris = new Uint8Array(ancho * alto);
  let previa = new Uint8Array(paso);
  for (let y = 0, q = 0; y < alto; y++) {
    const filtro = crudo[q++];
    const fila = new Uint8Array(paso);
    for (let x = 0; x < paso; x++) {
      const a = x >= canales ? fila[x - canales] : 0;
      const b = previa[x];
      const c = x >= canales ? previa[x - canales] : 0;
      let v = crudo[q++];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      fila[x] = v & 255;
    }
    for (let x = 0; x < ancho; x++) gris[y * ancho + x] = (fila[x * canales] * 3 + fila[x * canales + 1] * 6 + fila[x * canales + 2]) / 10;
    previa = fila;
  }
  return { ancho, alto, gris };
}

/**
 * La tinta de una palabra con su lectura encima (un <ruby>, por su localizador): cuántos píxeles vacíos quedan entre
 * la lectura y la palabra, y cuántos de la lectura al borde de arriba de `caja`, el selector de lo que la contiene.
 * Devuelve null si no se distinguen. Las medidas van en píxeles de CSS.
 */
export async function tintaDeLectura(pagina, ruby, caja) {
  if (!(await ruby.count())) return null;
  await ruby.scrollIntoViewIfNeeded().catch(() => {});
  const m = await ruby.evaluate((e, caja) => {
    const r = e.getBoundingClientRect();
    const k = e.querySelector('rt').getBoundingClientRect();
    const t = caja ? e.closest(caja)?.getBoundingClientRect() : null;
    const arriba = Math.min(r.top, k.top);
    return { x: Math.min(r.left, k.left), y: arriba, ancho: Math.max(r.right, k.right) - Math.min(r.left, k.left), alto: r.bottom - arriba, hastaCaja: t ? arriba - t.top : null, letra: parseFloat(getComputedStyle(e.querySelector('rt')).fontSize), escala: devicePixelRatio };
  }, caja);
  // Un margen arriba, sin llegar al borde de la caja: su raya contaría como tinta.
  const margen = Math.max(2, Math.min(12, (m.hastaCaja ?? 12) - 3));
  const { ancho, alto, gris } = grisesDePng(await pagina.screenshot({ clip: { x: Math.max(0, m.x - 1), y: Math.max(0, m.y - margen), width: m.ancho + 2, height: m.alto + margen + 1 } }));
  // El fondo es el gris que más se repite; tinta, lo que se aparta bastante de él.
  const cuenta = new Uint32Array(256);
  for (const g of gris) cuenta[g]++;
  const fondo = cuenta.indexOf(Math.max(...cuenta));
  const tramos = [];
  for (let y = 0; y < alto; y++) {
    let hay = false;
    for (let x = 0; x < ancho && !hay; x++) hay = Math.abs(gris[y * ancho + x] - fondo) > 70;
    if (!hay) continue;
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo[1] === y - 1) ultimo[1] = y;
    else tramos.push([y, y]);
  }
  if (!tramos.length) return null;
  // La palabra es el tramo más alto; la lectura, lo que queda encima.
  const base = tramos.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  const encima = tramos.filter((t) => t[1] < base[0]);
  if (!encima.length) return { aire: 0, arriba: null, letra: m.letra };
  return { aire: (base[0] - encima.at(-1)[1] - 1) / m.escala, arriba: m.hastaCaja === null ? null : m.hastaCaja + encima[0][0] / m.escala - margen, letra: m.letra };
}
