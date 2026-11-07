// Colores de los estados de una palabra y del acento. Hay quien no distingue bien el rojo del verde, o necesita más contraste.

export type IdPaleta = 'predeterminada' | 'daltonismo' | 'contraste';

export interface Paleta {
  desconocida: string;
  aprendiendo: string;
  rastreada: string;
  heiban: string;
  atamadaka: string;
  nakadaka: string;
  odaka: string;
}

const PALETAS: Record<IdPaleta, { oscuro: Paleta; claro: Paleta }> = {
  predeterminada: {
    oscuro: { desconocida: '#FF9166', aprendiendo: '#F7CB52', rastreada: '#BCA9FF', heiban: '#8FCBFF', atamadaka: '#FF9393', nakadaka: '#D6ABFF', odaka: '#7FE6B3' },
    claro: { desconocida: '#E8622E', aprendiendo: '#C99400', rastreada: '#6E52D9', heiban: '#1B74CC', atamadaka: '#D5383A', nakadaka: '#8847CC', odaka: '#129360' },
  },
  // Okabe e Ito: se distingue con los tipos más comunes de daltonismo.
  daltonismo: {
    oscuro: { desconocida: '#E69F00', aprendiendo: '#56B4E9', rastreada: '#CC79A7', heiban: '#56B4E9', atamadaka: '#E69F00', nakadaka: '#CC79A7', odaka: '#F0E442' },
    claro: { desconocida: '#B35900', aprendiendo: '#0072B2', rastreada: '#A23D7D', heiban: '#0072B2', atamadaka: '#B35900', nakadaka: '#A23D7D', odaka: '#6E6A00' },
  },
  contraste: {
    oscuro: { desconocida: '#FF7A3D', aprendiendo: '#FFE14D', rastreada: '#D3C2FF', heiban: '#A8DAFF', atamadaka: '#FFB3B3', nakadaka: '#E6C8FF', odaka: '#A0F5C8' },
    claro: { desconocida: '#B83A00', aprendiendo: '#7A5A00', rastreada: '#4A2FB5', heiban: '#0B4F91', atamadaka: '#A81E20', nakadaka: '#642A9E', odaka: '#086B44' },
  },
};

export const paletaDe = (id: IdPaleta | undefined, oscuro: boolean): Paleta => PALETAS[id ?? 'predeterminada'][oscuro ? 'oscuro' : 'claro'];

/** Variables CSS de una paleta, para la interfaz. La predeterminada no cambia nada: la llevan ya los estilos. */
export function variablesPaleta(id: IdPaleta | undefined, oscuro: boolean): Record<string, string> {
  if (!id || id === 'predeterminada') return {};
  const p = paletaDe(id, oscuro);
  return {
    '--est-desconocida': p.desconocida,
    '--est-aprendiendo': p.aprendiendo,
    '--est-rastreada': p.rastreada,
    '--ac-heiban': p.heiban,
    '--ac-atamadaka': p.atamadaka,
    '--ac-nakadaka': p.nakadaka,
    '--ac-odaka': p.odaka,
  };
}
