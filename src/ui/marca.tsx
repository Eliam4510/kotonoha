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
