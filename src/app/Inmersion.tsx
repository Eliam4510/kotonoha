// Las horas de inmersión en Inicio: el tiempo de hoy, de los últimos siete días y del total, la racha de días seguidos,
// una barra por día de la semana y lo que más se ha visto o leído. Lo cuentan el controlador de los videos, el visor de
// la Ayuda de lectura, el Portapapeles y los textos de la biblioteca (compartido/relojInmersion.ts).

import { useEffect, useState } from 'preact/hooks';
import { bcp47Actual, numero, tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import { type ResumenInmersion, RACHA_MINIMA_S } from '../nucleo/inmersion';
import { Icono } from '../ui/iconos';

/** Una duración para leerla: 45 min, 2 h 10 min, 120 h. */
export function duracionInmersion(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return tr('{0} min', minutos);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  // Con muchas horas, los minutos ya no dicen nada.
  return resto && horas < 10 ? tr('{0} h {1} min', horas, resto) : tr('{0} h', numero(horas));
}

const fechaDe = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
};

export function TarjetaInmersion() {
  const [r, fijarR] = useState<ResumenInmersion | null>(null);
  useEffect(() => {
    motor.resumenInmersion().then(fijarR).catch(() => {});
  }, []);
  if (!r) return null;
  const maximo = Math.max(...r.dias.map((d) => d.segundos), 1);
  const diaCorto = new Intl.DateTimeFormat(bcp47Actual(), { weekday: 'narrow' });
  const diaLargo = new Intl.DateTimeFormat(bcp47Actual(), { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <section class="tarjeta ap-inmersion ap-c12" aria-labelledby="ap-t-inmersion">
      <div class="ap-tarjeta-cab">
        <span class="hoja-icono chica"><Icono n="reloj" t={18} /></span>
        <h2 id="ap-t-inmersion">{tr('Horas de inmersión')}</h2>
      </div>
      {r.total < 60 ? (
        <p class="ayuda ap-tarjeta-ayuda">{tr('Kotonoha cuenta el tiempo que escuchas y lees en la lengua que estudias: los videos con sus subtítulos, los libros de la Ayuda de lectura y el Portapapeles. Aquí verás tus horas y tu racha de días seguidos.')}</p>
      ) : (
        <div class="ap-inmersion-cuerpo">
          <div class="ap-inmersion-cifras">
            <div class="ap-cifra-grande mediana">
              <b class="num">{duracionInmersion(r.hoy)}</b>
              <span>{tr('hoy')}</span>
            </div>
            <dl class="ap-cifras-menores">
              <div><dt>{tr('Últimos 7 días')}</dt><dd class="num">{duracionInmersion(r.semana)}</dd></div>
              <div><dt>{tr('En total')}</dt><dd class="num">{duracionInmersion(r.total)}</dd></div>
              <div title={tr('Días seguidos con al menos {0} minutos.', RACHA_MINIMA_S / 60)}>
                <dt>{tr('Racha')}</dt>
                <dd class="num">{r.racha === 1 ? tr('1 día') : tr('{0} días', r.racha)}</dd>
              </div>
            </dl>
          </div>
          <ol class="ap-inmersion-dias" aria-label={tr('Los últimos siete días')}>
            {r.dias.map((d, i) => {
              const fecha = fechaDe(d.dia);
              const texto = `${diaLargo.format(fecha)}: ${duracionInmersion(d.segundos)}`;
              return (
                <li key={d.dia} class={i === r.dias.length - 1 ? 'hoy' : ''} title={texto} aria-label={texto}>
                  <span class="ap-inmersion-barra"><i style={{ height: d.segundos ? `${Math.max(4, (d.segundos / maximo) * 100)}%` : '0' }} /></span>
                  <span class="ap-inmersion-dia" aria-hidden="true">{diaCorto.format(fecha)}</span>
                </li>
              );
            })}
          </ol>
          {r.mas.length > 0 && (
            <div class="ap-inmersion-mas">
              <span class="ayuda">{tr('Lo que más has visto y leído')}</span>
              <ul>
                {r.mas.map((f) => (
                  <li key={`${f.tipo}:${f.fuente}`}>
                    <Icono n={f.tipo === 'video' ? 'video' : f.fuente === 'portapapeles' ? 'portapapeles' : 'libro'} t={15} />
                    <span class="ap-inmersion-titulo">{f.fuente === 'portapapeles' ? tr('Portapapeles') : f.titulo || f.fuente}</span>
                    <span class="num">{duracionInmersion(f.segundos)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
