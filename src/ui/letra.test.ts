import { describe, expect, it } from 'vitest';
import { paqueteDe } from '../lenguas';
import { familiaDe, letraElegida, letrasDe } from './letra';

describe('la letra elegida para la lengua', () => {
  const ja = paqueteDe('ja');
  const en = paqueteDe('en');

  it('la redondeada es la de siempre de la lengua, sin aire de más', () => {
    expect(letraElegida(ja, 'redondeada')).toEqual({ letra: ja.letra, aire: 0 });
    expect(letraElegida(en, 'redondeada')).toEqual({ letra: en.letra, aire: 0 });
  });

  it('cada letra lleva el aire que le falta a su lectura', () => {
    expect(letraElegida(ja, 'gotica')).toEqual({ letra: ja.letras!.gotica, aire: ja.aireLectura!.gotica });
    expect(letraElegida(ja, 'libro')).toEqual({ letra: ja.letras!.libro, aire: ja.aireLectura!.libro });
    expect(letraElegida(ja, 'escuela').letra).toBe(ja.letras!.escuela);
  });

  it('una letra que la lengua no tiene pasa a la gótica', () => {
    expect(en.letras?.escuela).toBeUndefined();
    expect(letraElegida(en, 'escuela').letra).toBe(en.letras!.gotica);
  });

  it('sin letras propias, siempre la de la lengua', () => {
    const sinLetras = { ...ja, letras: undefined, aireLectura: undefined };
    expect(letraElegida(sinLetras, 'gotica')).toEqual({ letra: ja.letra, aire: 0 });
    expect(letrasDe(sinLetras).map((l) => l.id)).toEqual(['redondeada']);
  });

  it('las opciones de cada lengua: la de escribir a mano, solo si la hay', () => {
    expect(letrasDe(ja).map((l) => l.id)).toEqual(['gotica', 'redondeada', 'libro', 'escuela']);
    expect(letrasDe(en).map((l) => l.id)).toEqual(['gotica', 'redondeada', 'libro']);
  });

  it('cada botón enseña su letra', () => {
    expect(familiaDe(ja, 'redondeada')).toBe(ja.letra);
    expect(familiaDe(ja, 'libro')).toBe(ja.letras!.libro);
    expect(familiaDe(en, 'escuela')).toBe(en.letra);
  });
});
