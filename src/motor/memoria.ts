// Memoria: repaso espaciado propio con FSRS, para quien no quiera usar Anki.

import { createEmptyCard, type Card, fsrs, type Grade, Rating } from 'ts-fsrs';
import type { BorradorTarjeta, TarjetaMemoria } from '../compartido/tipos';
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

export async function pendientes(limite: number): Promise<TarjetaMemoria[]> {
  return db.memoria.where('vence').belowOrEqual(Date.now()).limit(limite).toArray();
}

export async function resumen() {
  const total = await db.memoria.count();
  const debidas = await db.memoria.where('vence').belowOrEqual(Date.now()).toArray();
  const nuevas = debidas.filter((t) => (t.fsrs as { reps?: number }).reps === 0).length;
  return { total, pendientes: debidas.length, nuevas };
}

export async function responder(id: string, nota: 1 | 2 | 3 | 4): Promise<void> {
  const t = await db.memoria.get(id);
  if (!t) return;
  const actual = t.fsrs as unknown as Card;
  const tarjeta: Card = { ...actual, due: new Date(actual.due), last_review: actual.last_review ? new Date(actual.last_review) : undefined };
  const resultado = programador.next(tarjeta, new Date(), nota as Grade);
  await db.memoria.update(id, {
    fsrs: resultado.card as unknown as Record<string, unknown>,
    vence: new Date(resultado.card.due).getTime(),
  });
}

export const eliminar = (id: string) => db.memoria.delete(id);

export { Rating };
