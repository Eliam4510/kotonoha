// Los prompts del japonés, byte a byte. Cambiar uno deja sin valor las respuestas guardadas, que se pagarían otra vez.
// Si el cambio es a propósito, esta prueba es el aviso: hay que actualizar la huella sabiendo lo que cuesta.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { rellenar } from '../../motor/prompts';
import { PROMPTS_JAPONES as P } from './prompts';

const huella = (x: unknown) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);

// Tomadas de la versión 0.3.0, la última en la que los prompts estaban fuera del paquete.
const HUELLAS: Record<string, string> = {
  "base.explicar.sistema": '4da74559ac20f8ea',
  "base.explicar.usuario": 'fdbee27482b1e555',
  "base.desglosar.sistema": '0aad94ae041f66af',
  "base.desglosar.usuario": '0b7b815a73e11a46',
  "base.traducir.sistema": 'c856c6c4d108e3d2',
  "base.traducir.usuario": '01f3241cbd40bea3',
  "base.generar.sistema": 'dbc95a55412b3cd8',
  "base.generar.usuario": '1938c378f8ecd60d',
  "base.historia.sistema": 'fd7afa35c76bb220',
  "base.historia.usuario": '54ae86320f10f5db',
  "base.preguntar.sistema": 'fd6a794b140c63d7',
  "base.preguntar.usuario": 'd057dd6be786298c',
  "base.gramatica.sistema": 'a9e2b288a734e19e',
  "base.gramatica.usuario": '7e75c795a74b4f4b',
  "sentido": '31227bbb1e340a1c',
  "esquemaSentido": 'a2875551065addca',
  "analisis": '3813c08761f283db',
  "esquemaAnalisis": '6d05a591b9753e7f',
  "subtitulos": '85bdc0bce7e35b6c',
  "correccion": 'e05f6724a96bbfe0',
  "esquemaCorrecciones": '9b7c70abe183f7dd',
  "aLengua": '8fb340b87ab587dd',
  "imagen": '3136d0eaba5a0a04',
  "glosa": 'c9025e0f4eaa0160',
  "revisarLectura": '981d5b5e0f94660f',
  "relleno.español.explicar": '9280ab5ae34a3d5a',
  "relleno.español.desglosar": '197d31d390df624b',
  "relleno.español.traducir": '5ed1e178a815f450',
  "relleno.español.generar": '559e0ebf146932a3',
  "relleno.español.historia": '310b64d44fe06629',
  "relleno.español.preguntar": '490a41870eea75a4',
  "relleno.español.gramatica": 'd2ea5f83f893e777',
  "relleno.español.sentido": '68f410271acf2ed2',
  "relleno.español.analisis": '2c14c145d08db129',
  "relleno.español.subtitulos": 'b711ca61aa25906d',
  "relleno.inglés.explicar": 'c6ce9c5dcb526f44',
  "relleno.inglés.desglosar": '97185896889fbb8e',
  "relleno.inglés.traducir": '5ed1e178a815f450',
  "relleno.inglés.generar": '559e0ebf146932a3',
  "relleno.inglés.historia": '310b64d44fe06629',
  "relleno.inglés.preguntar": '932eba7e8cf2e950',
  "relleno.inglés.gramatica": 'c469334824f5be8a',
  "relleno.inglés.sentido": '45e5129a69b99a24',
  "relleno.inglés.analisis": '4fcc49a14fbdd6ab',
  "relleno.inglés.subtitulos": 'b711ca61aa25906d',
};

function huellasActuales(): Record<string, string> {
  const tabla: Record<string, string> = {};
  for (const [tarea, v] of Object.entries(P.base)) {
    tabla[`base.${tarea}.sistema`] = huella(v.sistema);
    tabla[`base.${tarea}.usuario`] = huella(v.usuario);
  }
  tabla.sentido = huella(P.sentido);
  tabla.esquemaSentido = huella(P.esquemaSentido);
  tabla.analisis = huella(P.analisis);
  tabla.esquemaAnalisis = huella(P.esquemaAnalisis);
  tabla.subtitulos = huella(P.subtitulos);
  tabla.correccion = huella(P.correccion);
  tabla.esquemaCorrecciones = huella(P.esquemaCorrecciones);
  tabla.aLengua = huella(P.aLengua);
  tabla.imagen = huella(P.imagen);
  tabla.glosa = huella(P.glosa('español'));
  tabla.revisarLectura = huella(P.revisarLectura('español'));
  const variables = { palabra: '食べる', superficie: '食べた', lectura: 'たべた', frase: '猫が魚を食べた。', entorno: 'Título: prueba', traduccion: 'El gato comió pescado.', titulo: 'prueba', pregunta: '¿Por qué?', idioma: 'inglés' };
  for (const idioma of ['español', 'inglés']) {
    const a = { nivel: 'JLPT N3', idiomaExplicaciones: idioma };
    for (const [tarea, v] of Object.entries(P.base)) {
      tabla[`relleno.${idioma}.${tarea}`] = huella(rellenar(v.sistema, a, variables) + rellenar(v.usuario, a, variables));
    }
    tabla[`relleno.${idioma}.sentido`] = huella(rellenar(P.sentido, a, {}));
    tabla[`relleno.${idioma}.analisis`] = huella(rellenar(P.analisis, a, {}));
    tabla[`relleno.${idioma}.subtitulos`] = huella(rellenar(P.subtitulos, a, { idioma: 'inglés' }));
  }
  return tabla;
}

describe('prompts del japonés', () => {
  it('no cambian ni un byte', () => {
    expect(huellasActuales()).toEqual(HUELLAS);
  });

  it('la glosa y la revisión de lecturas llevan el idioma que se pide', () => {
    expect(P.glosa('alemán')).toContain('a alemán con una o dos palabras');
    expect(P.revisarLectura('alemán')).toContain('Responde en alemán.');
  });
});
