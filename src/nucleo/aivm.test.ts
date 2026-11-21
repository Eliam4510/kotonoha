import { describe, expect, it } from 'vitest';
import { ARQUITECTURA_COMPATIBLE, leerAivmx, leerNpy, metadatosOnnx } from './aivm';

// ---------- Un modelo ONNX de juguete: lo justo para que tenga grafo y metadatos ----------

function varint(n: number): number[] {
  const b: number[] = [];
  while (n >= 128) {
    b.push((n % 128) | 0x80);
    n = Math.floor(n / 128);
  }
  b.push(n);
  return b;
}
const bytes = (s: string) => [...new TextEncoder().encode(s)];
const campoLongitud = (numero: number, contenido: number[]) => [...varint(numero * 8 + 2), ...varint(contenido.length), ...contenido];
const campoNumero = (numero: number, valor: number) => [...varint(numero * 8), ...varint(valor)];
const propiedad = (clave: string, valor: string) => campoLongitud(14, [...campoLongitud(1, bytes(clave)), ...campoLongitud(2, bytes(valor))]);

/** Un .npy v1 de float32 con la forma dada. */
function npy(forma: number[], valores: number[]): Uint8Array {
  let cabecera = `{'descr': '<f4', 'fortran_order': False, 'shape': (${forma.join(', ')}${forma.length === 1 ? ',' : ''}), }`;
  // La cabecera se rellena con espacios hasta que el total sea múltiplo de 64, y acaba en salto de línea.
  while ((10 + cabecera.length + 1) % 64) cabecera += ' ';
  cabecera += '\n';
  const salida = new Uint8Array(10 + cabecera.length + valores.length * 4);
  salida.set([0x93, ...bytes('NUMPY'), 1, 0, cabecera.length & 0xff, cabecera.length >> 8]);
  salida.set(bytes(cabecera), 10);
  new Float32Array(salida.buffer, 10 + cabecera.length, valores.length).set(valores);
  return salida;
}
const base64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

const MANIFIESTO = {
  manifest_version: '1.0',
  name: 'Prueba',
  uuid: '00000000-0000-0000-0000-000000000001',
  version: '1.2.0',
  model_architecture: ARQUITECTURA_COMPATIBLE,
  license: '# Licencia de prueba',
  creators: ['Alguien'],
  speakers: [{ name: 'Hablante', local_id: 0, icon: 'data:image/png;base64,AAAA', styles: [{ name: 'Normal', local_id: 0 }, { name: 'Alegre', local_id: 1 }] }],
};
const ESTILOS = Array.from({ length: 2 * 4 }, (_, i) => i / 2);

function modelo(manifiesto: object = MANIFIESTO, estilos = npy([2, 4], ESTILOS)): Uint8Array {
  // Un grafo con basura dentro, y hasta un campo 14 anidado que no debe leerse como metadato.
  const grafo = [...campoLongitud(14, campoLongitud(1, bytes('no'))), ...Array.from({ length: 300 }, (_, i) => i % 256)];
  return Uint8Array.from([
    ...campoNumero(1, 8),
    ...campoLongitud(2, bytes('pytorch')),
    ...campoLongitud(7, grafo),
    ...campoLongitud(8, [...campoNumero(2, 17)]),
    ...propiedad('aivm_manifest', JSON.stringify(manifiesto)),
    ...propiedad('aivm_hyper_parameters', JSON.stringify({ data: { sampling_rate: 44100 } })),
    ...propiedad('aivm_style_vectors', base64(estilos)),
  ]);
}

describe('los metadatos de un modelo ONNX', () => {
  it('lee los pares del primer nivel y salta el grafo', () => {
    const meta = metadatosOnnx(modelo());
    expect([...meta.keys()]).toEqual(['aivm_manifest', 'aivm_hyper_parameters', 'aivm_style_vectors']);
    expect(JSON.parse(meta.get('aivm_manifest')!).name).toBe('Prueba');
  });

  it('un archivo cortado es un error, no un resultado a medias', () => {
    const m = modelo();
    expect(() => metadatosOnnx(m.subarray(0, m.length - 10))).toThrow(/cortado/);
  });
});

describe('el .npy de los estilos', () => {
  it('lee la forma y los valores', () => {
    const { forma, valores } = leerNpy(npy([2, 4], ESTILOS));
    expect(forma).toEqual([2, 4]);
    expect([...valores]).toEqual(ESTILOS);
  });

  it('rechaza lo que no es float32', () => {
    const malo = npy([2, 4], ESTILOS);
    malo.set(bytes('<f8'), malo.indexOf(60 /* < */));
    expect(() => leerNpy(malo)).toThrow(/float32/);
  });
});

describe('una voz AIVMX', () => {
  it('da su ficha y sus vectores de estilo', () => {
    const v = leerAivmx(modelo());
    expect(v.ficha).toMatchObject({ nombre: 'Prueba', version: '1.2.0', frecuencia: 44100, creadores: ['Alguien'], licencia: '# Licencia de prueba' });
    expect(v.ficha.hablantes).toEqual([{ nombre: 'Hablante', id: 0, icono: 'data:image/png;base64,AAAA', estilos: [{ nombre: 'Normal', id: 0 }, { nombre: 'Alegre', id: 1 }] }]);
    expect(v.dimension).toBe(4);
    expect([...v.estilos]).toEqual(ESTILOS);
  });

  it('rechaza otras arquitecturas, estilos sin vector y lo que no es AIVMX', () => {
    expect(() => leerAivmx(modelo({ ...MANIFIESTO, model_architecture: 'Style-Bert-VITS2' }))).toThrow(/otra arquitectura/);
    expect(() => leerAivmx(modelo(MANIFIESTO, npy([1, 4], ESTILOS.slice(0, 4))))).toThrow(/Alegre/);
    expect(() => leerAivmx(Uint8Array.from([...campoNumero(1, 8)]))).toThrow(/AIVMX/);
  });
});
