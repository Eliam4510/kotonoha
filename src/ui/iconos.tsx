// Iconos de Phosphor en versión duotono. La capa suave (.d) se puede teñir desde CSS con
// --ico-capa y --ico-opacidad; el catálogo está en herramientas/iconos.mjs.

import { ICONOS, type NombreIcono } from './iconos-datos';

export type { NombreIcono };
export { Logo, Marca } from './marca';

export function Icono({ n, t = 18, clase }: { n: NombreIcono; t?: number; clase?: string }) {
  return (
    <svg
      class={clase ? `ico ${clase}` : 'ico'}
      width={t}
      height={t}
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONOS[n] }}
    />
  );
}
