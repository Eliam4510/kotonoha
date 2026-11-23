// El tipo de nota «Kotonoha» que se crea en Anki: su anverso, su reverso y su estilo. Las secciones sin datos no se
// pintan ({{#Campo}}), la palabra de la frase se marca como con rotulador, la letra depende de la lengua (por la etiqueta
// kotonoha::<lengua> que lleva cada nota) y el modo noche de Anki usa los colores oscuros de la app. Una versión
// anterior sin tocar se pone al día sola (motor/anki.ts); la marca de versión va en el CSS.

import { tr } from '../compartido/i18n';

/** Va en el CSS: así se sabe qué diseño tiene el tipo de nota que ya está en Anki. */
export const MARCA_PLANTILLA = 'Kotonoha · plantilla 2';

/** El nombre de la única plantilla del tipo de nota. */
export const NOMBRE_PLANTILLA = 'Frase';

export const CSS_TARJETA = `/* ${MARCA_PLANTILLA} */
.card {
  --papel: #F5F2E9; --hoja: #FFFEFA; --tinta: #1B2217; --tinta-2: #4C5647; --tinta-3: #848D7C;
  --borde: rgba(46, 56, 34, 0.12); --marca: #E8622E; --marca-suave: rgba(232, 98, 46, 0.16);
  --hoja-verde: #3F8A18; --verde-suave: rgba(76, 154, 31, 0.1); --separador: rgba(76, 154, 31, 0.28);
  --sombra: 0 1px 2px rgba(27, 34, 23, 0.05), 0 14px 34px -16px rgba(27, 34, 23, 0.22);
  margin: 0; padding: 0; background: var(--papel); color: var(--tinta); text-align: center;
  font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, "Noto Sans JP", "Noto Sans CJK JP", sans-serif;
  font-size: 18px; line-height: 1.6; -webkit-font-smoothing: antialiased;
}
.card.nightMode, .card.night_mode, .nightMode .card, .night_mode .card {
  --papel: #0D1210; --hoja: #151B18; --tinta: #F2F5EE; --tinta-2: #BAC4B8; --tinta-3: #87918A;
  --borde: rgba(226, 240, 226, 0.1); --marca: #FF9166; --marca-suave: rgba(255, 145, 102, 0.2);
  --hoja-verde: #A9E45B; --verde-suave: rgba(169, 228, 91, 0.1); --separador: rgba(169, 228, 91, 0.22);
  --sombra: 0 1px 2px rgba(0, 0, 0, 0.4), 0 18px 40px -18px rgba(0, 0, 0, 0.7);
}
.kk { max-width: 680px; margin: 0 auto; padding: 26px 16px 34px; box-sizing: border-box; }
/* La pregunta, en medio de la pantalla. */
.kk-anverso { min-height: 86vh; display: flex; flex-direction: column; justify-content: center; }
.kk[data-etiquetas~="kotonoha::zh"] { font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", "Noto Sans CJK SC", sans-serif; }
.kk[data-etiquetas~="kotonoha::en"], .kk[data-etiquetas~="kotonoha::de"] { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }

/* La frase, en su hoja. */
.kk-hoja { background: var(--hoja); border: 1px solid var(--borde); border-radius: 22px; box-shadow: var(--sombra); padding: 30px 26px 24px; }
.kk-frase { font-size: clamp(24px, 5.2vw, 34px); font-weight: 600; line-height: 1.75; letter-spacing: 0.01em; word-break: normal; overflow-wrap: anywhere; }
.kk-frase b, .kk-frase strong { font-weight: 700; color: inherit; background: linear-gradient(transparent 58%, var(--marca-suave) 58%, var(--marca-suave) 92%, transparent 92%); box-shadow: inset 0 -3px 0 -1px var(--marca); padding: 0 0.08em; border-radius: 2px; }
.kk-frase ruby rt { font-size: 0.44em; font-weight: 500; color: var(--tinta-3); }
.kk-frase b ruby rt, .kk-frase strong ruby rt { color: var(--marca); }
/* El pinyin va sobre cada carácter y en letras latinas: más grande que la furigana, o no se lee. */
.kk[data-etiquetas~="kotonoha::zh"] .kk-frase { font-size: clamp(26px, 5.6vw, 36px); line-height: 2.1; }
.kk[data-etiquetas~="kotonoha::zh"] .kk-frase ruby { margin: 0 0.07em; }
.kk[data-etiquetas~="kotonoha::zh"] .kk-frase ruby rt { font-size: 0.56em; padding: 0 0.08em; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.kk-sola { font-size: clamp(40px, 9vw, 64px); font-weight: 700; line-height: 1.3; }
.kk-traduccion { margin: 16px auto 0; max-width: 34em; font-size: 16.5px; line-height: 1.55; color: var(--tinta-2); }

/* El audio: el botón de Anki con los colores de la app. */
.kk-audios { display: flex; justify-content: center; gap: 10px; margin-top: 16px; }
.kk .replay-button, .kk .replaybutton { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; vertical-align: middle; }
.kk .replay-button svg { width: 40px; height: 40px; }
.kk .replay-button svg circle { fill: var(--verde-suave); stroke: none; }
.kk .replay-button svg path { fill: var(--hoja-verde); }
.kk .replay-button:hover svg circle { fill: var(--marca-suave); }
.kk .replay-button:hover svg path { fill: var(--marca); }

/* La imagen de la escena, arriba del reverso. */
.kk-imagen { margin: 0 0 18px; }
.kk-imagen img { display: block; width: 100%; max-height: 250px; object-fit: cover; border-radius: 18px; box-shadow: var(--sombra); margin: 0 auto; }

/* Al enseñar la respuesta, Anki lleva la vista hasta #answer: va arriba del todo, para que no se salte la frase. */
.kk hr#answer { height: 0; margin: 0; border: 0; }
/* Entre la frase y la palabra: una línea corta. */
.kk-separador { width: 56px; height: 3px; margin: 22px auto; border-radius: 3px; background: var(--separador); }

/* La palabra: cabecera con su lectura y su audio, y debajo la definición. */
.kk-palabra { text-align: left; background: var(--hoja); border: 1px solid var(--borde); border-radius: 20px; padding: 18px 22px 20px; }
.kk-palabra-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.kk-termino { font-size: 30px; font-weight: 700; line-height: 1.3; color: var(--tinta); }
.kk-lectura { font-size: 15px; font-weight: 600; color: var(--hoja-verde); background: var(--verde-suave); border-radius: 999px; padding: 3px 12px; }
.kk-palabra-cab .replay-button svg { width: 32px; height: 32px; }
.kk-definicion { margin-top: 12px; font-size: 16.5px; line-height: 1.65; color: var(--tinta-2); }
.kk-definicion b, .kk-definicion strong { display: inline-block; color: var(--tinta); font-weight: 700; padding-left: 12px; margin-bottom: 4px; border-left: 3px solid var(--marca); }
.kk-definicion ol, .kk-definicion ul { margin: 6px 0 0; padding-left: 1.3em; }

/* Lo demás, más discreto. */
.kk-notas { text-align: left; margin: 14px 0 0; padding: 12px 16px; border-radius: 14px; background: var(--verde-suave); font-size: 15.5px; line-height: 1.6; color: var(--tinta-2); }
.kk-plegable { text-align: left; margin: 12px 0 0; padding: 10px 16px; border-radius: 14px; border: 1px solid var(--borde); font-size: 15.5px; color: var(--tinta-2); }
.kk-plegable summary { cursor: pointer; font-weight: 700; color: var(--tinta); }
.kk-plegable[open] summary { margin-bottom: 6px; }
.kk-fuente { margin-top: 16px; font-size: 13px; color: var(--tinta-3); }
.kk-fuente a { color: var(--tinta-3); text-decoration: none; border-bottom: 1px dotted currentColor; }
.kk-fuente a:hover { color: var(--marca); }
.kk-fuente::before { content: "◆"; display: inline-block; margin-right: 7px; font-size: 9px; color: var(--hoja-verde); vertical-align: 2px; }

@media (max-width: 480px) {
  .kk { padding: 14px 10px 24px; }
  .kk-hoja { padding: 22px 16px 18px; border-radius: 18px; }
  .kk-palabra { padding: 16px 16px 18px; }
  .kk-termino { font-size: 26px; }
}`;

/** El anverso: la frase con la palabra marcada y su audio; sin frase, la palabra sola. */
export const ANVERSO = `<div class="kk kk-anverso" data-etiquetas="{{Tags}}">
<div class="kk-hoja">
{{#Frase}}<div class="kk-frase">{{Frase}}</div>{{/Frase}}
{{^Frase}}<div class="kk-sola">{{Palabra}}</div>{{/Frase}}
{{#AudioFrase}}<div class="kk-audios">{{AudioFrase}}</div>{{/AudioFrase}}
</div>
</div>`;

/** El reverso: la escena, la frase con su lectura y su traducción, y la palabra con lo que significa. */
export function reverso(): string {
  return `<div class="kk kk-reverso" data-etiquetas="{{Tags}}">
<hr id="answer">
{{#Imagen}}<div class="kk-imagen">{{Imagen}}</div>{{/Imagen}}
<div class="kk-hoja">
{{#Frase}}<div class="kk-frase">{{furigana:FraseFurigana}}</div>{{/Frase}}
{{^Frase}}<div class="kk-sola">{{Palabra}}</div>{{/Frase}}
{{#AudioFrase}}<div class="kk-audios">{{AudioFrase}}</div>{{/AudioFrase}}
{{#Traduccion}}<div class="kk-traduccion">{{Traduccion}}</div>{{/Traduccion}}
</div>
<div class="kk-separador"></div>
{{#Palabra}}<div class="kk-palabra">
<div class="kk-palabra-cab"><span class="kk-termino">{{Palabra}}</span>{{#Lectura}}<span class="kk-lectura">{{Lectura}}</span>{{/Lectura}}{{AudioPalabra}}</div>
{{#Definicion}}<div class="kk-definicion">{{Definicion}}</div>{{/Definicion}}
</div>{{/Palabra}}
{{^Palabra}}{{#Definicion}}<div class="kk-palabra"><div class="kk-definicion">{{Definicion}}</div></div>{{/Definicion}}{{/Palabra}}
{{#Notas}}<div class="kk-notas">{{Notas}}</div>{{/Notas}}
{{#Ejemplos}}<details class="kk-plegable"><summary>${tr('Ejemplos')}</summary>{{Ejemplos}}</details>{{/Ejemplos}}
{{#Fuente}}<div class="kk-fuente">{{Fuente}}</div>{{/Fuente}}
</div>`;
}

/** La plantilla de antes (hasta la 0.48.1): si la de Anki sigue tal cual, nadie la tocó. */
export const ANVERSO_PLANTILLA_1 = '<div class="frase">{{Frase}}</div>{{AudioFrase}}';
export const REVERSO_PLANTILLA_1 = `<div class="frase">{{furigana:FraseFurigana}}</div>{{AudioFrase}}
<hr id="answer">
<div class="palabra">{{Palabra}}</div><div class="lectura">{{Lectura}}</div>{{AudioPalabra}}
<div class="traduccion">{{Traduccion}}</div>
<div class="definicion">{{Definicion}}</div>
<div>{{Imagen}}</div>
<div class="notas">{{Notas}}</div>
<div class="notas">{{Ejemplos}}</div>
<div class="fuente">{{Fuente}}</div>`;

/** El diseño de antes (hasta la 0.48.1): si el tipo de nota sigue así, nadie lo tocó, y se puede poner al día. */
export const CSS_PLANTILLA_1 = `.card { font-family: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif; font-size: 22px; text-align: center; color: #1B2217; background: #F5F2E9; line-height: 1.65; padding: 12px; }
.frase { font-size: 30px; font-weight: 700; margin: 18px 0; }
.frase b { color: #E8622E; font-weight: 700; }
.palabra { font-size: 26px; font-weight: 700; color: #4C9A1F; }
.lectura { color: #848D7C; font-size: 17px; }
.traduccion { color: #525C4C; margin-top: 12px; }
.definicion { text-align: left; margin: 16px auto; max-width: 640px; font-size: 18px; padding: 12px 18px; background: #FFFEFA; border-radius: 16px; }
.notas { text-align: left; margin: 14px auto; max-width: 640px; font-size: 16px; color: #525C4C; }
.fuente, .fuente a { color: #848D7C; font-size: 13px; margin-top: 14px; }
hr#answer { border: 0; border-top: 1px solid rgba(46, 56, 34, 0.14); margin: 18px 0; }
img { max-width: 100%; max-height: 320px; border-radius: 16px; }
.card.nightMode { background: #0D1210; color: #F2F5EE; }
.nightMode .frase b { color: #FF9166; }
.nightMode .palabra { color: #A9E45B; }
.nightMode .traduccion, .nightMode .notas { color: #B5BFB5; }
.nightMode .definicion { background: #151B18; }
.nightMode hr#answer { border-top-color: rgba(226, 240, 226, 0.14); }`;

/** Igual salvo espacios: Anki puede guardar el CSS con otros saltos de línea. */
export const mismoCss = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
