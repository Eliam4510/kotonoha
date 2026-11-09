// El paquete del inglés: lo que el programa necesita saber de esta lengua en cualquier pantalla.

import { idiomaActual, tm } from '../../compartido/i18n';
import type { PaqueteLengua } from '../tipos';
import { contarEscrituras, esTextoIngles, paginaEnIngles, pareceFrase, SIGNOS_FRASE, tieneIngles } from './escritura';
import { dePronunciacion, lecturaVisible, patronAcento } from './pronunciacion';
import { TEXTOS } from './textos';
import { comoSuena, FENOMENOS } from './conectado';
import { nombreFlexion, pegarSignos } from './tokens';

function saludo(hora: number, nombre: string): string {
  const base = hora >= 5 && hora < 12 ? 'Good morning' : hora >= 12 && hora < 18 ? 'Good afternoon' : 'Good evening';
  return nombre ? `${base}, ${nombre}` : base;
}

const VOCES = [
  { id: 'en-US-AndrewMultilingualNeural', nombre: 'Andrew' },
  { id: 'en-US-AvaMultilingualNeural', nombre: 'Ava' },
  { id: 'en-US-BrianNeural', nombre: 'Brian' },
  { id: 'en-US-JennyNeural', nombre: 'Jenny' },
  { id: 'en-GB-RyanNeural', nombre: 'Ryan' },
  { id: 'en-GB-SoniaNeural', nombre: 'Sonia' },
];

export const INGLES: PaqueteLengua = {
  id: 'en',
  bcp47: 'en-US',
  nombrePropio: 'English',
  presentacion: tm('Subtítulos con pronunciación, verbos con partícula y falsos amigos'),
  letra: 'var(--letra)',
  letras: { gotica: "'Segoe UI', 'Helvetica Neue', system-ui, sans-serif", libro: "Charter, 'Iowan Old Style', Georgia, 'Times New Roman', serif" },
  ajustes: {
    nivel: 'CEFR B1',
    formatoLectura: 'us',
    // La pronunciación se consulta en la ficha: sobre cada palabra estorbaría, y el inglés ya se puede leer sin ella.
    furigana: 'ninguna',
    lectorFurigana: 'ninguna',
    // Hay inglés en casi todas las páginas: el lector se enciende cuando se pide.
    lectorActivo: false,
    colorAcento: 'ninguno',
    particulasConocidas: true,
    vocesFrase: ['en-US-AndrewMultilingualNeural', 'en-GB-SoniaNeural'],
    prompts: {},
    ankiMazo: 'Kotonoha English',
  },
  frasesEnLector: true,
  // La palabra misma sirve para buscar imágenes.
  consultaImagen: (lema) => lema,
  escritura: {
    tieneTexto: tieneIngles,
    esDeLaLengua: esTextoIngles,
    contar: contarEscrituras,
    paginaEnLengua: paginaEnIngles,
    frase: SIGNOS_FRASE,
    pareceFrase,
    separadorLista: ', ',
    comillar: (texto) => `“${texto}”`,
    pegarSignos,
    palabrasSeparadas: true,
    portadaVertical: false,
    globos: 'lector',
  },
  lectura: {
    distingue: false,
    formatos: [
      { id: 'us', muestra: 'US' },
      { id: 'uk', muestra: 'UK' },
    ],
    formatoInicial: 'us',
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
  // Vocabulario que suele asociarse a cada nivel del marco europeo. Son cifras orientativas, no oficiales.
  niveles: [
    { valor: 'CEFR A1', nombre: 'A1', ayuda: tm('Saludos y frases muy sencillas'), lectura: 'alPasar', palabras: 500 },
    { valor: 'CEFR A2', nombre: 'A2', ayuda: tm('Conversaciones cotidianas sencillas'), lectura: 'alPasar', palabras: 1000 },
    { valor: 'CEFR B1', nombre: 'B1', ayuda: tm('Entiendo lo esencial si hablan claro'), lectura: 'ninguna', palabras: 2000 },
    { valor: 'CEFR B2', nombre: 'B2', ayuda: tm('Noticias y series, con alguna dificultad'), lectura: 'ninguna', palabras: 4000 },
    { valor: 'CEFR C1', nombre: 'C1', ayuda: tm('Entiendo casi todo, incluso sin subtítulos'), lectura: 'ninguna', palabras: 8000 },
    { valor: 'CEFR C2', nombre: 'C2', ayuda: tm('Como un hablante nativo'), lectura: 'ninguna', palabras: 16000 },
  ],
  nivelInicial: 'CEFR B1',
  nombreNivel: (valor) => valor.replace('CEFR ', ''),
  voces: VOCES,
  vocesIniciales: ['en-US-AndrewMultilingualNeural', 'en-GB-SoniaNeural'],
  enlaces: [
    { nombre: 'Cambridge', url: (p) => `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(p.replace(/ /g, '-'))}` },
    { nombre: "Oxford Learner's", url: (p) => `https://www.oxfordlearnersdictionaries.com/search/english/?q=${encodeURIComponent(p)}` },
    { nombre: 'Merriam-Webster', url: (p) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(p)}` },
    { nombre: 'WordReference', url: (p) => `https://www.wordreference.com/es/translation.asp?tranword=${encodeURIComponent(p)}` },
    { nombre: tm('Wiktionary'), url: (p) => `https://${idiomaActual()}.wiktionary.org/wiki/${encodeURIComponent(p)}` },
    { nombre: 'YouGlish', url: (p) => `https://youglish.com/pronounce/${encodeURIComponent(p)}/english` },
    { nombre: tm('Forvo'), url: (p) => `https://forvo.com/search/${encodeURIComponent(p)}/en/` },
    { nombre: tm('Imágenes'), url: (p) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p)}` },
  ],
  sitiosLectura: [
    { nivel: tm('Principiante'), nombre: 'VOA Learning English', url: 'https://learningenglish.voanews.com/' },
    { nivel: tm('Principiante'), nombre: 'News in Levels', url: 'https://www.newsinlevels.com/' },
    { nivel: tm('Intermedio'), nombre: 'BBC Learning English', url: 'https://www.bbc.co.uk/learningenglish' },
    { nivel: tm('Intermedio'), nombre: 'Simple English Wikipedia', url: 'https://simple.wikipedia.org/' },
    { nivel: tm('Avanzado'), nombre: tm('Wikipedia'), url: 'https://en.wikipedia.org/' },
    { nivel: tm('Avanzado'), nombre: 'The Guardian', url: 'https://www.theguardian.com/' },
  ],
  ejemplos: {
    palabra: 'run',
    lectura: '/rʌn/',
    busqueda: 'went, running, look forward to…',
    sugerencias: ['run', 'look up', 'breakthrough', 'serendipity'],
    pegarTexto: 'Paste some English text here',
    escribir: 'Write here',
    lista: 'cat, dog, running…',
    // El principio de Alicia en el país de las maravillas, de 1865: de dominio público.
    texto: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.\n"And what is the use of a book," thought Alice, "without pictures or conversations?"',
    letra: 'A',
  },
  saludo,
  textos: TEXTOS,
  comoSuena: { analizar: comoSuena, fenomenos: FENOMENOS },
  ideasRelato: [tm('Un gato que pasea por Londres'), tm('Una tarde de lluvia en el tren'), tm('La feria de verano del pueblo')],
};
