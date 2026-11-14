// El cargador del diccionario de Kuromoji en el navegador: descomprime con el propio navegador (DecompressionStream) en
// vez de con zlibjs, que lo hacía en JavaScript, el doble de lento y con más memoria por el camino. Sustituye al
// BrowserDictionaryLoader de Kuromoji al empaquetarlo desde sus fuentes (herramientas/kuromoji.mjs).
'use strict';

const DictionaryLoader = require('kuromoji/src/loader/DictionaryLoader');

function KuromojiCargador(dicPath) {
  DictionaryLoader.apply(this, [dicPath]);
}
KuromojiCargador.prototype = Object.create(DictionaryLoader.prototype);

KuromojiCargador.prototype.loadArrayBuffer = function (url, callback) {
  fetch(url)
    .then((r) => {
      if (!r.ok || !r.body) throw new Error(`${url}: ${r.status} ${r.statusText}`);
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    })
    // El segundo argumento solo recoge los fallos de la descarga: un fallo de Kuromoji al leer el archivo no vuelve a
    // llamar a callback.
    .then(
      (buffer) => callback(null, buffer),
      (e) => callback(e, null)
    );
};

module.exports = KuromojiCargador;
