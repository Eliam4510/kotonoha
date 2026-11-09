// «Repetir con tu voz»: la práctica del acento con una frase que llega de fuera, como un subtítulo del video. Se abre en
// la ventana de Kotonoha, donde el micrófono es de la extensión y no del sitio del video.

import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { lengua } from '../ui/lengua';
import { Cabecera, Vacio } from './Piezas';
import { Practica } from './Practica';

export function PracticarFrase({ frase, ajustes }: { frase: string; ajustes: Ajustes }) {
  const texto = frase.replace(/\s*\n\s*/g, ' ').trim();
  if (!texto || !lengua.value.acento?.practica) {
    return (
      <div class="ap-lienzo">
        <Vacio icono="microfono" titulo={tr('Nada que practicar')}>
          <p>{tr('La práctica de pronunciación aún no está para esta lengua, o la frase llegó vacía.')}</p>
        </Vacio>
      </div>
    );
  }
  return (
    <div class="ap-lienzo ap-practicar-frase">
      <Cabecera titulo={tr('Repetir con tu voz')} sub={tr('Escucha la frase en el video (S la repite), dila igual y compara tu entonación con la esperada.')} />
      <div class="tarjeta ap-practicar-tarjeta">
        <Practica frase={texto} palabras={[]} ajustes={ajustes} alCerrar={() => window.close()} />
      </div>
    </div>
  );
}
