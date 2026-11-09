// La marca de Kotonoha: una hoja que también es un globo de diálogo, con 言 dentro.
// 言の葉 significa «hojas de palabras».

import { HOJA, HOJA_PEQUENA } from './marca-datos';

export function Logo({ t = 28 }: { t?: number }) {
  return (
    <svg
      class="logo"
      width={t}
      height={t}
      viewBox="0 0 128 128"
      role="img"
      aria-label="Kotonoha"
      dangerouslySetInnerHTML={{ __html: t >= 30 ? HOJA : HOJA_PEQUENA }}
    />
  );
}

/**
 * La hoja en un canvas, para las imágenes que se generan (la tarjeta para compartir). Se dibuja con los mismos trazos del
 * SVG, leídos de marca-datos.ts: así no hay una segunda copia del logo que pueda quedarse vieja.
 */
export function dibujarHoja(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, opacidad = 1, silueta = false) {
  const caminos = [...HOJA.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  const paradas = [...HOJA.matchAll(/<stop offset="([\d.]+)" stop-color="(#[0-9A-Fa-f]{3,6})"\/>/g)].slice(0, 3);
  const rect = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)"/.exec(HOJA);
  if (caminos.length < 2) return;
  ctx.save();
  ctx.globalAlpha = opacidad;
  ctx.translate(x, y);
  ctx.scale(t / 128, t / 128);
  const verde = ctx.createLinearGradient(116, 12, 14, 116);
  for (const [, offset, color] of paradas) verde.addColorStop(Number(offset), color);
  const cuerpo = new Path2D(caminos[0]);
  ctx.fillStyle = verde;
  ctx.strokeStyle = verde;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.fill(cuerpo);
  ctx.stroke(cuerpo);
  if (silueta) {
    ctx.restore();
    return;
  }
  const brillo = ctx.createLinearGradient(46, 16, 66, 62);
  brillo.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
  brillo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = brillo;
  ctx.fill(new Path2D(caminos[1]));
  ctx.strokeStyle = '#123C24';
  ctx.lineWidth = 6.4;
  ctx.lineCap = 'round';
  for (const d of caminos.slice(2)) ctx.stroke(new Path2D(d));
  if (rect) {
    const [, rx, ry, ancho, alto, radio] = rect.map(Number);
    ctx.beginPath();
    ctx.roundRect(rx, ry, ancho, alto, radio);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * La firma de las imágenes: la hoja, «Kotonoha» y 言の葉, alineada a la derecha de `xDerecha` y centrada en `yCentro`.
 * Devuelve lo que ocupa a lo ancho.
 */
export function dibujarFirma(
  ctx: CanvasRenderingContext2D,
  xDerecha: number,
  yCentro: number,
  alto: number,
  colores: { texto: string; tenue: string },
  letras: { latin: string; japones: string },
  dibujar = true
): number {
  const nombre = `800 ${Math.round(alto * 0.64)}px ${letras.latin}`;
  const kanji = `700 ${Math.round(alto * 0.46)}px ${letras.japones}`;
  ctx.font = nombre;
  const anchoNombre = ctx.measureText('Kotonoha').width;
  ctx.font = kanji;
  const anchoKanji = ctx.measureText('言の葉').width;
  const hueco = alto * 0.26;
  const total = alto + hueco + anchoNombre + hueco * 1.3 + anchoKanji;
  if (!dibujar) return total;
  let x = xDerecha - total;
  dibujarHoja(ctx, x, yCentro - alto / 2, alto);
  x += alto + hueco;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = nombre;
  ctx.fillStyle = colores.texto;
  ctx.fillText('Kotonoha', x, yCentro);
  x += anchoNombre + hueco * 1.3;
  ctx.font = kanji;
  ctx.fillStyle = colores.tenue;
  ctx.fillText('言の葉', x, yCentro + alto * 0.03);
  return total;
}

/** Logo y nombre juntos. `conKanji` añade 言の葉 al lado. */
export function Marca({ t = 30, conKanji = false }: { t?: number; conKanji?: boolean }) {
  return (
    <span class="marca" style={{ fontSize: `${Math.round(t * 0.72)}px` }}>
      <Logo t={t} />
      <span class="marca-nombre">Kotonoha</span>
      {conKanji && <span class="marca-kanji" lang="ja">言の葉</span>}
    </span>
  );
}
