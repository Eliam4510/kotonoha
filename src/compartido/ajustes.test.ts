import { describe, expect, it } from 'vitest';
import { AJUSTES_INICIALES, type Ajustes, ajustesParaLengua, completarAjustes } from './ajustes';

describe('ajustes guardados', () => {
  it('sin datos usa los valores iniciales', () => {
    expect(completarAjustes(undefined)).toEqual(AJUSTES_INICIALES);
  });

  it('un modelo de transcripción que ya no existe pasa al de siempre', () => {
    const viejos = { whisperModelo: 'kotoba' } as unknown as Partial<Ajustes>;
    expect(completarAjustes(viejos).whisperModelo).toBe(AJUSTES_INICIALES.whisperModelo);
  });

  it('conserva un modelo válido', () => {
    expect(completarAjustes({ whisperModelo: 'turbo-ligero' }).whisperModelo).toBe('turbo-ligero');
  });

  it('completa las opciones nuevas sin perder las guardadas', () => {
    const a = completarAjustes({ nivel: 'JLPT N2' });
    expect(a.nivel).toBe('JLPT N2');
    expect(a.corregirAutomaticos).toBe(true);
    expect(a.nombre).toBe('');
  });
});

describe('idioma de la interfaz', () => {
  it('una instalación nueva sigue al navegador', () => {
    expect(completarAjustes(undefined).idiomaInterfaz).toBe('auto');
  });

  it('quien ya usaba la extensión sigue en español, aunque su navegador esté en otro idioma', () => {
    expect(completarAjustes({ nivel: 'JLPT N2' }).idiomaInterfaz).toBe('es');
  });

  it('lo elegido se respeta', () => {
    expect(completarAjustes({ idiomaInterfaz: 'ko' }).idiomaInterfaz).toBe('ko');
    expect(completarAjustes({ idiomaInterfaz: 'auto' }).idiomaInterfaz).toBe('auto');
  });
});

describe('la ficha abre con el diccionario', () => {
  it('quien tenía los valores de antes deja de gastar al abrir una palabra', () => {
    const a = completarAjustes({ diccionarioPestana: 'explicar', sentidoAutomatico: true, usarGuion: true } as never);
    expect(a.diccionarioPestana).toBe('ninguna');
    expect(a.sentidoAutomatico).toBe(false);
    expect(a.usarGuion).toBe(false);
    expect(a.migracion).toBe(1);
  });

  it('otra pestaña elegida a propósito se respeta', () => {
    expect(completarAjustes({ diccionarioPestana: 'audio' } as never).diccionarioPestana).toBe('audio');
  });

  it('lo que se vuelva a activar después se respeta', () => {
    const a = completarAjustes({ migracion: 1, diccionarioPestana: 'explicar', sentidoAutomatico: true, usarGuion: true } as never);
    expect(a.diccionarioPestana).toBe('explicar');
    expect(a.sentidoAutomatico).toBe(true);
    expect(a.usarGuion).toBe(true);
  });

  it('una instalación nueva parte de solo el diccionario', () => {
    const a = completarAjustes(undefined);
    expect(a.diccionarioPestana).toBe('ninguna');
    expect(a.sentidoAutomatico).toBe(false);
    expect(a.creditoMensual).toBe(0);
  });
});

describe('ajustes por lengua', () => {
  const con = (cambios: Partial<Ajustes>): Ajustes => ({ ...completarAjustes(undefined), idiomaInterfaz: 'es', ...cambios });
  const pasar = (a: Ajustes, id: string): Ajustes => ({ ...a, ...ajustesParaLengua(a, id) });

  it('la primera vez, cada lengua empieza con sus valores', () => {
    const a = pasar(con({}), 'en');
    expect(a.idiomaObjetivo).toBe('en');
    expect(a.nivel).toBe('CEFR B1');
    expect(a.formatoLectura).toBe('us');
    expect(a.furigana).toBe('ninguna');
    expect(a.lectorActivo).toBe(false);
    expect(a.ankiMazo).toBe('Kotonoha English');
  });

  it('al volver, cada lengua recupera lo que tenía', () => {
    const inicio = con({ nivel: 'JLPT N1', furigana: 'desconocidas', formatoLectura: 'romaji', vocesFrase: ['ja-JP-AoiNeural'], ankiMazo: 'Mío', prompts: { explicar: { sistema: 's', usuario: 'u' } } });
    let a = pasar(inicio, 'en');
    a = { ...a, nivel: 'CEFR C1', lectorActivo: true, formatoLectura: 'uk' };
    a = pasar(a, 'ja');
    expect(a.idiomaObjetivo).toBe('ja');
    expect(a.nivel).toBe('JLPT N1');
    expect(a.furigana).toBe('desconocidas');
    expect(a.formatoLectura).toBe('romaji');
    expect(a.vocesFrase).toEqual(['ja-JP-AoiNeural']);
    expect(a.ankiMazo).toBe('Mío');
    expect(a.prompts.explicar?.sistema).toBe('s');
    a = pasar(a, 'en');
    expect(a.nivel).toBe('CEFR C1');
    expect(a.lectorActivo).toBe(true);
    expect(a.formatoLectura).toBe('uk');
    expect(a.prompts).toEqual({});
  });

  it('lo que no depende de la lengua no se toca', () => {
    const a = pasar(con({ paleta: 'predeterminada', ankiPuerto: 1234, nombre: 'Ana', modo: 'enfoque1d' }), 'en');
    expect(a.ankiPuerto).toBe(1234);
    expect(a.nombre).toBe('Ana');
    expect(a.modo).toBe('enfoque1d');
  });

  it('elegir la que ya se estudia no cambia nada', () => {
    expect(ajustesParaLengua(con({}), 'ja')).toEqual({});
  });

  it('una lengua desconocida vale la inicial', () => {
    expect(ajustesParaLengua(con({}), 'xx')).toEqual({});
  });

  it('nadie estudia una lengua con traducciones a esa misma lengua', () => {
    const a = pasar(con({ idiomaInterfaz: 'en', idiomaExplicaciones: 'inglés', idiomaTraduccion: 'inglés', idiomaSecundario: 'en' }), 'en');
    expect(a.idiomaExplicaciones).toBe('inglés sencillo');
    expect(a.idiomaTraduccion).toBe('español');
    expect(a.idiomaSecundario).toBe('es');
  });

  it('quien habla japonés y estudia inglés tiene sus explicaciones y traducciones en japonés', () => {
    const a = pasar(con({ idiomaInterfaz: 'ja', idiomaExplicaciones: 'japonés sencillo', idiomaTraduccion: 'inglés', idiomaSecundario: 'en' }), 'en');
    expect(a.idiomaExplicaciones).toBe('japonés');
    expect(a.idiomaTraduccion).toBe('japonés');
    expect(a.idiomaSecundario).toBe('ja');
  });

  it('quien habla español no nota nada en sus idiomas', () => {
    const a = con({ idiomaExplicaciones: 'español', idiomaTraduccion: 'español', idiomaSecundario: 'es' });
    const cambios = ajustesParaLengua(a, 'en');
    expect(cambios.idiomaExplicaciones).toBeUndefined();
    expect(cambios.idiomaTraduccion).toBeUndefined();
    expect(cambios.idiomaSecundario).toBeUndefined();
  });
});
