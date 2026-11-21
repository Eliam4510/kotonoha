// El acento de la voz neuronal frente al de AivisSpeech, con el corpus de herramientas/corpus-acento.mjs: mora a mora, el
// tono que le pondría Style-Bert-VITS2 a cada una. Se compara donde las dos lecturas dicen lo mismo. No puede bajar de lo
// medido; si una regla nueva lo mejora, se sube el suelo.

import { beforeAll, describe, expect, it } from 'vitest';
import { diccionarioYomi } from '../../../../herramientas/yomi-diccionario.mjs';
import corpus from './corpus-acento.json';
import { tonosDeFrase } from './entrada';
import { VOZ_INTEGRADA as voz } from './index';

/** Lo medido el 2026-11-20 con yomi y las tres reglas de enlace. */
const SUELO = { lectura: 0.852, moras: 0.916 };

beforeAll(async () => {
  voz.cargar(await diccionarioYomi(voz.diccionario));
}, 120000);

const VOCALES: Record<string, string> = { a: 'アカガサザタダナハバパマヤラワァャ', i: 'イキギシジチヂニヒビピミリィ', u: 'ウクグスズツヅヌフブプムユルゥュヴ', e: 'エケゲセゼテデネヘベペメレェ', o: 'オコゴソゾトドノホボポモヨロヲォョ' };

/** La vocal de cada mora (N y q para ん y っ), con la raya larga y おう, えい como vocal repetida: lo que se dice. */
function vocales(moras: string[]): string {
  const vs: string[] = [];
  for (const m of moras) {
    const ultima = m.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).at(-1) ?? '';
    const v = ultima === 'ン' ? 'N' : ultima === 'ッ' ? 'q' : ultima === 'ー' ? (vs.at(-1) ?? '?') : (Object.entries(VOCALES).find(([, l]) => l.includes(ultima))?.[0] ?? '?');
    vs.push(v);
  }
  for (let k = 1; k < vs.length; k++) if ((vs[k - 1] === 'o' && vs[k] === 'u') || (vs[k - 1] === 'e' && vs[k] === 'i')) vs[k] = vs[k - 1];
  return vs.join('');
}

describe('el acento, frente al de AivisSpeech', () => {
  it(`lee como él al menos el ${SUELO.lectura * 100} % de las frases, y en ellas el ${SUELO.moras * 100} % de las moras tiene su tono`, () => {
    let iguales = 0;
    let moras = 0;
    let tonosIguales = 0;
    let exactas = 0;
    for (const f of corpus.frases) {
      const referencia = f.frases;
      const propias = voz.analizar(f.texto).flatMap((o) => o.frases);
      if (vocales(referencia.flatMap((r) => r.m)) !== vocales(propias.flatMap((p) => p.moras))) continue;
      iguales++;
      const tRef = referencia.flatMap((r) => tonosDeFrase(r.m.length, r.a));
      const tPropios = propias.flatMap((p) => tonosDeFrase(p.moras.length, p.nucleo));
      const coinciden = tRef.filter((t, i) => t === tPropios[i]).length;
      moras += tRef.length;
      tonosIguales += coinciden;
      if (coinciden === tRef.length) exactas++;
    }
    const lectura = iguales / corpus.frases.length;
    const tono = tonosIguales / moras;
    console.log(`acento: misma lectura ${(100 * lectura).toFixed(1)} %, moras con su tono ${(100 * tono).toFixed(1)} %, frases idénticas ${((100 * exactas) / iguales).toFixed(1)} %`);
    expect(lectura).toBeGreaterThanOrEqual(SUELO.lectura);
    expect(tono).toBeGreaterThanOrEqual(SUELO.moras);
  });
});
