// Punto de entrada del motor: vive en un documento offscreen para no detenerse a mitad de una tarea.

import { type Ajustes, completarAjustes, modeloParaTranscribir, type ModeloWhisper } from '../compartido/ajustes';
import type { ApiMotor, CambioPalabra, FiltroPalabras } from '../compartido/api';
import { atender, atenderFlujos, flujosActivos, fondo } from '../compartido/rpc';
import type { BorradorTarjeta, ContextoIA, ElementoBiblioteca, FilaPalabra } from '../compartido/tipos';
import { textoConEstructura } from '../nucleo/estructura';
import { renderizadoPorSoftware } from '../nucleo/medios';
import type { Linea } from '../nucleo/subtitulos';
import * as analisis from './analisis';
import * as anki from './anki';
import { consultarAyudante } from './ayudante';
import { baseDe, baseGeneral, db, existeBaseDe, type FilaFrecuencia } from './db';
import * as dics from './diccionarios';
import * as grabacion from './grabacion';
import * as ia from './ia';
import { fijarLengua, lengua, motorLengua } from './lengua';
import { rellenar } from './prompts';
import { PAQUETES, paqueteDe } from '../lenguas';
import * as medios from './medios';
import * as memoria from './memoria';
import * as whisper from './whisper';
import { fijarIdioma, tr } from '../compartido/i18n';
import { trazosDe } from './trazos';

let ajustes: Ajustes = completarAjustes(undefined);

async function refrescarAjustes(): Promise<Ajustes> {
  ajustes = completarAjustes((await fondo.ajustesCompletos()) as Partial<Ajustes>);
  anki.fijarPuerto(ajustes.ankiPuerto);
  await fijarIdioma(ajustes.idiomaInterfaz);
  if (fijarLengua(ajustes.idiomaObjetivo)) alCambiarLengua();
  return ajustes;
}

/** Los ajustes viven en chrome.storage, que un documento offscreen no puede leer: se piden al fondo. */
async function aj(): Promise<Ajustes> {
  try {
    return await refrescarAjustes();
  } catch {
    return ajustes;
  }
}

/** Lo que había en memoria era de la lengua anterior. Lo guardado está cada uno en su base. */
function alCambiarLengua() {
  analisis.olvidarLengua();
  analisis.cargarAnalizador().catch((e) => console.error('Analizador:', e));
  analisis.recargarTerminos().catch((e) => console.error('Términos:', e));
  repararDiccionarios().catch((e) => console.warn('Diccionarios:', e));
  ia.limpiarCache().catch(() => {});
}

async function arrancar() {
  const clave = await fondo.claveIA().catch(() => null);
  const urlBase = await fondo.urlBaseIA().catch(() => undefined);
  if (clave) ia.fijarClave(clave, urlBase ?? undefined);
  await aj();
  analisis.cargarAnalizador().catch((e) => console.error('Analizador:', e));
  analisis.recargarTerminos().catch((e) => console.error('Términos:', e));
  repararDiccionarios().catch((e) => console.warn('Diccionarios:', e));
  ia.limpiarCache().catch(() => {});
}

/**
 * La base de la lengua que dice quien pide algo de un video. Al cambiar de lengua, la página se entera por los ajustes y
 * el motor por un aviso aparte: si la página pregunta antes de que llegue, el motor aún tiene la base de la anterior.
 */
const baseDeEstudio = (estudio: string | undefined) => (estudio ? baseDe(paqueteDe(estudio).id) : db);

const ESPERA_REPARACION_MS = 120000;

/** Si una versión anterior dejó mal un diccionario, se vuelve a instalar solo en segundo plano. */
async function repararDiccionarios() {
  const danados = (await motorLengua().diccionariosPorReparar?.(db)) ?? [];
  if (!danados.length) return;
  // Reinstalar ocupa al motor un buen rato: primero se atiende lo que estés viendo.
  await new Promise((r) => setTimeout(r, ESPERA_REPARACION_MS));
  for (const id of danados) await dics.instalarDesdeBiblioteca(id);
  await analisis.recargarTerminos();
  await fondo.difundir({ tipo: 'diccionarios' });
}

/** Lo que una copia de seguridad guarda de cada lengua. */
interface DatosDeLengua {
  palabras?: never[];
  biblioteca?: never[];
  memoria?: never[];
  generados?: never[];
  correcciones?: never[];
}

let sinGpu: boolean | null = null;

const api: ApiMotor = {
  async fijarLengua(id) {
    if (fijarLengua(id)) alCambiarLengua();
  },
  // No cambia sin reiniciar el navegador: basta con mirarlo una vez.
  async sinAceleracion() {
    if (sinGpu === null) {
      const gl = document.createElement('canvas').getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      sinGpu = !gl || renderizadoPorSoftware(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    return sinGpu;
  },
  async estado() {
    return {
      tokenizadorListo: analisis.analizadorListo(),
      diccionarios: await dics.listaDiccionarios(),
      terminosCargados: analisis.totalTerminos(),
      claveIA: ia.hayClave(),
      capturaActiva: grabacion.capturaActiva(),
    };
  },
  async fijarClaveIA(clave, urlBase) {
    ia.fijarClave(clave, urlBase);
  },
  async probarIA() {
    return ia.probarConexion(await aj());
  },

  async analizarLineas(lineas, fuente) {
    return analisis.analizarLineas(lineas, await aj(), fuente);
  },
  async analizarTexto(texto) {
    return analisis.analizarTexto(texto, await aj());
  },

  buscar: (lema, lectura) => analisis.buscar(lema, lectura),
  trazos: (caracter) => trazosDe(caracter),
  async leerPortapapeles() {
    // El evento de pegar trae todas las versiones de lo copiado, y la de HTML conserva títulos, listas y tablas. Se lee
    // del evento sin pegar nada: así ninguna imagen de la página de origen llega a cargarse aquí.
    let html = '';
    let texto: string | null = null;
    const zona = document.createElement('div');
    zona.contentEditable = 'true';
    zona.addEventListener('paste', (e) => {
      e.preventDefault();
      html = e.clipboardData?.getData('text/html') ?? '';
      texto = e.clipboardData?.getData('text/plain') ?? '';
    });
    document.body.appendChild(zona);
    zona.focus();
    document.execCommand('paste');
    zona.remove();
    if (texto === null) {
      // Sin evento, el camino de siempre: solo el texto.
      const area = document.createElement('textarea');
      document.body.appendChild(area);
      area.focus();
      document.execCommand('paste');
      texto = area.value;
      area.remove();
    }
    return textoConEstructura(html, texto);
  },
  async buscarLibre(texto) {
    return analisis.buscarLibre(texto, await aj());
  },
  compuestos: (palabras) => analisis.compuestos(palabras),
  ejemplos: (lema) => analisis.ejemplos(lema),

  async cambiarPalabras(cambios: CambioPalabra[]) {
    const ahora = Date.now();
    await db.transaction('rw', db.palabras, async () => {
      for (const c of cambios) {
        const actual = await db.palabras.get(c.clave);
        const estado = c.estado ?? actual?.estado ?? 'desconocida';
        const rastreada = c.rastreada ?? actual?.rastreada === 1;
        if (estado === 'desconocida' && !rastreada) {
          await db.palabras.delete(c.clave);
        } else {
          await db.palabras.put({
            clave: c.clave,
            lema: c.lema,
            lectura: c.lectura,
            estado,
            rastreada: rastreada ? 1 : 0,
            creada: actual?.creada ?? ahora,
            actualizada: ahora,
          });
        }
      }
    });
    await fondo.difundir({ tipo: 'palabras', cambios });
  },

  async anadirConocidas(texto) {
    const a = await aj();
    const lineas = await analisis.analizarTexto(texto, a);
    const unicas = new Map<string, { lema: string; lectura: string }>();
    for (const l of lineas) for (const p of l) if (p.esPalabra) unicas.set(p.clave, { lema: p.lema, lectura: p.lecturaLema });
    const ahora = Date.now();
    await db.palabras.bulkPut(
      [...unicas].map(([clave, v]) => ({ clave, lema: v.lema, lectura: v.lectura, estado: 'conocida' as const, rastreada: 0 as const, creada: ahora, actualizada: ahora }))
    );
    await fondo.difundir({ tipo: 'palabrasRecargar' });
    return unicas.size;
  },

  async estadisticasPalabras() {
    const [conocidas, aprendiendo, ignoradas, rastreadas] = await Promise.all([
      db.palabras.where('estado').equals('conocida').count(),
      db.palabras.where('estado').equals('aprendiendo').count(),
      db.palabras.where('estado').equals('ignorada').count(),
      db.palabras.where('rastreada').equals(1).count(),
    ]);
    return { conocidas, aprendiendo, ignoradas, rastreadas };
  },

  async listarPalabras(f: FiltroPalabras) {
    let filas = await db.palabras.toArray();
    if (f.estado && f.estado !== 'todas') filas = filas.filter((x) => x.estado === f.estado);
    if (f.rastreada) filas = filas.filter((x) => x.rastreada === 1);
    if (f.busqueda) filas = filas.filter((x) => x.lema.includes(f.busqueda!) || x.lectura.includes(f.busqueda!));
    const lista = await dics.listaDiccionarios();
    const dicFrec = lista.find((d) => d.tipo === 'frecuencia')?.id;
    const conRango: FilaPalabra[] = filas.map((x) => ({ clave: x.clave, lema: x.lema, lectura: x.lectura, estado: x.estado, rastreada: x.rastreada === 1, actualizada: x.actualizada }));
    if (f.orden === 'alfabetico') conRango.sort((a, b) => a.lectura.localeCompare(b.lectura, lengua().id));
    else if (f.orden !== 'frecuencia') conRango.sort((a, b) => b.actualizada - a.actualizada);
    const total = conRango.length;
    const pagina = f.orden === 'frecuencia' ? conRango : conRango.slice(f.desde ?? 0, (f.desde ?? 0) + (f.limite ?? 200));
    if (dicFrec) {
      const rangos = await db.frecuencias.bulkGet(pagina.map((x) => [dicFrec, x.lema, x.lectura] as [string, string, string]));
      pagina.forEach((x, i) => (x.rango = rangos[i]?.rango));
    }
    if (f.orden === 'frecuencia') {
      pagina.sort((a, b) => (a.rango ?? 1e9) - (b.rango ?? 1e9));
      return { filas: pagina.slice(f.desde ?? 0, (f.desde ?? 0) + (f.limite ?? 200)), total };
    }
    return { filas: pagina, total };
  },

  async muestraEvaluacion() {
    const dicFrec = (await dics.listaDiccionarios()).find((d) => d.tipo === 'frecuencia')?.id;
    if (!dicFrec) throw new Error(tr('Instala primero la lista de frecuencia.'));
    const salida: { lema: string; lectura: string; rango: number }[] = [];
    // Una lista de frecuencia también trae nombres propios y ruido: se pregunta solo lo que está en los diccionarios.
    const terminos = await analisis.listaTerminos();
    const total = await db.frecuencias.where('dic').equals(dicFrec).count();
    // Muestra por bandas de frecuencia, para estimar hasta dónde llega tu vocabulario.
    for (const rango of [200, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 40000]) {
      const enLaBanda = (f: FilaFrecuencia) => f.rango >= rango && f.rango < rango * 1.15 && !!f.lectura && (!terminos.size || terminos.has(f.termino));
      const dic = () => db.frecuencias.where('dic').equals(dicFrec);
      // Las filas van por orden alfabético: se empieza en un punto al azar para no preguntar solo por lo que empieza por a.
      let filas = await dic().offset(Math.floor(Math.random() * total)).filter(enLaBanda).limit(6).toArray();
      if (!filas.length) filas = await dic().filter(enLaBanda).limit(6).toArray();
      if (filas.length) {
        const f = filas[Math.floor(Math.random() * filas.length)];
        salida.push({ lema: f.termino, lectura: f.lectura, rango: f.rango });
      }
    }
    return salida;
  },

  async aplicarEvaluacion(rangoEstimado) {
    const dicFrec = (await dics.listaDiccionarios()).find((d) => d.tipo === 'frecuencia')?.id;
    if (!dicFrec) return 0;
    const filas = await db.frecuencias.where('dic').equals(dicFrec).filter((f) => f.rango <= rangoEstimado && !!f.lectura).toArray();
    const ahora = Date.now();
    const nuevas = filas.map((f) => ({
      clave: analisis.claveDe(f.termino, f.lectura),
      lema: f.termino,
      lectura: f.lectura,
      estado: 'conocida' as const,
      rastreada: 0 as const,
      creada: ahora,
      actualizada: ahora,
    }));
    for (let i = 0; i < nuevas.length; i += 4000) await db.palabras.bulkPut(nuevas.slice(i, i + 4000));
    await fondo.difundir({ tipo: 'palabrasRecargar' });
    return nuevas.length;
  },

  async importarConocidasAnki(consulta, campo) {
    await aj();
    const filas = await anki.palabrasDeAnki(consulta, campo);
    const a = await aj();
    let n = 0;
    const ahora = Date.now();
    for (let i = 0; i < filas.length; i += 200) {
      const lote = filas.slice(i, i + 200);
      const tokens = await analisis.analizarTexto(lote.map((x) => x.texto).join('\n'), a);
      const nuevas = tokens.flatMap((l, k) =>
        l.filter((p) => p.esPalabra && !p.esGramatica).map((p) => ({
          clave: p.clave,
          lema: p.lema,
          lectura: p.lecturaLema,
          estado: lote[k]?.conocida ? ('conocida' as const) : ('aprendiendo' as const),
          rastreada: 0 as const,
          creada: ahora,
          actualizada: ahora,
        }))
      );
      await db.palabras.bulkPut(nuevas);
      n += nuevas.length;
    }
    await fondo.difundir({ tipo: 'palabrasRecargar' });
    return n;
  },

  fuentesDiccionario: async () => motorLengua().diccionarios,
  async instalarDiccionario(id) {
    await dics.instalarDesdeBiblioteca(id);
    await analisis.recargarTerminos();
    await fondo.difundir({ tipo: 'diccionarios' });
  },
  async instalarArchivo(url, nombre) {
    await dics.instalarDesdeArchivo(url, nombre);
    await analisis.recargarTerminos();
    await fondo.difundir({ tipo: 'diccionarios' });
  },
  async eliminarDiccionario(id) {
    await dics.eliminarDiccionario(id);
    await analisis.recargarTerminos();
    await fondo.difundir({ tipo: 'diccionarios' });
  },
  async ordenarDiccionarios(ids) {
    await dics.ordenarDiccionarios(ids);
    await fondo.difundir({ tipo: 'diccionarios' });
  },

  async anki() {
    await aj();
    return anki.estado();
  },
  async ankiPermiso() {
    await aj();
    return anki.pedirPermiso();
  },
  async ankiCamposModelo(modelo) {
    await aj();
    return anki.camposModelo(modelo);
  },
  async ankiCrearModeloPropio() {
    await aj();
    await anki.crearModeloPropio();
  },
  async ankiTieneTarjeta(p) {
    await aj();
    return anki.tieneTarjeta(p);
  },
  async ankiVerTarjeta(p) {
    await aj();
    await anki.verTarjeta(p);
  },

  async crearTarjeta(b: BorradorTarjeta, destino) {
    const a = await aj();
    if ((destino ?? a.destino) === 'memoria') return memoria.crearTarjetaMemoria(b);
    return anki.crearNota(a, b);
  },

  iniciarCaptura: (id) => grabacion.iniciarCaptura(id),
  detenerCaptura: () => grabacion.detenerCaptura(),
  empezarClip: () => grabacion.empezarClip(),
  terminarClip: () => grabacion.terminarClip(),
  recortarImagen: (u, r) => grabacion.recortarImagen(u, r),

  audiosPalabra: (l, r) => motorLengua().audios(l, r),
  async vozFrase(t, v) {
    return medios.vozAzure(await aj(), t, v);
  },
  descargarMedio: (u) => medios.descargarMedio(u),
  imagenes: (c) => medios.buscarImagenes(c),
  async consultaImagen(l, f) {
    return ia.consultaImagen(await aj(), l, f);
  },
  async generarFraseEjemplo(l) {
    return ia.generarFrase(await aj(), l);
  },
  async traducirBreve(t) {
    return ia.traducirBreve(await aj(), t);
  },
  async glosaBreve(l, f) {
    return ia.glosaBreve(await aj(), l, f);
  },
  async sentidoGuardado(c, definiciones) {
    return ia.sentidoGuardado(await aj(), c, definiciones);
  },
  async consumo(desde) {
    return baseGeneral.consumo.where('t').aboveOrEqual(desde).toArray();
  },
  async sentidoEnContexto(c, definiciones, recargar) {
    return ia.sentidoEnContexto(await aj(), c, definiciones, recargar);
  },
  async revisarLectura(c, texto) {
    const r = await ia.revisarLectura(await aj(), c);
    await guardarCorreccion(texto, { superficie: c.superficie ?? c.lema ?? '', ...r });
    return r;
  },
  async corregirLectura(texto, c) {
    await guardarCorreccion(texto, c);
  },

  async whisperMarca(ms, reproduciendo, velocidad, salto) {
    whisper.marcarVideo(ms, reproduciendo, velocidad, salto);
  },
  ayudante: () => consultarAyudante(),
  flujosActivos: async () => flujosActivos(),
  async whisperDetener() {
    whisper.detenerEnVivo();
  },
  async whisperPausar(pausado) {
    whisper.pausar(pausado);
  },
  async whisperOcupacionPrueba(ocupacion) {
    if (!(await fondo.urlBaseIA())) throw new Error('Solo disponible en las pruebas');
    whisper.fijarOcupacionPrueba(ocupacion);
  },
  async whisperPerderGpuPrueba() {
    if (!(await fondo.urlBaseIA())) throw new Error('Solo disponible en las pruebas');
    whisper.perderGpuPrueba();
  },
  async whisperCapturaPrueba() {
    if (!(await fondo.urlBaseIA())) throw new Error('Solo disponible en las pruebas');
    await grabacion.iniciarCapturaPrueba();
  },

  bibliotecaListar: () => db.biblioteca.orderBy('creado').reverse().toArray(),
  async bibliotecaGuardar(e: ElementoBiblioteca) {
    await db.biblioteca.put(e);
  },
  async bibliotecaEliminar(id) {
    await db.biblioteca.delete(id);
  },
  bibliotecaObtener: (id) => db.biblioteca.get(id),

  memoriaPendientes: (n) => memoria.pendientes(n),
  memoriaResumen: () => memoria.resumen(),
  memoriaResponder: (id, nota) => memoria.responder(id, nota),
  async memoriaEliminar(id) {
    await memoria.eliminar(id);
  },

  async exportarDatos(ajustes) {
    // Quien hace una copia espera poder recuperarlo todo, no solo la lengua que estudia esta semana.
    const lenguas: Record<string, unknown> = {};
    for (const { id } of PAQUETES) {
      if (!(await existeBaseDe(id))) continue;
      const base = baseDe(id);
      lenguas[id] = {
        palabras: await base.palabras.toArray(),
        biblioteca: await base.biblioteca.toArray(),
        memoria: await base.memoria.toArray(),
        // Subtítulos importados, recordados y generados: traducirlos otra vez costaría API.
        generados: await base.generados.toArray(),
        correcciones: await base.correcciones.toArray(),
      };
    }
    return JSON.stringify({ version: 2, ajustes, lenguas, consumo: await baseGeneral.consumo.toArray() });
  },
  async importarDatos(json) {
    const d = JSON.parse(json) as DatosDeLengua & { lengua?: string; lenguas?: Record<string, DatosDeLengua>; consumo?: never[]; ajustes?: Partial<Ajustes> };
    // Las copias de antes de haber más lenguas no dicen de cuál son: todas eran de japonés.
    const lenguas = d.lenguas ?? { [d.lengua ?? 'ja']: d };
    for (const [id, datos] of Object.entries(lenguas)) {
      const base = baseDe(paqueteDe(id).id);
      if (datos.palabras) await base.palabras.bulkPut(datos.palabras);
      if (datos.biblioteca) await base.biblioteca.bulkPut(datos.biblioteca);
      if (datos.memoria) await base.memoria.bulkPut(datos.memoria);
      if (datos.generados) await base.generados.bulkPut(datos.generados);
      if (datos.correcciones) await base.correcciones.bulkPut(datos.correcciones);
    }
    if (d.consumo) await baseGeneral.consumo.bulkPut(d.consumo);
    await fondo.difundir({ tipo: 'palabrasRecargar' });
    return d.ajustes ?? null;
  },
  async guardarSubtitulosGenerados(idVideo, idioma, lineas: Linea[], origen, estudio) {
    // La letra no sustituye a la transcripción de la que salieron sus tiempos: con otra letra se volverá a necesitar.
    const clave = origen === 'letra' ? `${idVideo}|${idioma}|letra` : `${idVideo}|${idioma}`;
    await baseDeEstudio(estudio).generados.put({ clave, idVideo, idioma, lineas, origen, creado: Date.now() });
  },
  correccionesPista: (clave, estudio) => baseDeEstudio(estudio).correcciones.get(clave),
  async guardarCorreccionesPista(clave, cambios, completa, estudio) {
    await baseDeEstudio(estudio).correcciones.put({ clave, cambios, completa, creado: Date.now() });
  },
  async subtitulosGenerados(idVideo, estudio) {
    return baseDeEstudio(estudio).generados.where('idVideo').equals(idVideo).toArray();
  },
};

async function guardarCorreccion(texto: string, c: { superficie: string; lectura: string; lema?: string; lectura_lema?: string }) {
  const clave = analisis.claveLinea(texto);
  const previa = await db.analisis.get(clave);
  const correccion = { superficie: c.superficie, lectura: c.lectura, lema: c.lema, lectura_lema: c.lectura_lema };
  await db.analisis.put({
    clave,
    lecturas: [...(previa?.lecturas ?? []).filter((x) => x.superficie !== c.superficie), correccion],
    sentidos: previa?.sentidos ?? [],
    gramatica: previa?.gramatica ?? [],
    creado: Date.now(),
  });
}

atender('motor', api);

atenderFlujos({
  explicar: async (emitir, senal, c: ContextoIA, profundo: boolean, recargar: boolean) => ia.flujos.explicar(await aj(), c, recargar, profundo, emitir, senal),
  gramatica: async (emitir, senal, c: ContextoIA, recargar: boolean) => ia.flujos.gramatica(await aj(), c, recargar, emitir, senal),
  desglosar: async (emitir, senal, c: ContextoIA, recargar: boolean) => ia.flujos.desglosar(await aj(), c, recargar, emitir, senal),
  traducir: async (emitir, senal, c: ContextoIA, recargar: boolean) => ia.flujos.traducir(await aj(), c, recargar, emitir, senal),
  preguntar: async (emitir, senal, c: ContextoIA, pregunta: string) => ia.flujos.preguntar(await aj(), c, pregunta, emitir, senal),
  historia: async (emitir, senal, tema: string, palabras: string) => ia.flujos.historia(await aj(), tema, palabras, emitir, senal),
  // Los subtítulos emiten el avance como texto y devuelven el resultado final en JSON.
  // Traducción en cualquier dirección: cada lote llega como una línea de JSON, empezando por lo que estás viendo.
  traducirSubtitulos: async (emitir, senal, lineas: Linea[], titulo?: string, indice = -1, destino?: 'lengua') => {
    const a = await aj();
    const { aLengua, subtitulos } = motorLengua().prompts;
    const sistema = destino === 'lengua' ? aLengua : rellenar(subtitulos, a, { idioma: a.idiomaTraduccion });
    await ia.traducirSubtitulos(a, lineas, titulo, sistema, indice, (parte, hechas, total) => emitir(`${JSON.stringify({ hechas, total, parte })}\n`), senal);
    return 'ok';
  },
  corregirSubtitulos: async (emitir, senal, lineas: Linea[], titulo?: string, indice = -1, guion?: string) => {
    const a = await aj();
    await ia.corregirSubtitulos(a, lineas, titulo, indice, guion, (cambios, hechas, total) => emitir(`${JSON.stringify({ hechas, total, cambios })}\n`), senal);
    return 'ok';
  },
  // Claude solo dice qué verso suena dónde: las líneas las arma quien lo pide, con la letra y los tiempos que ya tiene.
  ajustarLetra: async (_emitir, _senal, lineas: Linea[], versos: string[], titulo?: string) => JSON.stringify(await ia.ajustarLetra(await aj(), lineas, versos, titulo)),
  // Revisa las líneas que aún no se han analizado y guarda lo encontrado por cada trozo terminado.
  analisisProfundo: async (emitir, senal, lineas: Linea[], titulo?: string, indiceLinea = -1, tope = 0) => {
    const a = await aj();
    const todas = await analisis.entradasAnalisis(lineas);
    // Con un tope, solo lo que está por verse desde el punto donde vas.
    const inicio = Math.max(0, indiceLinea - 3);
    const alcance = tope > 0 ? todas.slice(inicio, inicio + tope) : todas;
    const pendientes = alcance.filter((e) => e.pendiente);
    // Una misma línea repetida (un estribillo) solo se analiza una vez.
    const unicas = [...new Map(pendientes.map((e) => [e.clave, e])).values()];
    if (!unicas.length) return '0';
    emitir(`0/${unicas.length}\n`);
    await ia.analisisProfundo(a, unicas, titulo, async (r, desde, hasta, h, t) => {
      const filas = [...r].map(([i, d]) => ({ ...d, clave: unicas[i].clave, creado: Date.now() }));
      // Las líneas sin novedades también se marcan, para no volver a enviarlas.
      const conDatos = new Set(filas.map((f) => f.clave));
      const vacias = unicas.slice(desde, hasta).filter((e) => !conDatos.has(e.clave)).map((e) => ({ clave: e.clave, lecturas: [], sentidos: [], gramatica: [], creado: Date.now() }));
      await db.analisis.bulkPut([...filas, ...vacias]);
      emitir(`${h}/${t}\n`);
      // Las líneas repetidas se analizan una vez: la posición se aproxima en proporción.
    }, senal, indiceLinea < 0 || tope > 0 ? -1 : Math.floor((indiceLinea / Math.max(lineas.length, 1)) * unicas.length), todas);
    return String(unicas.length);
  },
  // Whisper emite cada evento como una línea de JSON.
  // El modelo lo elige quien pide transcribir, que sabe si el video es una canción. Sin él, el de los ajustes, como voz.
  transcribirEnVivo: async (emitir, senal, modelo?: ModeloWhisper) => String(await whisper.transcribirEnVivo(modelo ?? (await modeloPorOmision()), (e) => emitir(`${JSON.stringify(e)}\n`), senal)),
  transcribirDescarga: async (emitir, senal, url: string, desdeMs?: number, modelo?: ModeloWhisper) => {
    const intensidad = async () => (await aj()).whisperIntensidad;
    return String(await whisper.transcribirDescarga(url, modelo ?? (await modeloPorOmision()), intensidad, (e) => emitir(`${JSON.stringify(e)}\n`), senal, desdeMs));
  },
  transcribirArchivo: async (emitir, senal, url: string, pcmCrudo?: boolean, desdeMs?: number, modelo?: ModeloWhisper) => {
    // La intensidad se vuelve a leer en cada trozo: se puede cambiar mientras transcribe.
    const intensidad = async () => (await aj()).whisperIntensidad;
    return String(await whisper.transcribirArchivo(url, modelo ?? (await modeloPorOmision()), intensidad, (e) => emitir(`${JSON.stringify(e)}\n`), senal, pcmCrudo, desdeMs));
  },
});

async function modeloPorOmision(): Promise<ModeloWhisper> {
  const a = await aj();
  return modeloParaTranscribir(a.whisperModelo, a.idiomaObjetivo, false);
}

arrancar().catch((e) => console.error('Arranque del motor:', e));
