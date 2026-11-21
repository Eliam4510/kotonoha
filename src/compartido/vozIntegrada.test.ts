import { describe, expect, it } from 'vitest';
import { AJUSTES_INICIALES, type Ajustes, conVozInstalada, nombreVozIntegrada, sinVozInstalada, type VozInstalada, vozIntegradaActiva } from './ajustes';

const voz = (uuid: string, nombre: string, estilos = ['Normal', 'Alegre']): VozInstalada => ({
  uuid,
  nombre,
  autor: 'Alguien',
  version: '1.0.0',
  licencia: 'ACML 1.0',
  bytes: 250e6,
  sha256: 'x',
  hablantes: [{ nombre, id: 0, estilos: estilos.map((e, i) => ({ nombre: e, id: i })) }],
});
const ajustes = (o: Partial<Ajustes> = {}): Ajustes => ({ ...AJUSTES_INICIALES, idiomaObjetivo: 'ja', ...o });
const con = (a: Ajustes, cambios: Partial<Ajustes>): Ajustes => ({ ...a, ...cambios });

describe('las voces integradas en los ajustes', () => {
  it('la primera que se instala queda elegida y activa, con su primer estilo', () => {
    const a = con(ajustes(), conVozInstalada(ajustes(), voz('a', 'Una')));
    expect(a.vozIntegrada).toMatchObject({ activa: true, voz: 'a', hablante: 0, estilo: 0 });
    expect(vozIntegradaActiva(a)).toBe(true);
    expect(nombreVozIntegrada(a)).toBe('Una · Normal');
  });

  it('otra más se añade sin cambiar la elegida, y volver a instalar una no la duplica', () => {
    let a = con(ajustes(), conVozInstalada(ajustes(), voz('a', 'Una')));
    a = con(a, { vozIntegrada: { ...a.vozIntegrada, estilo: 1 } });
    a = con(a, conVozInstalada(a, voz('b', 'Otra')));
    a = con(a, conVozInstalada(a, voz('a', 'Una')));
    expect(a.vozIntegrada.instaladas.map((v) => v.uuid)).toEqual(['b', 'a']);
    expect(a.vozIntegrada).toMatchObject({ voz: 'a', estilo: 1 });
  });

  it('borrar la elegida pasa a la que quede; borrar la última apaga las voces', () => {
    let a = con(ajustes(), conVozInstalada(ajustes(), voz('a', 'Una')));
    a = con(a, conVozInstalada(a, voz('b', 'Otra')));
    a = con(a, sinVozInstalada(a, 'a'));
    expect(a.vozIntegrada).toMatchObject({ activa: true, voz: 'b', estilo: 0 });
    a = con(a, sinVozInstalada(a, 'b'));
    expect(a.vozIntegrada).toMatchObject({ activa: false, voz: null, instaladas: [] });
    expect(vozIntegradaActiva(a)).toBe(false);
  });

  it('borrar otra que no es la elegida solo la quita', () => {
    let a = con(ajustes(), conVozInstalada(ajustes(), voz('a', 'Una')));
    a = con(a, conVozInstalada(a, voz('b', 'Otra')));
    a = con(a, sinVozInstalada(a, 'b'));
    expect(a.vozIntegrada).toMatchObject({ activa: true, voz: 'a' });
    expect(a.vozIntegrada.instaladas).toHaveLength(1);
  });

  it('solo suenan al estudiar japonés', () => {
    const a = con(ajustes(), conVozInstalada(ajustes(), voz('a', 'Una')));
    expect(vozIntegradaActiva({ ...a, idiomaObjetivo: 'en' })).toBe(false);
  });
});
