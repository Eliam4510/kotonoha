import { describe, expect, it } from 'vitest';
import { API_ULTIMA_VERSION, ordenInstalarAyudante, URL_ULTIMA_VERSION } from './proyecto';

describe('el proyecto', () => {
  it('la orden del ayudante se ejecuta en la carpeta del zip y lleva el identificador de la copia', () => {
    const orden = ordenInstalarAyudante('abcdefghijklmnopabcdefghijklmnop');
    expect(orden).toBe('powershell -ExecutionPolicy Bypass -File instalar.ps1 -Extension abcdefghijklmnopabcdefghijklmnop');
    // Nada de la ruta del repositorio: quien descarga el zip no la tiene.
    expect(orden).not.toContain('herramientas');
  });

  it('la última versión, en su página y en la API de GitHub', () => {
    expect(URL_ULTIMA_VERSION).toBe('https://github.com/Eliam4510/kotonoha/releases/latest');
    expect(API_ULTIMA_VERSION).toBe('https://api.github.com/repos/Eliam4510/kotonoha/releases/latest');
  });
});
