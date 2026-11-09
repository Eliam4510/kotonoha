import { describe, expect, it } from 'vitest';
import { cuerpoCompatible, jsonDeRespuesta, leerFlujo, rechazaEsquema, usoDeCompatible } from './compatible';
import { separarModelo, idParaProveedor, valorDeModelo } from '../compartido/proveedores';

describe('el modelo de cada tarea', () => {
  it('el de Claude va tal cual; el de otro proveedor, con el suyo delante', () => {
    expect(separarModelo('claude-sonnet-5-5')).toEqual({ proveedor: null, modelo: 'claude-sonnet-5-5' });
    expect(separarModelo(valorDeModelo('openrouter', 'deepseek/deepseek-chat'))).toEqual({ proveedor: 'openrouter', modelo: 'deepseek/deepseek-chat' });
  });

  it('un identificador libre para un proveedor nuevo', () => {
    expect(idParaProveedor('Mi Servidor', [])).toBe('mi-servidor');
    expect(idParaProveedor('OpenRouter', ['openrouter'])).toBe('openrouter-2');
  });
});

describe('la petición', () => {
  it('en flujo, con el uso al final, y la imagen delante del texto', () => {
    const c = cuerpoCompatible({ modelo: 'm', sistema: 's', usuario: 'u', imagen: { tipo: 'image/png', datos: 'AAA' }, maxTokens: 100 });
    expect(c).toMatchObject({ model: 'm', max_tokens: 100, stream: true, stream_options: { include_usage: true } });
    expect((c.messages as { content: unknown }[])[1].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
      { type: 'text', text: 'u' },
    ]);
    expect(c.response_format).toBeUndefined();
  });

  it('con esquema, o en modo JSON con el esquema en las instrucciones', () => {
    const esquema = { type: 'object', properties: { a: { type: 'string' } } };
    const conEsquema = cuerpoCompatible({ modelo: 'm', sistema: 's', usuario: 'u', maxTokens: 10, esquema, modoJson: 'esquema' });
    expect(conEsquema.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'respuesta', schema: esquema, strict: true } });
    const conInstrucciones = cuerpoCompatible({ modelo: 'm', sistema: 's', usuario: 'u', maxTokens: 10, esquema, modoJson: 'instrucciones' });
    expect(conInstrucciones.response_format).toEqual({ type: 'json_object' });
    expect((conInstrucciones.messages as { content: string }[])[0].content).toContain(JSON.stringify(esquema));
  });

  it('a OpenRouter se le pide el coste', () => {
    expect(cuerpoCompatible({ modelo: 'm', sistema: 's', usuario: 'u', maxTokens: 10, pedirCoste: true }).usage).toEqual({ include: true });
  });
});

describe('el flujo', () => {
  it('lee el texto por partes, el uso del final y deja lo que queda a medias', () => {
    const a = leerFlujo(': OPENROUTER PROCESSING\n\ndata: {"model":"x","choices":[{"delta":{"content":"Hola"}}]}\n\ndata: {"choices":[{"delta":{"content":" mundo"},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2,"cost":0.0001}}\n\ndata: [DONE]\n\ndata: {"choi');
    expect(a.trozos.map((t) => t.texto ?? '').join('')).toBe('Hola mundo');
    expect(a.trozos[0].modelo).toBe('x');
    expect(a.trozos[1].fin).toBe('stop');
    expect(a.trozos[2].uso).toEqual({ prompt_tokens: 10, completion_tokens: 2, cost: 0.0001 });
    expect(a.resto).toBe('data: {"choi');
  });

  it('un error dentro del flujo se dice', () => {
    expect(leerFlujo('data: {"error":{"message":"Sin saldo"}}\n').trozos).toEqual([{ error: 'Sin saldo' }]);
  });

  it('el uso, con lo leído de la caché aparte', () => {
    expect(usoDeCompatible({ prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 60 } })).toEqual({ entrada: 40, salida: 20, cacheEscritura5m: 0, cacheEscritura1h: 0, cacheLectura: 60 });
    expect(usoDeCompatible(undefined).entrada).toBe(0);
  });
});

describe('las respuestas', () => {
  it('reconoce el rechazo del esquema', () => {
    expect(rechazaEsquema(400, 'This response_format type is unavailable now')).toBe(true);
    expect(rechazaEsquema(401, 'response_format')).toBe(false);
  });

  it('saca el JSON aunque venga entre ``` o con texto alrededor', () => {
    expect(jsonDeRespuesta('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(jsonDeRespuesta('Aquí está: {"a":1} espero que sirva')).toBe('{"a":1}');
    expect(jsonDeRespuesta('[1,2]')).toBe('[1,2]');
  });
});
