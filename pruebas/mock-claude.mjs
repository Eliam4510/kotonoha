// Servidor falso de la API de Claude para pruebas y capturas: no gasta nada y responde al instante.
// Registra cada petición para comprobar que el cliente envía lo que debe.

import { createServer } from 'node:http';
import { DIETA } from './capturas/contenido-real.mjs';

/**
 * Lo que se lee en las capturas de la documentación, en cada idioma de la interfaz: el sentido de 食べる en la frase del
 * sueño y su traducción. Las pruebas usan el español, que es lo de siempre.
 */
const TEXTOS = {
  es: { sentido: 'absorber, hacer suyo', nota: 'En esta frase, «comer» las estrellas es una imagen de hacerlas parte de uno mismo, no de comer de verdad.', traduccion: 'Soñé que devoraba estrellas rojas y azules' },
  en: { sentido: 'to absorb, to make one’s own', nota: 'Here “eating” the stars is an image of making them part of oneself, not of eating them for real.', traduccion: 'I dreamed I devoured red and blue stars' },
  de: { sentido: 'in sich aufnehmen, sich zu eigen machen', nota: 'Hier ist das „Essen“ der Sterne ein Bild dafür, sie sich zu eigen zu machen, nicht wörtliches Essen.', traduccion: 'Ich träumte, ich verschlänge rote und blaue Sterne' },
  zh: { sentido: '吸收，化为己有', nota: '这里“吃”星星是一种意象，指把星星化为自己的一部分，并不是真的吃。', traduccion: '我梦见自己吞下了红色和蓝色的星星' },
  ko: { sentido: '흡수하다, 제 것으로 만들다', nota: '여기서 별을 ‘먹는다’는 것은 별을 자기 일부로 만든다는 비유이지, 실제로 먹는다는 뜻이 아닙니다.', traduccion: '빨간 별과 파란 별을 삼키는 꿈을 꿨다' },
};

/** Lo que explica Claude de 〜ことができる en la frase del video de pruebas, en cada idioma de la interfaz. */
const PODER = {
  es: 'Aquí 〜ことができる dice que alguien es capaz de hacer algo: 立ち上がることができます, «todavía puedo levantarme». Se forma con el verbo en forma de diccionario más ことができる, y suena algo más formal que la forma potencial (立ち上がれます).',
  en: 'Here 〜ことができる says that someone is able to do something: 立ち上がることができます, “I can still stand up”. It is formed with the dictionary form of the verb plus ことができる, and it sounds a little more formal than the potential form (立ち上がれます).',
  de: 'Hier sagt 〜ことができる, dass jemand etwas tun kann: 立ち上がることができます, „ich kann noch aufstehen“. Es wird mit der Wörterbuchform des Verbs und ことができる gebildet und klingt etwas förmlicher als die Potentialform (立ち上がれます).',
  zh: '这里的〜ことができる表示有能力做某事：立ち上がることができます，“我还能站起来”。由动词的辞书形加ことができる构成，比可能形（立ち上がれます）听起来更正式一些。',
  ko: '여기서 〜ことができる는 어떤 일을 할 수 있다는 뜻입니다. 立ち上がることができます는 “아직 일어설 수 있습니다”입니다. 동사 사전형에 ことができる를 붙여 만들며, 가능형(立ち上がれます)보다 조금 더 격식 있게 들립니다.',
};

/**
 * Lo que dice Claude en las imágenes del README con contenido real (capturas/contenido-real.mjs): un discurso en la Dieta.
 * 担い手 en «スタートアップは、技術を実用化していく主要な担い手です。», 実用化 en la misma frase (el GIF, en español) y
 * 〜ための en «投資を強力に促進していくための認定制度を創設します。».
 */
const NINAITE = {
  es: { significado: 'quien lleva adelante algo', nota: 'Literalmente, quien carga algo a hombros. Aquí son las startups las que llevan la tecnología a la práctica: el motor de ese trabajo.' },
  en: { significado: 'the one who carries something forward', nota: 'Literally, someone who carries a load on their shoulders. Here it is the startups that carry technology into practical use: the driving force behind it.' },
  de: { significado: 'Träger, wer etwas vorantreibt', nota: 'Wörtlich jemand, der eine Last auf den Schultern trägt. Hier sind es die Start-ups, die Technik in die Praxis bringen: die treibende Kraft dahinter.' },
  zh: { significado: '承担者，主力', nota: '字面意思是用肩膀扛东西的人。这里指初创企业是把技术推向实用的主要力量。' },
  ko: { significado: '짊어지는 사람, 주역', nota: '글자 그대로는 어깨에 짐을 지는 사람입니다. 여기서는 기술을 실용화로 이끄는 주체, 곧 스타트업을 가리킵니다.' },
};
const JITSUYOKA = { significado: 'llevar a la práctica', uso: 'literal', nota: 'Que una técnica salga del laboratorio y se convierta en productos y servicios que se usan de verdad.', definicion: 0 };
const PARA = {
  es: 'Aquí 〜ための indica la finalidad de lo que sigue: 促進していくための認定制度, «un sistema de certificación para impulsar» la inversión. Se forma con el verbo en forma de diccionario más ため; delante de un nombre lleva の (ための). Es propio del lenguaje formal, como el de un discurso.',
  en: 'Here 〜ための expresses the purpose of what follows: 促進していくための認定制度, “a certification system to promote” investment. It is formed with the dictionary form of the verb plus ため; before a noun it takes の (ための). It belongs to formal language, like that of a speech.',
  de: 'Hier gibt 〜ための den Zweck des Folgenden an: 促進していくための認定制度, „ein Zertifizierungssystem, um Investitionen zu fördern“. Es wird mit der Wörterbuchform des Verbs und ため gebildet; vor einem Nomen steht の (ための). Es gehört zur förmlichen Sprache, wie der einer Rede.',
  zh: '这里的〜ための表示后面名词的目的：促進していくための認定制度，“为了促进投资的认定制度”。由动词辞书形加ため构成，修饰名词时加の（ための）。多用于正式场合，如演讲。',
  ko: '여기서 〜ための는 뒤에 오는 명사의 목적을 나타냅니다. 促進していくための認定制度는 “투자를 촉진하기 위한 인증 제도”입니다. 동사 사전형에 ため를 붙여 만들고, 명사 앞에서는 の를 붙입니다(ための). 연설처럼 격식 있는 말에서 많이 씁니다.',
};
/** La traducción de una línea del discurso: la frase de la traducción que suena a la vez. */
function traduccionDelDiscurso(texto, idioma) {
  const linea = DIETA.lineas.find(([, , l]) => texto.includes(l));
  if (!linea) return null;
  const k = DIETA.tiemposTraduccion.findIndex(([a, b]) => linea[0] >= a && linea[0] < b);
  return (DIETA.traducciones[idioma] ?? DIETA.traducciones.en)[k] ?? null;
}

/** Si la petición es una traducción de subtítulos: líneas con su texto, sin lecturas. */
const esTraduccionDeLineas = (cuerpo) => {
  const lineas = cuerpo.output_config?.format?.schema?.properties?.lineas;
  return !!lineas && !lineas.items?.properties?.lecturas;
};

function respuestaPara(cuerpo, idioma = 'es', negativa = null) {
  const t = TEXTOS[idioma] ?? TEXTOS.es;
  const formato = cuerpo.output_config?.format?.schema;
  const texto = JSON.stringify(cuerpo.messages ?? '');
  const sistema = JSON.stringify(cuerpo.system ?? '');
  if (formato?.properties?.significado && texto.includes('Palabra: 赤い')) {
    return JSON.stringify({ significado: 'rojas, del color del fuego', uso: 'literal', nota: 'Aquí describe el color de las estrellas del sueño: es el sentido habitual de la palabra.', definicion: 0 });
  }
  // La tarjeta para compartir del README japonés, que presenta el inglés.
  if (formato?.properties?.significado && idioma === 'ja' && texto.includes('Palabra: tired')) {
    return JSON.stringify({ significado: 'うんざりして、飽きて', uso: 'expresion', nota: 'ここでは体の疲れではなく、何もせずに座っていることにうんざりしている気持ちです。tired of で「〜に飽きる」。', definicion: 0 });
  }
  if (formato?.properties?.significado && texto.includes('Palabra: 担い手')) {
    const n = NINAITE[idioma] ?? NINAITE.es;
    return JSON.stringify({ significado: n.significado, uso: 'figurado', nota: n.nota, definicion: 0 });
  }
  if (formato?.properties?.significado && texto.includes('Palabra: 実用化')) return JSON.stringify(JITSUYOKA);
  if (formato?.properties?.significado) {
    return JSON.stringify({ significado: t.sentido, uso: 'figurado', nota: t.nota, definicion: 0 });
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
        sentidos: t.includes('星を食べる')
          ? [{ superficie: '食べる', significado: TEXTOS[idioma]?.sentido ?? TEXTOS.es.sentido, uso: 'poetico' }]
          : t.includes('担い手')
            ? [{ superficie: '担い手', significado: (NINAITE[idioma] ?? NINAITE.es).significado, uso: 'figurado' }]
            : [],
        gramatica: t.includes('続けると思います')
          ? [{ fragmento: 'と思います', patron: '〜と思う', nivel: 'N4', significado: 'Creo que…' }]
          : t.includes('ことができます')
            ? [{ fragmento: 'ことができます', patron: '〜ことができる', nivel: 'N4', significado: 'Poder hacer algo' }]
            : t.includes('していくための')
              ? [{ fragmento: 'ための', patron: '〜ために', nivel: 'N3', significado: 'Para…: la finalidad' }]
            : t.includes('でも')
              ? [{ fragmento: 'でも', patron: '〜でも', nivel: 'N4', significado: 'Incluso…, aunque…' }]
              : [],
      })),
    });
  }
  if (formato?.properties?.ajuste) {
    // Lo que se le pide a Claude, en tosco. Recorre lo oído en orden y dice qué versos caben casi enteros en cada línea,
    // así que un estribillo que vuelve se repite aunque la letra lo escriba una vez; las marcas de sección y las órdenes
    // de repetir no se cantan. Si así apenas reconoce la letra (lo oyó mal), empareja cada verso con la línea que más se
    // le parece, sin volver atrás.
    const contenido = cuerpo.messages?.[0]?.content ?? '';
    const [, transcripcion = '', letra = ''] = /TRANSCRIPCIÓN:\n([\s\S]*?)\n\nLETRA:\n([\s\S]*)$/.exec(contenido) ?? [];
    const piezas = (t) => new Set(t.toLowerCase().match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}']+/gu) ?? []);
    const lineas = transcripcion.split('\n').map((l) => piezas(l.replace(/^\d+ \[[^\]]*\] /, '')));
    // Los renglones por su número: entre estrofas va una línea en blanco.
    const renglones = [...letra.matchAll(/^(\d+): (.*)$/gm)].map(([, n, t]) => ({ v: Number(n), t, p: piezas(t) }));
    const esMarca = (t) => /^\[.*\]$/.test(t) || /repeat|繰り返し|くり返し/i.test(t);
    const marcas = renglones.filter((x) => esMarca(x.t)).map((x) => ({ v: x.v, de: -2, a: -2 }));
    const versos = renglones.filter((x) => !esMarca(x.t));
    const porLineas = [];
    lineas.forEach((l, i) => {
      for (const x of versos) if (x.p.size && [...x.p].filter((y) => l.has(y)).length >= Math.ceil(x.p.size * 0.6)) porLineas.push({ v: x.v, de: i, a: i });
    });
    const oidos = new Set(porLineas.map((e) => e.v));
    if (versos.length && oidos.size * 2 >= versos.length) {
      return JSON.stringify({ ajuste: [...porLineas, ...versos.filter((x) => !oidos.has(x.v)).map((x) => ({ v: x.v, de: -1, a: -1 })), ...marcas] });
    }
    const ajuste = [...marcas];
    let cursor = 0;
    for (const { v, p } of versos) {
      const comunes = (i) => [...p].filter((x) => lineas[i].has(x)).length;
      let de = -1;
      let mejor = 0;
      for (let i = cursor; i < lineas.length; i++) {
        if (comunes(i) > mejor) {
          mejor = comunes(i);
          de = i;
        }
      }
      if (de < 0) {
        ajuste.push({ v, de: -1, a: -1 });
        continue;
      }
      // Un verso largo puede ocupar varias líneas: las de al lado que estén casi enteras en él son suyas.
      const suya = (i) => comunes(i) >= Math.ceil(lineas[i].size * 0.6);
      let a = de;
      while (a + 1 < lineas.length && suya(a + 1)) a++;
      while (de - 1 >= cursor && suya(de - 1)) de--;
      ajuste.push({ v, de, a });
      cursor = de;
    }
    return JSON.stringify({ ajuste });
  }
  if (formato?.properties?.cambios) {
    // La revisión del texto de una página con su imagen: cambia lo que un OCR suele leer mal y deja el resto tal cual.
    // La última línea del mensaje acaba en la comilla que cierra el texto, no en un salto de línea.
    const cambios = [...texto.matchAll(/(\d+): ([^\\"]+)/g)]
      .filter((m) => /工ネルギー|イ才ン/.test(m[2]))
      .map((m) => ({ i: Number(m[1]), t: m[2].replace('工ネルギー', 'エネルギー').replace('イ才ン', 'イオン') }));
    return JSON.stringify({ cambios });
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
    const pedidas = [...texto.matchAll(/(\d+): ([^\\]+)/g)].map((m) => ({ i: Number(m[1]), t: `[traducción de ${m[1]}]`, verso: /花|星/.test(m[2]) }));
    // Con `negativa`, Claude no traduce dos versos (los de 花 y 星): o escribe su disculpa en su sitio, como hizo con una
    // canción de verdad, o los deja fuera y lo dice aparte.
    if (negativa === 'disculpa') return JSON.stringify({ lineas: pedidas.map(({ i, t, verso }) => ({ i, t: verso ? 'Lo siento, no puedo traducir la letra de esta canción porque está protegida por derechos de autor.' : t })) });
    if (negativa === 'aparte') return JSON.stringify({ lineas: pedidas.filter((x) => !x.verso).map(({ i, t }) => ({ i, t })), sin_traducir: 'Son versos de una canción protegida por derechos de autor.' });
    return JSON.stringify({ lineas: pedidas.map(({ i, t }) => ({ i, t })) });
  }
  if (sistema.includes('desglosa frases')) {
    return '## 赤い星と青い\nSignificado: una estrella roja y una azul\nExplicación: と une los dos nombres, y el adjetivo 青い modifica al sustantivo que sigue.\n\n## 星を\nSignificado: a las estrellas\nExplicación: を marca el objeto directo de la acción.\n\n## 食べる\nSignificado: las devora, las hace suyas\nExplicación: Forma de diccionario del verbo. En la letra tiene un sentido figurado, no literal.';
  }
  if (sistema.includes('traductor profesional')) return traduccionDelDiscurso(texto, idioma) ?? t.traduccion;
  if (sistema.includes('gramática inglesa')) return 'Aquí used to habla de un hábito del pasado que ya no se da. Se forma con used to más el verbo en infinitivo. No se confunde con be used to, que significa estar acostumbrado.';
  // El globo de gramática del video de pruebas, en el idioma de cada captura.
  if (sistema.includes('gramática japonesa') && texto.includes('ことができ')) return PODER[idioma] ?? PODER.es;
  if (sistema.includes('gramática japonesa') && texto.includes('ための')) return PARA[idioma] ?? PARA.es;
  if (sistema.includes('gramática japonesa')) return 'Aquí 〜と思う presenta lo que dice el hablante como su opinión o intención, y suaviza la afirmación. Se forma con la forma simple del verbo más と思う. Se confunde con 〜と考える, más reflexivo y formal.\n\n明日は雨だと思う。 Creo que mañana lloverá.';
  // «Organizar» del Cuaderno: el mismo texto con un título, sus párrafos y una lista, como haría Claude con el de prueba.
  if (sistema.includes('Organizas un texto')) {
    const contenido = String(cuerpo.messages?.[0]?.content ?? '');
    const [titulo, ...resto] = contenido.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const lista = resto.filter((l) => l.startsWith('・')).map((l) => `- ${l.slice(1).trim()}`);
    const parrafos = resto.filter((l) => !l.startsWith('・'));
    return [`# ${titulo}`, ...parrafos, lista.join('\n')].filter(Boolean).join('\n\n');
  }
  if (sistema.includes('autor de lecturas')) return '猫の散歩\n\n京都に猫がいました。猫は毎日、川の近くを歩きました。ある日、猫は小さな花を見つけました。';
  if (sistema.includes('autor de material')) return '毎朝、公園で友達とパンを食べる。';
  if (sistema.includes('Responde únicamente')) return '接続';
  return 'En esta frase, 「食べる」 no se refiere a comer de verdad. El sentido básico es «ingerir un alimento», pero aquí es una imagen poética: quien sueña quiere absorber las estrellas rojas y azules, hacerlas parte de sí. Frente a 飲み込む, que sugiere tragarse algo entero, 食べる conserva un matiz más cotidiano e infantil, y por eso la imagen resulta tierna.';
}

export function iniciarMock() {
  const peticiones = [];
  // Para ver el avance: cada lote de traducción tarda esto. `idioma` es el de las respuestas de las capturas. `negativa`
  // hace que Claude no traduzca algo: 'disculpa', 'aparte' o 'rechazo' (la API contesta con stop_reason refusal).
  const control = { retardoLineas: 0, retardoFlujo: 0, idioma: 'es', negativa: null };
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
      const rechazo = control.negativa === 'rechazo' && esTraduccionDeLineas(cuerpo);
      const texto = rechazo ? '' : respuestaPara(cuerpo, control.idioma, control.negativa);
      const fin = rechazo ? 'refusal' : 'end_turn';
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
        return res.end(JSON.stringify({ id: 'msg_prueba', type: 'message', role: 'assistant', model: cuerpo.model, content: [{ type: 'text', text: texto }], stop_reason: fin, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }));
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
      enviar('message_delta', { delta: { stop_reason: fin, stop_sequence: null }, usage: { output_tokens: 20 } });
      enviar('message_stop', {});
      res.end();
    });
  });
  return new Promise((ok) => {
    servidor.listen(0, '127.0.0.1', () => ok({ servidor, puerto: servidor.address().port, peticiones, control }));
  });
}
