// Memoria: repaso espaciado propio con FSRS, para quien no quiera usar Anki. Cada respuesta queda apuntada con el estado
// de antes: así se puede deshacer, y de ahí salen la racha, los aciertos y los repasos de cada día (nucleo/memoria.ts).

import { createEmptyCard, type Card, fsrs, type Grade, Rating } from 'ts-fsrs';
import type { BorradorTarjeta, TarjetaMemoria } from '../compartido/tipos';
import { enOrdenDeRepaso, estadisticas as calcularEstadisticas, estadoDe, nuevasQuedan, type TarjetaParaOrden } from '../nucleo/memoria';
import { db } from './db';

const programador = fsrs({ enable_fuzz: true });

export async function crearTarjetaMemoria(b: BorradorTarjeta): Promise<string> {
  const id = crypto.randomUUID();
  const tarjeta = createEmptyCard(new Date());
  await db.memoria.put({
    id,
    mazo: 'Kotonoha',
    frente: b.frase || b.palabra,
    reverso: b.definicion,
    borrador: b,
    creada: Date.now(),
    fsrs: tarjeta as unknown as Record<string, unknown>,
    vence: Date.now(),
  });
  return id;
}

const paraOrden = (t: TarjetaMemoria) => t as unknown as TarjetaParaOrden & TarjetaMemoria;
const inicioDeHoy = () => new Date().setHours(0, 0, 0, 0);
const apuntesDeHoy = () => db.repasos.where('fecha').aboveOrEqual(inicioDeHoy()).toArray();

/** Lo que toca ahora: primero lo que ya se aprende, después las nuevas que quedan para hoy. Sin las suspendidas. */
export async function pendientes(limite: number, nuevasDia: number): Promise<TarjetaMemoria[]> {
  const ahora = Date.now();
  const debidas = (await db.memoria.where('vence').belowOrEqual(ahora).toArray()).map(paraOrden);
  return enOrdenDeRepaso(debidas, ahora, nuevasQuedan(nuevasDia, await apuntesDeHoy()), limite);
}

export async function resumen(nuevasDia: number) {
  const ahora = Date.now();
  const total = await db.memoria.count();
  const debidas = (await db.memoria.where('vence').belowOrEqual(ahora).toArray()).map(paraOrden).filter((t) => !t.suspendida);
  const hoy = await apuntesDeHoy();
  const nuevasDebidas = debidas.filter((t) => estadoDe(t) === 'nueva').length;
  const nuevas = Math.min(nuevasQuedan(nuevasDia, hoy), nuevasDebidas);
  return {
    total,
    pendientes: debidas.length - nuevasDebidas + nuevas,
    nuevas,
    nuevasQuedan: nuevas,
    hoy: { repasos: hoy.length, aciertos: hoy.filter((a) => a.nota > 1).length },
  };
}

export async function responder(id: string, nota: 1 | 2 | 3 | 4): Promise<void> {
  const t = await db.memoria.get(id);
  if (!t) return;
  const actual = t.fsrs as unknown as Card;
  const tarjeta: Card = { ...actual, due: new Date(actual.due), last_review: actual.last_review ? new Date(actual.last_review) : undefined };
  const resultado = programador.next(tarjeta, new Date(), nota as Grade);
  await db.transaction('rw', db.memoria, db.repasos, async () => {
    await db.repasos.add({ tarjeta: id, fecha: Date.now(), nota, estadoPrevio: Number(actual.state ?? 0), previo: { fsrs: t.fsrs, vence: t.vence } });
    await db.memoria.update(id, { fsrs: resultado.card as unknown as Record<string, unknown>, vence: new Date(resultado.card.due).getTime() });
  });
}

/** Deshace la última respuesta: la tarjeta vuelve a como estaba y el apunte se borra. Devuelve qué tarjeta era. */
export async function deshacer(): Promise<string | null> {
  const ultimo = await db.repasos.toCollection().last();
  if (!ultimo?.id) return null;
  await db.transaction('rw', db.memoria, db.repasos, async () => {
    if (await db.memoria.get(ultimo.tarjeta)) await db.memoria.update(ultimo.tarjeta, { fsrs: ultimo.previo.fsrs, vence: ultimo.previo.vence });
    await db.repasos.delete(ultimo.id!);
  });
  return ultimo.tarjeta;
}

export const obtener = (id: string) => db.memoria.get(id);

/** Lo que se puede editar a mano. La definición viene del diccionario y se queda como está. */
export async function editar(id: string, cambios: Partial<Pick<BorradorTarjeta, 'palabra' | 'lectura' | 'frase' | 'traduccion' | 'notas'>>): Promise<void> {
  const t = await db.memoria.get(id);
  if (!t) return;
  const borrador = { ...t.borrador, ...cambios };
  await db.memoria.update(id, { borrador, frente: borrador.frase || borrador.palabra });
}

export const suspender = (id: string, si: boolean) => db.memoria.update(id, { suspendida: si });

/** Vuelve a ser nueva: lo aprendido de ella se olvida, pero sus repasos siguen contando en el progreso. */
export async function reiniciar(id: string): Promise<void> {
  await db.memoria.update(id, { fsrs: createEmptyCard(new Date()) as unknown as Record<string, unknown>, vence: Date.now(), suspendida: false });
}

export const listar = () => db.memoria.toArray();

export async function estadisticas() {
  return calcularEstadisticas(await db.repasos.toArray(), (await db.memoria.toArray()).map(paraOrden), Date.now());
}

/** Se borra la tarjeta; sus repasos quedan, porque fueron de verdad y cuentan en el progreso. */
export const eliminar = (id: string) => db.memoria.delete(id);

export { Rating };
