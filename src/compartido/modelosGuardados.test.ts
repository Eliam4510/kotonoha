import { describe, expect, it } from 'vitest';
import { archivoDelModelo, archivosAlBorrar, archivosSueltos, modeloCompleto, resumirModelos } from './modelosGuardados';

const base = 'https://huggingface.co/onnx-community/whisper-large-v3-turbo/resolve/main';
const CONFIG = `${base}/config.json`;
const TOKENIZADOR = `${base}/tokenizer.json`;
const ENCODER_16 = `${base}/onnx/encoder_model_fp16.onnx`;
const ENCODER_16_DATOS = `${base}/onnx/encoder_model_fp16.onnx_data`;
const ENCODER_Q4 = `${base}/onnx/encoder_model_q4f16.onnx`;
const DECODER = `${base}/onnx/decoder_model_merged_q4f16.onnx`;
const BASE_ENCODER = 'https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/encoder_model_fp16.onnx';
const BASE_DECODER = 'https://huggingface.co/onnx-community/whisper-base/resolve/main/onnx/decoder_model_merged_q4.onnx';
const OTRO_ENCODER = 'https://huggingface.co/onnx-community/whisper-base.en/resolve/main/onnx/encoder_model_fp16.onnx';

const turbo = { id: 'onnx-community/whisper-large-v3-turbo', dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4f16' } };
const ligero = { id: 'onnx-community/whisper-large-v3-turbo', dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } };
const LISTA = [['turbo', turbo], ['turbo-ligero', ligero]] as Parameters<typeof resumirModelos>[1];

describe('archivoDelModelo', () => {
  it('reconoce sus partes, con sus datos externos, y lo común', () => {
    for (const u of [CONFIG, TOKENIZADOR, ENCODER_16, ENCODER_16_DATOS, DECODER]) expect(archivoDelModelo(u, turbo)).toBe(true);
  });

  it('no toma la otra precisión del mismo repositorio', () => {
    expect(archivoDelModelo(ENCODER_Q4, turbo)).toBe(false);
    expect(archivoDelModelo(ENCODER_16, ligero)).toBe(false);
  });

  it('no confunde un repositorio con otro de nombre parecido', () => {
    const whisperBase = { id: 'onnx-community/whisper-base', dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' } };
    expect(archivoDelModelo(BASE_ENCODER, whisperBase)).toBe(true);
    expect(archivoDelModelo(OTRO_ENCODER, whisperBase)).toBe(false);
    expect(modeloCompleto([OTRO_ENCODER, BASE_DECODER], whisperBase)).toBe(false);
  });
});

describe('modeloCompleto', () => {
  it('pide todas sus partes: una descarga puede quedarse a medias', () => {
    expect(modeloCompleto([CONFIG, ENCODER_16], turbo)).toBe(false);
    expect(modeloCompleto([CONFIG, DECODER], turbo)).toBe(false);
    expect(modeloCompleto([CONFIG, ENCODER_16, DECODER], turbo)).toBe(true);
  });
});

describe('resumirModelos', () => {
  const archivos = [
    { url: CONFIG, bytes: 1 },
    { url: ENCODER_16, bytes: 1000 },
    { url: ENCODER_Q4, bytes: 300 },
    { url: DECODER, bytes: 200 },
  ];

  it('cuenta lo compartido en los dos, y una sola vez en el total', () => {
    const r = resumirModelos(archivos, LISTA);
    expect(r.modelos).toEqual([{ id: 'turbo', bytes: 1201 }, { id: 'turbo-ligero', bytes: 501 }]);
    expect(r.totalBytes).toBe(1501);
    expect(r.otrosBytes).toBe(0);
  });

  it('un modelo a medias no se ofrece como guardado, pero lo que ocupa se ve', () => {
    const r = resumirModelos([{ url: CONFIG, bytes: 1 }, { url: ENCODER_16, bytes: 1000 }], LISTA);
    expect(r.modelos).toEqual([]);
    expect(r.otrosBytes).toBe(1001);
  });
});

describe('archivosAlBorrar', () => {
  const urls = [CONFIG, TOKENIZADOR, ENCODER_16, ENCODER_Q4, DECODER];

  it('con otro modelo guardado, respeta lo que comparten', () => {
    expect(archivosAlBorrar(urls, 'turbo', LISTA)).toEqual([ENCODER_16]);
    expect(archivosAlBorrar(urls, 'turbo-ligero', LISTA)).toEqual([ENCODER_Q4]);
  });

  it('si es el último de ese repositorio, se lleva también lo común', () => {
    expect(archivosAlBorrar([CONFIG, TOKENIZADOR, ENCODER_16, DECODER], 'turbo', LISTA)).toEqual([CONFIG, TOKENIZADOR, ENCODER_16, DECODER]);
  });

  it('un modelo a medias no protege lo que comparte', () => {
    expect(archivosAlBorrar([CONFIG, ENCODER_16, DECODER, `${base}/onnx/encoder_model.onnx`], 'turbo', LISTA)).toEqual([CONFIG, ENCODER_16, DECODER]);
  });
});

describe('archivosSueltos', () => {
  it('son los que no pertenecen a ningún modelo completo', () => {
    const viejo = 'https://huggingface.co/onnx-community/whisper-large-v3/resolve/main/onnx/encoder_model.onnx';
    expect(archivosSueltos([CONFIG, ENCODER_16, DECODER, viejo], LISTA)).toEqual([viejo]);
    expect(archivosSueltos([CONFIG, ENCODER_16], LISTA)).toEqual([CONFIG, ENCODER_16]);
  });
});
