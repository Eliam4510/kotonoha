// Servidor falso de la API de Claude para pruebas y capturas: no gasta nada y responde al instante.
// Registra cada petición para comprobar que el cliente envía lo que debe.

import { createServer } from 'node:http';

function respuestaPara(cuerpo) {
  const formato = cuerpo.output_config?.format?.schema;
  const texto = JSON.stringify(cuerpo.messages ?? '');
  const sistema = JSON.stringify(cuerpo.system ?? '');
  if (formato?.properties?.significado && texto.includes('Palabra: 赤い')) {
    return JSON.stringify({ significado: 'rojas, del color del fuego', uso: 'literal', nota: 'Aquí describe el color de las estrellas del sueño: es el sentido habitual de la palabra.', definicion: 0 });
  }
  if (formato?.properties?.significado) {
    return JSON.stringify({ significado: 'absorber, hacer suyo', uso: 'figurado', nota: 'En esta frase, «comer» las estrellas es una imagen de hacerlas parte de uno mismo, no de comer de verdad.', definicion: 0 });
  }
  if (formato?.properties?.lectura_lema || formato?.properties?.motivo) {
    return JSON.stringify({ lectura: 'あと', lema: '後', lectura_lema: 'あと', motivo: 'Aquí significa «después de»: 授業の後.' });
  }
  if (formato?.properties?.lineas?.items?.properties?.lecturas) {
    const lineas = [...texto.matchAll(/(\d+): ([^\\]+)/g)].map((m) => ({ i: Number(m[1]), t: m[2] }));
    return JSON.stringify({
      lineas: lineas.map(({ i, t }) => ({
        i,
        lecturas: t.includes('授業の後') ? [{ superficie: '後', lectura: 'あと', lema: '後', lectura_lema: 'あと' }] : [],
        sentidos: t.includes('星を食べる') ? [{ superficie: '食べる', significado: 'absorber, hacer suyo', uso: 'poetico' }] : [],
        gramatica: t.includes('続けると思います')
          ? [{ fragmento: 'と思います', patron: '〜と思う', nivel: 'N4', significado: 'Creo que…' }]
          : t.includes('ことができます')
            ? [{ fragmento: 'ことができます', patron: '〜ことができる', nivel: 'N4', significado: 'Poder hacer algo' }]
            : t.includes('でも')
              ? [{ fragmento: 'でも', patron: '〜でも', nivel: 'N4', significado: 'Incluso…, aunque…' }]
              : [],
      })),
    });
  }
  if (formato?.properties?.ajuste) {
    // Empareja cada verso con la línea que más se le parece, sin volver atrás. Es lo que se le pide a Claude, en tosco.
    const contenido = cuerpo.messages?.[0]?.content ?? '';
    const [, transcripcion = '', letra = ''] = /TRANSCRIPCIÓN:\n([\s\S]*?)\n\nLETRA:\n([\s\S]*)$/.exec(contenido) ?? [];
    const piezas = (t) => new Set(t.toLowerCase().match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}']+/gu) ?? []);
    const lineas = transcripcion.split('\n').map((l) => piezas(l.replace(/^\d+ \[[^\]]*\] /, '')));
    const ajuste = [];
    let cursor = 0;
    letra.split('\n').map((l) => l.replace(/^\d+: /, '')).forEach((verso, v) => {
      if (/^\[.*\]$/.test(verso)) return ajuste.push({ v, de: -2, a: -2 });
      const p = piezas(verso);
      const comunes = (i) => [...p].filter((x) => lineas[i].has(x)).length;
      let de = -1;
      let mejor = 0;
      for (let i = cursor; i < lineas.length; i++) {
        if (comunes(i) > mejor) {
          mejor = comunes(i);
          de = i;
        }
      }
      if (de < 0) return ajuste.push({ v, de: -1, a: -1 });
      // Un verso largo puede ocupar varias líneas: las de al lado que estén casi enteras en él son suyas.
      const suya = (i) => comunes(i) >= Math.ceil(lineas[i].size * 0.6);
      let a = de;
      while (a + 1 < lineas.length && suya(a + 1)) a++;
      while (de - 1 >= cursor && suya(de - 1)) de--;
      ajuste.push({ v, de, a });
      cursor = de;
    });
    return JSON.stringify({ ajuste });
  }
  if (formato?.properties?.correcciones) {
    // Corrige lo que una transcripción real falla, y deja el resto tal cual: solo devuelve lo que cambia.
    const correcciones = [...texto.matchAll(/(\d+): ([^\\]+)/g)]
      .filter((m) => /たぶん|多分|医師/.test(m[2]))
      .map((m) => ({ i: Number(m[1]), t: m[2].replace('たぶん', '多分').replace('医師の', '意志の') }));
    return JSON.stringify({ correcciones });
  }
  if (formato?.properties?.lineas && sistema.includes('subtítulos al inglés')) {
    const lineas = [...texto.matchAll(/(\d+): ([^\\]+)/g)].map((m) => ({ i: Number(m[1]), t: `This is English line ${m[1]}` }));
    return JSON.stringify({ lineas });
  }
  if (formato?.properties?.lineas && sistema.includes('subtítulos al japonés')) {
    const lineas = [...texto.matchAll(/(\d+): ([^\\]+)/g)].map((m) => ({ i: Number(m[1]), t: `日本語の文${m[1]}です` }));
    return JSON.stringify({ lineas });
  }
  if (formato?.properties?.lineas) {
    const lineas = [...texto.matchAll(/(\d+): ([^\\]+)/g)].map((m) => ({ i: Number(m[1]), t: `[traducción de ${m[1]}]` }));
    return JSON.stringify({ lineas });
  }
  if (sistema.includes('desglosa frases')) {
    return '## 赤い星と青い\nSignificado: una estrella roja y una azul\nExplicación: と une los dos nombres, y el adjetivo 青い modifica al sustantivo que sigue.\n\n## 星を\nSignificado: a las estrellas\nExplicación: を marca el objeto directo de la acción.\n\n## 食べる\nSignificado: las devora, las hace suyas\nExplicación: Forma de diccionario del verbo. En la letra tiene un sentido figurado, no literal.';
  }
  if (sistema.includes('traductor profesional')) return 'Soñé que devoraba estrellas rojas y azules';
  if (sistema.includes('gramática inglesa')) return 'Aquí used to habla de un hábito del pasado que ya no se da. Se forma con used to más el verbo en infinitivo. No se confunde con be used to, que significa estar acostumbrado.';
  if (sistema.includes('gramática japonesa')) return 'Aquí 〜と思う presenta lo que dice el hablante como su opinión o intención, y suaviza la afirmación. Se forma con la forma simple del verbo más と思う. Se confunde con 〜と考える, más reflexivo y formal.\n\n明日は雨だと思う。 Creo que mañana lloverá.';
  if (sistema.includes('autor de lecturas')) return '猫の散歩\n\n京都に猫がいました。猫は毎日、川の近くを歩きました。ある日、猫は小さな花を見つけました。';
  if (sistema.includes('autor de material')) return '毎朝、公園で友達とパンを食べる。';
  if (sistema.includes('Responde únicamente')) return '接続';
  return 'En esta frase, 「食べる」 no se refiere a comer de verdad. El sentido básico es «ingerir un alimento», pero aquí es una imagen poética: quien sueña quiere absorber las estrellas rojas y azules, hacerlas parte de sí. Frente a 飲み込む, que sugiere tragarse algo entero, 食べる conserva un matiz más cotidiano e infantil, y por eso la imagen resulta tierna.';
}

export function iniciarMock() {
  const peticiones = [];
  // Para ver el avance: cada lote de traducción tarda esto.
  const control = { retardoLineas: 0, retardoFlujo: 0 };
  const servidor = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    let datos = '';
    req.on('data', (c) => (datos += c));
    req.on('end', async () => {
      const cuerpo = JSON.parse(datos || '{}');
      peticiones.push({ url: req.url, cabeceras: req.headers, cuerpo });
      const texto = respuestaPara(cuerpo);
      // Para ver en las capturas la revisión de Claude en marcha.
      if (process.env.KK_MOCK_RETARDO_ANALISIS && cuerpo.output_config?.format?.schema?.properties?.lineas?.items?.properties?.lecturas) {
        await new Promise((r) => setTimeout(r, Number(process.env.KK_MOCK_RETARDO_ANALISIS)));
      }
      if (control.retardoLineas && cuerpo.output_config?.format?.schema?.properties?.lineas && !cuerpo.output_config.format.schema.properties.lineas.items?.properties?.lecturas) {
        await new Promise((r) => setTimeout(r, control.retardoLineas));
      }
      // Para ver los estados de carga en las capturas.
      if (process.env.KK_MOCK_RETARDO) await new Promise((r) => setTimeout(r, Number(process.env.KK_MOCK_RETARDO)));
      if (!cuerpo.stream) {
        res.writeHead(200, { 'content-type': 'application/json', ...cors });
        return res.end(JSON.stringify({ id: 'msg_prueba', type: 'message', role: 'assistant', model: cuerpo.model, content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }));
      }
      if (control.retardoFlujo) await new Promise((r) => setTimeout(r, control.retardoFlujo));
      res.writeHead(200, { 'content-type': 'text/event-stream', ...cors });
      const enviar = (tipo, d) => res.write(`event: ${tipo}\ndata: ${JSON.stringify({ type: tipo, ...d })}\n\n`);
      enviar('message_start', { message: { id: 'msg_prueba', type: 'message', role: 'assistant', model: cuerpo.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: cuerpo.system?.length > 1 ? 5000 : 0, cache_creation_input_tokens: 0 } } });
      enviar('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      for (let i = 0; i < texto.length; i += 24) {
        enviar('content_block_delta', { index: 0, delta: { type: 'text_delta', text: texto.slice(i, i + 24) } });
        await new Promise((r) => setTimeout(r, 4));
      }
      enviar('content_block_stop', { index: 0 });
      enviar('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } });
      enviar('message_stop', {});
      res.end();
    });
  });
  return new Promise((ok) => {
    servidor.listen(0, '127.0.0.1', () => ok({ servidor, puerto: servidor.address().port, peticiones, control }));
  });
}
