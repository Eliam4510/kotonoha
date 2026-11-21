import { describe, expect, it } from 'vitest';
import { estimar, lecturaCorrecta, nivelDe, nombreDeGpu, PIEZAS, type PiezaPesada, pocoEspacio, type PruebaEquipo, REFERENCIA_MUESTRA_MS, type SenalesEquipo } from './equipo';

const senales = (o: Partial<SenalesEquipo> = {}, gpu: Partial<SenalesEquipo['gpu']> = {}): SenalesEquipo => ({
  webgpu: true,
  respaldo: false,
  gpu: { fabricante: 'amd', arquitectura: 'rdna-4', descripcion: '', ...gpu },
  nucleos: 12,
  memoria: 8,
  libre: 50 * 1024 ** 3,
  ...o,
});
const prueba = (ocrMs: number, o: Partial<PruebaEquipo> = {}): PruebaEquipo => ({ ocrMs, correcto: true, dispositivo: 'webgpu', fecha: 1, ...o });
const TODAS: PiezaPesada[] = ['voz', 'letras', 'ocr-libro', 'ocr-manga', 'practica'];

describe('la clase de equipo', () => {
  it('sin WebGPU, o con una gráfica de respaldo, es básico', () => {
    expect(nivelDe(senales({ webgpu: false }))).toBe('basico');
    expect(nivelDe(senales({ respaldo: true }))).toBe('basico');
  });

  it('una NVIDIA, o una dedicada que el navegador nombra, es potente sin probar nada', () => {
    expect(nivelDe(senales({}, { fabricante: 'nvidia', arquitectura: 'ampere' }))).toBe('potente');
    expect(nivelDe(senales({}, { descripcion: 'AMD Radeon RX 9060 XT' }))).toBe('potente');
    expect(nivelDe(senales({}, { fabricante: 'intel', descripcion: 'Intel(R) Arc(TM) B580 Graphics' }))).toBe('potente');
  });

  it('una AMD o una Intel sin nombre puede ser integrada o dedicada: queda sin medir', () => {
    expect(nivelDe(senales())).toBe('sin-medir');
    expect(nivelDe(senales({}, { fabricante: 'intel', arquitectura: 'gen-12lp', descripcion: 'Intel(R) UHD Graphics' }))).toBe('sin-medir');
  });

  it('con la prueba, por lo que tardó el OCR frente al equipo de referencia', () => {
    expect(nivelDe(senales(), prueba(REFERENCIA_MUESTRA_MS))).toBe('potente');
    expect(nivelDe(senales(), prueba(REFERENCIA_MUESTRA_MS * 5))).toBe('medio');
    expect(nivelDe(senales(), prueba(REFERENCIA_MUESTRA_MS * 20))).toBe('basico');
  });

  it('en el procesador, o leyendo mal, es básico aunque vaya rápido', () => {
    expect(nivelDe(senales(), prueba(REFERENCIA_MUESTRA_MS, { dispositivo: 'wasm' }))).toBe('basico');
    expect(nivelDe(senales(), prueba(REFERENCIA_MUESTRA_MS, { correcto: false }))).toBe('basico');
  });
});

describe('lo que tardaría cada pieza', () => {
  it('sin probar, lo probable para su clase, sin tiempos', () => {
    const e = estimar(TODAS, senales({ webgpu: false }));
    expect(e.map((x) => x.estado)).toEqual(['muy-lento', 'muy-lento', 'lento', 'muy-lento', 'lento']);
    expect(e.every((x) => !x.medido && x.segundos === undefined)).toBe(true);
    expect(estimar(TODAS, senales()).every((x) => x.estado === 'sin-medir')).toBe(true);
  });

  it('con la prueba, lo del equipo de referencia escalado', () => {
    const igual = estimar(TODAS, senales(), prueba(REFERENCIA_MUESTRA_MS));
    expect(igual.map((x) => x.segundos)).toEqual(TODAS.map((p) => PIEZAS[p].segundos));
    expect(igual.every((x) => x.estado === 'bien' && x.medido)).toBe(true);
    // Diez veces más lento: 30 minutos de video en 10 minutos todavía va bien; una página de manga, lenta.
    const lento = estimar(['voz', 'ocr-manga'], senales(), prueba(REFERENCIA_MUESTRA_MS * 10));
    expect(lento.map((x) => x.estado)).toEqual(['bien', 'lento']);
    // Cuarenta veces: la voz ya es más lenta que el propio video.
    expect(estimar(['voz'], senales(), prueba(REFERENCIA_MUESTRA_MS * 40))[0].estado).toBe('muy-lento');
  });

  it('en el procesador, la voz, el manga y la práctica quedan muy lentos aunque el OCR de libros vaya bien', () => {
    const e = estimar(TODAS, senales(), prueba(REFERENCIA_MUESTRA_MS * 2, { dispositivo: 'wasm' }));
    expect(e.map((x) => x.estado)).toEqual(['muy-lento', 'muy-lento', 'bien', 'muy-lento', 'muy-lento']);
  });
});

describe('lo demás', () => {
  it('poco espacio para un modelo de voz', () => {
    expect(pocoEspacio(senales({ libre: 1024 ** 3 }))).toBe(true);
    expect(pocoEspacio(senales())).toBe(false);
    expect(pocoEspacio(senales({ libre: null }))).toBe(false);
  });

  it('la gráfica, con el nombre que da el navegador o legible a partir de su fabricante y su arquitectura', () => {
    expect(nombreDeGpu(senales().gpu)).toBe('AMD RDNA 4');
    expect(nombreDeGpu({ fabricante: 'nvidia', arquitectura: 'lovelace', descripcion: '' })).toBe('NVIDIA Lovelace');
    expect(nombreDeGpu({ fabricante: 'intel', arquitectura: 'gen-12lp', descripcion: '' })).toBe('Intel Gen 12LP');
    expect(nombreDeGpu({ fabricante: 'apple', arquitectura: 'metal-3', descripcion: '' })).toBe('Apple Metal 3');
    expect(nombreDeGpu({ fabricante: 'amd', arquitectura: 'rdna-4', descripcion: ' AMD Radeon RX 9060 XT ' })).toBe('AMD Radeon RX 9060 XT');
    expect(nombreDeGpu({ fabricante: '', arquitectura: '', descripcion: '' })).toBe('');
  });

  it('la página de muestra se da por bien leída con pocos errores, sin contar espacios', () => {
    expect(lecturaCorrecta('Kotonoha 2026  reading test', 'Kotonoha 2026 reading test')).toBe(true);
    expect(lecturaCorrecta('Kotonoha 2O26 reading tesl', 'Kotonoha 2026 reading test')).toBe(true);
    expect(lecturaCorrecta('###### ## ###', 'Kotonoha 2026 reading test')).toBe(false);
    expect(lecturaCorrecta('', 'Kotonoha')).toBe(false);
  });
});
