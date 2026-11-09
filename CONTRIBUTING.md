# Contribuir a Kotonoha

Gracias por el interés. Las correcciones de las traducciones, los avisos de fallos y las mejoras son bienvenidos. [English below](#contributing-to-kotonoha-english).

## Antes de empezar

- Para un fallo o una idea, abrir primero una [incidencia](https://github.com/Eliam4510/kotonoha/issues/new/choose): así se acuerda el enfoque antes de escribir código.
- Un problema de seguridad no va en una incidencia pública: se informa como explica [SECURITY.md](SECURITY.md).
- Las traducciones de la interfaz se escribieron con ayuda de IA. Las correcciones de hablantes nativos son especialmente útiles.

## Compilar

Requiere Node.js 22 o posterior, y Chrome o Edge 120 o posterior.

```bash
git clone https://github.com/Eliam4510/kotonoha.git
```

```bash
cd kotonoha
```

```bash
npm install
```

```bash
npm run build
```

Después se carga la carpeta `dist` como extensión descomprimida, en `chrome://extensions` o `edge://extensions` con el modo de desarrollador. Al volver a compilar, la extensión detecta el cambio y se recarga sola, salvo que tenga un trabajo en marcha.

| Orden | Qué hace |
|---|---|
| `npm run dev` | Compila y vigila los cambios en `src/` |
| `npm test` | Las pruebas unitarias, con Vitest |
| `npm run typecheck` | La comprobación de tipos |
| `npm run paquete` | Deja en `release/` los ZIP de la extensión y del ayudante, con sus sumas SHA-256 |

## Cómo está organizado

| Carpeta | Contenido |
|---|---|
| `src/nucleo` | La lógica pura, sin navegador: subtítulos, libros, OCR, capa de texto, CSS de los EPUB. Es lo que cubren las pruebas unitarias |
| `src/lenguas` | Un paquete por lengua de estudio (japonés, inglés, alemán): su analizador, sus diccionarios y sus instrucciones a Claude |
| `src/motor` | El motor en un documento offscreen: base de datos, diccionarios, Claude, Whisper y grabación |
| `src/contenido` | Lo que va sobre las páginas: el reproductor de subtítulos y el lector de páginas |
| `src/app`, `src/visor`, `src/libro` | La ventana de la aplicación, el visor de la Ayuda de lectura y la página de los EPUB de texto |
| `idiomas` | Los textos de la interfaz en cada idioma |
| `docs` | La guía, las funciones, la arquitectura y los costos, en seis idiomas |

[docs/arquitectura.md](docs/arquitectura.md) explica cada parte y las decisiones técnicas.

## Pruebas

Las pruebas con navegador usan una compilación con identificador fijo, que se crea con `KK_SALIDA=.dist-subs node build.mjs`. Se ejecutan con Edge real; la variable `KK_CANAL` elige otro canal.

| Prueba | Qué comprueba |
|---|---|
| `npm test` | La lógica pura de `src/nucleo` y que las tablas de traducción estén completas |
| `node herramientas/idiomas.mjs` | Lo que falta o sobra en cada idioma |
| `node pruebas/lector.mjs` | El lector de páginas con los casos difíciles: que nada se mueva, clic, enlaces, carruseles, acordeones, texto que llega en directo, árboles de sombra y una caja con scroll como la de un chat |
| `node pruebas/lector-real.mjs` | El lector en una treintena de sitios públicos, con una captura de cada uno. Con `KK_LENGUA=en`, en sitios en inglés |
| `node pruebas/trazos-web.mjs` | El orden de los trazos con datos reales, el Portapapeles en su pestaña, la estructura de lo copiado y de lo pegado, un EPUB de texto en el visor y la vista dividida |
| `node pruebas/visor.mjs` | El visor con un manga EPUB, un CBZ y un PDF hechos en la propia prueba: importar, portadas, páginas, doble página de derecha a izquierda, zoom, vistas, índice, miniaturas, memoria de la página y borrado |
| `node pruebas/carpetas.mjs` | Una carpeta de imágenes hecha en la propia prueba: un libro por tomo, la portada delante aunque se llame cover.jpg, el ComicInfo.xml, imágenes sueltas, lo que no es imagen fuera y la doble página apaisada sola en el visor |
| `node pruebas/ocr.mjs` | El OCR con una página de libro y otra de manga hechas en la propia prueba, con la GPU: el texto leído, el panel de la línea, la ficha y lo ya leído al volver; un PDF escaneado con la capa de otro OCR, con «Texto del PDF» encendido y apagado; Editar y Restaurar; las ocho páginas que se leen por delante, y un libro procesado entero desde su tarjeta |
| `node pruebas/libros-texto.mjs` | Un PDF japonés hecho por el navegador y un EPUB vertical con trampas: el texto del PDF palabra a palabra, también en vertical; el EPUB con su CSS, su ruby y el lector encima; que nada del libro se ejecute ni cargue nada de fuera; capítulos, enlaces, índice, zoom y memoria |
| `node pruebas/ingles.mjs` | Estudiar inglés de principio a fin: elegir el idioma, instalar los diccionarios, un video, una página, y volver al japonés sin que se mezcle nada |
| `node pruebas/aleman.mjs` | Estudiar alemán de principio a fin con los diccionarios reales |
| `node pruebas/subtitulos.mjs` | Traducir, corregir, exportar e importar, en páginas que imitan a Netflix y YouTube y con una API de Claude simulada |
| `node pruebas/experiencia.mjs` | Lo que se percibe sobre el video, fotograma a fotograma: parpadeos, temblores y arrastre, y el registro del gasto |
| `node pruebas/e2e.mjs` | La extensión de extremo a extremo en Edge. Los sitios de video no sirven subtítulos a un navegador automatizado: lo de YouTube real falla ahí y se comprueba a mano |
| `node pruebas/modelos-guardados.mjs` | La lista de modelos guardados, y que borrar uno no rompa otro que comparte sus archivos |
| `node pruebas/ingles-grande.mjs` | El diccionario más grande con un perfil limpio. Descarga unos 110 MB |
| `node pruebas/letra.mjs voz.wav` | Colocar una letra sobre los tiempos de una transcripción |
| `node pruebas/modelos-voz.mjs voz.wav` | Qué modelo transcribe cada cosa |
| `node pruebas/ingles-whisper.mjs voz.wav` | Whisper en inglés en la GPU, con la corrección de Claude simulada |
| `node pruebas/dictado.mjs voz-ja.wav [voz-en.wav]` | El dictado del Portapapeles con un micrófono falso y los modelos de voz guardados en el perfil, en la GPU: grabar, transcribir, volver a oír la grabación, guardarla en la biblioteca, la limpieza de las que nadie usa, una grabación sin voz y el micrófono sin permiso. Usa `KK_SALIDA=.dist-whisper` y no borra el perfil |
| `node pruebas/tarjetas.mjs audio.wav` | Anki simulado, memoria y grabación |
| `node pruebas/sin-gpu.mjs` | Cuánto cuesta la interfaz sin aceleración por hardware |
| `node pruebas/captura-real.mjs` | El creador de tarjetas con la captura real de una pestaña. Necesita un navegador visible |
| `node pruebas/medios.mjs audio.wav` | ffmpeg.wasm con un MKV de varias pistas |
| `node pruebas/ayudante.mjs video.mp4` | El ayudante local, con descarga desde el propio equipo |
| `node pruebas/ayudante-navegador.mjs video.mp4` | Todo el camino del ayudante, desde el panel hasta Whisper en la GPU |
| `node pruebas/whisper-comparar.mjs corpus` | Precisión de los modelos con frases reales |
| `node pruebas/whisper-carga.mjs video.mp4 pruebas/sonda-escritorio.ps1 turbo 0.75 9999` | Velocidad real y fluidez del escritorio |
| `node pruebas/whisper-larga.mjs turbo 120 60 audio.pcm` | Dos horas seguidas, para detectar degradación |
| `node pruebas/whisper-recuperacion.mjs audio.pcm` | Pérdida de la GPU: esperar, seguir y detenerse al segundo fallo |

El video de prueba se genera con `node pruebas/fixtures/generar-video.mjs`.

## Textos de la interfaz

El texto en español es la clave de cada traducción: se escribe con `tr('…')` o `tm('…')` en el código.

```bash
node herramientas/idiomas.mjs --lista
```

Escribe en `idiomas/fuente.tsv` los textos que faltan, con un número cada uno. Las traducciones van en `idiomas/trabajo/<idioma>.tsv`, una por línea con el formato `número<TAB>traducción`, y se incorporan con:

```bash
node herramientas/idiomas.mjs --mezclar
```

La documentación nombra los botones y las pantallas tal como aparecen en la interfaz de cada idioma.

## Imágenes de la documentación

| Orden | Qué genera |
|---|---|
| `node herramientas/banner.mjs` | El banner del README en cada idioma |
| `node pruebas/capturas/readme.mjs` | La ficha sobre el video, el EPUB de texto, la página con OCR y, en japonés, el Portapapeles en inglés, en cada idioma de la interfaz |
| `node pruebas/capturas.mjs` | El banco de capturas de todas las pantallas, para revisar el diseño |
| `node pruebas/capturas/demo.mjs` | El GIF de demostración |

Las capturas usan textos de dominio público o escritos para ellas y una API de Claude simulada. Con la interfaz en japonés se estudia inglés: a quien habla japonés no se le enseña japonés.

## Estilo del código

- TypeScript estricto, Preact y módulos pequeños. Los identificadores y los comentarios van en español.
- Los comentarios explican el porqué, no el qué.
- Lo que no depende del navegador va en `src/nucleo`, con sus pruebas unitarias.
- Lo propio de una lengua va en su paquete de `src/lenguas`: una prueba comprueba que no haya texto japonés fuera del suyo.
- Una dependencia nueva necesita un buen motivo: el paquete de la extensión ya pasa de 40 MB.

## Pull requests

- Un cambio por pull request, con sus pruebas y, si cambia lo que se ve, una captura.
- Antes de enviarlo: `npm test`, `npm run typecheck` y las pruebas con navegador de lo que toque.
- Si cambia una función, también su documentación en los seis idiomas; quien no pueda traducirla, que lo diga y se completa en la revisión.

---

# Contributing to Kotonoha (English)

Thank you for your interest. Translation fixes, bug reports and improvements are welcome.

## Before you start

- For a bug or an idea, please open an [issue](https://github.com/Eliam4510/kotonoha/issues/new/choose) first, so the approach is agreed before any code is written.
- Security problems do not go in a public issue: report them as described in [SECURITY.md](SECURITY.md).
- The interface translations were written with the help of AI. Corrections from native speakers are especially useful.

## Building

Requires Node.js 22 or later, and Chrome or Edge 120 or later.

```bash
git clone https://github.com/Eliam4510/kotonoha.git
```

```bash
cd kotonoha
```

```bash
npm install
```

```bash
npm run build
```

Then load the `dist` folder as an unpacked extension in `chrome://extensions` or `edge://extensions` with Developer mode on. After each build, the extension notices the change and reloads itself, unless it is busy.

| Command | What it does |
|---|---|
| `npm run dev` | Builds and watches `src/` for changes |
| `npm test` | Unit tests, with Vitest |
| `npm run typecheck` | Type checking |
| `npm run paquete` | Writes the extension and helper ZIPs, with SHA-256 sums, to `release/` |

## Layout

| Folder | Contents |
|---|---|
| `src/nucleo` | Pure logic with no browser: subtitles, books, OCR, the text layer, EPUB CSS. This is what the unit tests cover |
| `src/lenguas` | One package per study language (Japanese, English, German): its analyzer, dictionaries and instructions to Claude |
| `src/motor` | The engine in an offscreen document: database, dictionaries, Claude, Whisper and recording |
| `src/contenido` | What runs on pages: the subtitle player and the page reader |
| `src/app`, `src/visor`, `src/libro` | The app window, the Reading assistant viewer and the text EPUB page |
| `idiomas` | The interface texts in each language |
| `docs` | The guide, features, architecture and costs, in six languages |

[docs/architecture.md](docs/architecture.md) describes each part and the technical decisions.

## Tests

Browser tests use a build with a fixed extension ID, created with `KK_SALIDA=.dist-subs node build.mjs`, and run with real Edge; `KK_CANAL` picks another channel. The most important ones:

| Test | What it checks |
|---|---|
| `npm test` | The pure logic in `src/nucleo` and that every translation table is complete |
| `node pruebas/lector.mjs` | The page reader on the hard cases: nothing moves, clicks, links, carousels, live text, shadow trees |
| `node pruebas/visor.mjs` | The viewer with an EPUB manga, a CBZ and a PDF built by the test itself |
| `node pruebas/carpetas.mjs` | An image folder built by the test itself: one book per volume, the cover first even when it is called cover.jpg, ComicInfo.xml, loose images, non-images left out and the landscape spread on its own in the viewer |
| `node pruebas/ocr.mjs` | OCR on a book page and a manga page, on the GPU, a scanned PDF with another OCR's layer, with PDF text on and off, Edit and Restore, the eight pages read ahead, and a whole book processed from its card |
| `node pruebas/libros-texto.mjs` | A Japanese PDF made by the browser and a vertical EPUB with traps: word taps in the PDF, the EPUB with its CSS and ruby, nothing from the book runs or loads anything from outside |
| `node pruebas/trazos-web.mjs` | Stroke order, the Clipboard and its structure, a text EPUB in the viewer, split view |
| `node pruebas/dictado.mjs voz-ja.wav [voz-en.wav]` | Dictation into the Clipboard with a fake microphone and the speech models stored in the profile, on the GPU: recording, transcribing, playing the recording again, the library, cleaning up unused recordings, a silent recording and a microphone without permission |
| `node pruebas/ingles.mjs`, `node pruebas/aleman.mjs` | Studying English and German end to end |
| `node pruebas/e2e.mjs` | The extension end to end in Edge. Video sites do not serve subtitles to an automated browser, so the real YouTube checks fail there and are verified by hand |

The full list, with the speech and helper tests, is in the Spanish section above.

## Interface texts

The Spanish text is the key of each translation: it is written with `tr('…')` or `tm('…')` in the code. `node herramientas/idiomas.mjs --lista` writes the missing texts to `idiomas/fuente.tsv`; translations go in `idiomas/trabajo/<language>.tsv` as `number<TAB>translation` lines and are merged with `node herramientas/idiomas.mjs --mezclar`. The documentation names buttons and screens exactly as they appear in each language’s interface.

## Documentation images

`node herramientas/banner.mjs` draws the README banners, and `node pruebas/capturas/readme.mjs` takes the README screenshots in every interface language, with public-domain texts and a simulated Claude API. With the interface in Japanese, the screenshots study English: Japanese speakers are not taught Japanese.

## Code style

- Strict TypeScript, Preact and small modules. Identifiers and comments are in Spanish.
- Comments explain why, not what.
- Anything that does not depend on the browser goes in `src/nucleo`, with unit tests.
- Anything specific to one language goes in its package in `src/lenguas`.
- A new dependency needs a good reason: the extension package is already over 40 MB.

## Pull requests

- One change per pull request, with its tests and, if it changes what is shown, a screenshot.
- Before sending it: `npm test`, `npm run typecheck` and the browser tests for what it touches.
- If a feature changes, so does its documentation in the six languages; if you cannot translate it, say so and it will be completed during review.
