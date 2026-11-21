// Los enlaces de frase acentual que pyopenjtalk-plus, el de AivisSpeech, hace y OpenJTalk no. yomi sigue las reglas de
// OpenJTalk (njd_set_accent_phrase): tras una palabra auxiliar, la siguiente palabra con significado abre frase, y así
// 遅れて｜いる, 勉強｜する o する｜の salen separadas, con una subida de tono de más en medio. Se marcan enlazadas antes de
// que yomi decida las demás, porque yomi solo decide los enlaces que nadie ha marcado. Cada regla se midió con el corpus
// de acento (corpus-acento.json): con estas tres, las frases idénticas a AivisSpeech pasan del 20 al 35 %.

import type { NjdNode } from './yomi/njd/types';

/** Las reglas, por si hay que medirlas una a una. */
export const REGLAS_ENLACE: Record<string, (anterior: NjdNode, nodo: NjdNode) => boolean> = {
  /** El verbo auxiliar tras て o で: 遅れて＋いる, 読んで＋しまう. */
  verboDependienteTrasTe: (a, n) => n.pos[0] === '動詞' && n.pos[1] === '非自立' && a.pos[0] === '助詞' && a.pos[1] === '接続助詞' && (a.surface === 'て' || a.surface === 'で'),
  /** する tras un sustantivo que se conjuga con ella: 勉強＋する, 遅刻＋します. */
  suruTrasSahen: (a, n) => n.pos[0] === '動詞' && n.pos[4] === 'サ変・スル' && a.pos[0] === '名詞' && a.pos[1] === 'サ変接続',
  /** Un sustantivo formal tras verbo, auxiliar o adjetivo: する＋の, 言っている＋こと. */
  formalTrasVerbo: (a, n) => n.pos[0] === '名詞' && n.pos[1] === '非自立' && (a.pos[0] === '動詞' || a.pos[0] === '助動詞' || a.pos[0] === '形容詞'),
};

/** Marca enlazados con el anterior los nodos que lo van en pyopenjtalk-plus. */
export function enlacesDeMas(nodos: NjdNode[], reglas = Object.values(REGLAS_ENLACE)): void {
  for (let i = 1; i < nodos.length; i++) if (reglas.some((r) => r(nodos[i - 1], nodos[i]))) nodos[i].chainFlag = true;
}
