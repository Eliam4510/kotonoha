// Reparto del trabajo que se manda a Claude. Se empieza por lo que estás viendo: así la parte que
// importa ya está lista en segundos, aunque el video entero tarde más.

export interface Lote {
  desde: number;
  hasta: number;
}

export function partirEnLotes(total: number, tam: number): Lote[] {
  const lotes: Lote[] = [];
  for (let i = 0; i < total; i += tam) lotes.push({ desde: i, hasta: Math.min(i + tam, total) });
  return lotes;
}

/** Primero el lote donde vas y los siguientes; después los anteriores, del más cercano al más lejano. */
export function ordenarPorCercania(lotes: Lote[], indice: number): Lote[] {
  if (indice < 0) return lotes;
  const actual = lotes.findIndex((l) => indice >= l.desde && indice < l.hasta);
  if (actual < 0) return lotes;
  return [...lotes.slice(actual), ...lotes.slice(0, actual).reverse()];
}
