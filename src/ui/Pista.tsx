// Las pistas de la primera vez: una por pantalla (el visor, el Cuaderno, la Memoria, el diccionario), que dicen lo
// esencial y se cierran para siempre. Solo para quien instaló Kotonoha con la bienvenida: quien ya lo usaba conoce sus
// pantallas, y tiene «Descubre Kotonoha» y «Lo nuevo».

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { type Ajustes, guardarAjustes, leerAjustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { Icono } from './iconos';

/** Si una pista se ve: hay pistas en esta instalación y esa aún no se ha cerrado. */
export const pistaVisible = (a: Pick<Ajustes, 'pistas' | 'pistasVistas'>, id: string) => a.pistas && !a.pistasVistas.includes(id);

export function Pista({ a, id, children }: { a: Ajustes; id: string; children: ComponentChildren }) {
  const [cerrada, fijarCerrada] = useState(false);
  if (cerrada || !pistaVisible(a, id)) return null;
  // Sobre lo último guardado: otra pantalla abierta puede haber cerrado la suya mientras tanto.
  const cerrar = () => {
    fijarCerrada(true);
    leerAjustes()
      .then((x) => guardarAjustes({ pistasVistas: [...new Set([...x.pistasVistas, id])] }))
      .catch(console.error);
  };
  return (
    <div class="ap-pista" role="note" data-pista={id}>
      <span class="ap-pista-icono" aria-hidden="true">
        <Icono n="bombilla" t={16} />
      </span>
      <span class="ap-pista-texto">{children}</span>
      <button type="button" class="btn chico" onClick={cerrar}>
        {tr('Entendido')}
      </button>
    </div>
  );
}
