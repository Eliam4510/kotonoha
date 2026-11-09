// El paquete del alemán: lo que el programa necesita saber de esta lengua en cualquier pantalla.

import { idiomaActual, tm } from '../../compartido/i18n';
import type { PaqueteLengua } from '../tipos';
import { contarEscrituras, esTextoAleman, paginaEnAleman, pareceFrase, SIGNOS_FRASE, tieneAleman } from './escritura';
import { dePronunciacion, lecturaVisible, patronAcento } from './pronunciacion';
import { TEXTOS } from './textos';
import { nombreFlexion, pegarSignos } from './tokens';

function saludo(hora: number, nombre: string): string {
  const base = hora >= 5 && hora < 11 ? 'Guten Morgen' : hora >= 11 && hora < 18 ? 'Guten Tag' : 'Guten Abend';
  return nombre ? `${base}, ${nombre}` : base;
}

const VOCES = [
  { id: 'de-DE-SeraphinaMultilingualNeural', nombre: 'Seraphina' },
  { id: 'de-DE-FlorianMultilingualNeural', nombre: 'Florian' },
  { id: 'de-DE-KatjaNeural', nombre: 'Katja' },
  { id: 'de-DE-ConradNeural', nombre: 'Conrad' },
  { id: 'de-AT-IngridNeural', nombre: 'Ingrid' },
  { id: 'de-CH-LeniNeural', nombre: 'Leni' },
];

export const ALEMAN: PaqueteLengua = {
  id: 'de',
  bcp47: 'de-DE',
  nombrePropio: 'Deutsch',
  presentacion: tm('Subtítulos con pronunciación, verbos separables y falsos amigos'),
  letra: 'var(--letra)',
  ajustes: {
    nivel: 'CEFR A2',
    formatoLectura: 'de',
    // La pronunciación se consulta en la ficha: sobre cada palabra estorbaría, y el alemán se lee como se escribe.
    furigana: 'ninguna',
    lectorFurigana: 'ninguna',
    // Hay palabras alemanas en muchas páginas que no lo son: el lector se enciende cuando se pide.
    lectorActivo: false,
    colorAcento: 'ninguno',
    particulasConocidas: true,
    vocesFrase: ['de-DE-SeraphinaMultilingualNeural', 'de-DE-FlorianMultilingualNeural'],
    prompts: {},
    ankiMazo: 'Kotonoha Deutsch',
  },
  frasesEnLector: true,
  // La palabra misma sirve para buscar imágenes.
  consultaImagen: (lema) => lema,
  escritura: {
    tieneTexto: tieneAleman,
    esDeLaLengua: esTextoAleman,
    contar: contarEscrituras,
    paginaEnLengua: paginaEnAleman,
    frase: SIGNOS_FRASE,
    pareceFrase,
    separadorLista: ', ',
    comillar: (texto) => `„${texto}“`,
    pegarSignos,
    palabrasSeparadas: true,
    portadaVertical: false,
    globos: 'lector',
  },
  lectura: {
    distingue: false,
    formatos: [{ id: 'de', muestra: 'DE' }],
    formatoInicial: 'de',
    visible: lecturaVisible,
    segmentar: (superficie) => [{ texto: superficie }],
    normalizar: (lectura) => lectura,
    esSoloLectura: () => false,
    anchoCaracter: () => 0.55,
    dePronunciacion,
  },
  acento: {
    patron: patronAcento,
    leyenda: [
      { clase: 'atamadaka', nombre: tm('Primera sílaba') },
      { clase: 'nakadaka', nombre: tm('En medio') },
      { clase: 'odaka', nombre: tm('Última sílaba') },
    ],
  },
  nombreFlexion,
  principiante: { valor: 'principiante absoluto', nombre: tm('Empiezo desde cero'), ayuda: tm('Aún no entiendo casi nada'), lectura: 'alPasar' },
  // Vocabulario que suele asociarse a cada nivel del marco europeo, el de los exámenes del Goethe-Institut. Son cifras
  // orientativas, no oficiales.
  niveles: [
    { valor: 'CEFR A1', nombre: 'A1', ayuda: tm('Saludos y frases muy sencillas'), lectura: 'alPasar', palabras: 650 },
    { valor: 'CEFR A2', nombre: 'A2', ayuda: tm('Conversaciones cotidianas sencillas'), lectura: 'alPasar', palabras: 1300 },
    { valor: 'CEFR B1', nombre: 'B1', ayuda: tm('Entiendo lo esencial si hablan claro'), lectura: 'ninguna', palabras: 2400 },
    { valor: 'CEFR B2', nombre: 'B2', ayuda: tm('Noticias y series, con alguna dificultad'), lectura: 'ninguna', palabras: 4500 },
    { valor: 'CEFR C1', nombre: 'C1', ayuda: tm('Entiendo casi todo, incluso sin subtítulos'), lectura: 'ninguna', palabras: 9000 },
    { valor: 'CEFR C2', nombre: 'C2', ayuda: tm('Como un hablante nativo'), lectura: 'ninguna', palabras: 18000 },
  ],
  nivelInicial: 'CEFR A2',
  nombreNivel: (valor) => valor.replace('CEFR ', ''),
  voces: VOCES,
  vocesIniciales: ['de-DE-SeraphinaMultilingualNeural', 'de-DE-FlorianMultilingualNeural'],
  enlaces: [
    { nombre: 'Duden', url: (p) => `https://www.duden.de/suchen/dudenonline/${encodeURIComponent(p)}` },
    { nombre: 'DWDS', url: (p) => `https://www.dwds.de/wb/${encodeURIComponent(p)}` },
    { nombre: 'PONS', url: (p) => `https://de.pons.com/übersetzung/deutsch-spanisch/${encodeURIComponent(p)}` },
    { nombre: 'LEO', url: (p) => `https://dict.leo.org/spanisch-deutsch/${encodeURIComponent(p)}` },
    { nombre: 'WordReference', url: (p) => `https://www.wordreference.com/des/${encodeURIComponent(p)}` },
    { nombre: tm('Wiktionary'), url: (p) => `https://${idiomaActual()}.wiktionary.org/wiki/${encodeURIComponent(p)}` },
    { nombre: 'YouGlish', url: (p) => `https://youglish.com/pronounce/${encodeURIComponent(p)}/german` },
    { nombre: tm('Forvo'), url: (p) => `https://forvo.com/search/${encodeURIComponent(p)}/de/` },
    { nombre: tm('Imágenes'), url: (p) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p)}` },
  ],
  sitiosLectura: [
    { nivel: tm('Principiante'), nombre: 'nachrichtenleicht', url: 'https://www.nachrichtenleicht.de/' },
    { nivel: tm('Principiante'), nombre: 'Klexikon', url: 'https://klexikon.zum.de/' },
    { nivel: tm('Intermedio'), nombre: 'DW Deutsch lernen', url: 'https://learngerman.dw.com/' },
    { nivel: tm('Intermedio'), nombre: 'logo!', url: 'https://www.zdf.de/kinder/logo' },
    { nivel: tm('Avanzado'), nombre: tm('Wikipedia'), url: 'https://de.wikipedia.org/' },
    { nivel: tm('Avanzado'), nombre: 'tagesschau', url: 'https://www.tagesschau.de/' },
  ],
  ejemplos: {
    palabra: 'gehen',
    lectura: '/ˈɡeːən/',
    busqueda: 'ging, Häuser, anfangen…',
    sugerencias: ['gehen', 'anfangen', 'Fernweh', 'gemütlich'],
    pegarTexto: 'Füge hier einen deutschen Text ein',
    escribir: 'Hier schreiben',
    lista: 'Katze, Hund, gehen…',
    // El principio de El rey rana, de los hermanos Grimm, de 1812: de dominio público.
    texto: 'In den alten Zeiten, wo das Wünschen noch geholfen hat, lebte ein König, dessen Töchter waren alle schön, aber die jüngste war so schön, dass die Sonne selber, die doch so vieles gesehen hat, sich verwunderte, sooft sie ihr ins Gesicht schien.\nNahe bei dem Schlosse des Königs lag ein großer dunkler Wald.',
    letra: 'Ä',
  },
  saludo,
  textos: TEXTOS,
  ideasRelato: [tm('Un gato que pasea por Berlín'), tm('Una tarde de lluvia en el tren'), tm('El mercado navideño del pueblo')],
};
