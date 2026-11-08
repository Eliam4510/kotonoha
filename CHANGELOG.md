# Novedades

Un resumen de cada versión. Las notas completas, con lo probado y los paquetes, están en [Releases](https://github.com/Eliam4510/kotonoha/releases). [English below](#whats-new).

## 0.9.2 · 2026-11-08

- **Un OCR de manga más fino.** Lee bien los puntos suspensivos («……»), deja fuera las marcas de agua y los números de página, y sigue el orden de las viñetas. En 18 páginas de cinco series, el error baja del 4,3 % al 2,8 % y los textos falsos, de 11 a 4; en las tres páginas de referencia de un tomo en EPUB, del 2,5 % al 0,5 %.
- **Libros de estudio y a dos columnas.** El furigana impreso ya no se cuela como texto aunque lo lleve casi cada kanji, y una página a dos columnas se lee columna a columna.

## 0.9.1 · 2026-11-08

- **Carpetas de imágenes.** El manga que viene en imágenes entra en la Ayuda de lectura eligiendo la carpeta o arrastrándola: cada carpeta, o cada tomo dentro de ella, es un libro, con la portada delante, el título de la serie y un índice por capítulos si viene en carpetas. Se guarda como un CBZ, sin copiar las imágenes en memoria: 40 tomos reales, 3,3 GB, entran en unos 40 segundos.
- **Dobles páginas enteras.** En doble página, una doble escaneada de una pieza, como las páginas a color del principio de un tomo, va sola.
- Las imágenes sueltas también se importan: juntas, son un libro. Y un CBZ con la portada llamada cover.jpg ya la pone delante.

## 0.9.0 · 2026-11-08

- **EPUB de texto con su propio formato.** Una novela se ve en el visor como la hizo su editorial: capítulos, CSS, ruby, ilustraciones y escritura vertical, con el lector de páginas encima. Índice, zoom, enlaces entre capítulos y memoria del punto exacto donde se dejó.
- **PDF con texto, sin OCR.** El texto que trae el propio PDF se lee al instante, también en columnas verticales.
- **Tocar una palabra en la página** abre su ficha directamente, en los PDF con texto y en las páginas leídas con el OCR, y la marca sobre la página.
- Correcciones: el Portapapeles analizaba mal el texto en inglés y alemán con varios párrafos al abrirse en su pestaña; la etiqueta del tipo de uso de la ficha no se traducía; los botones activos del visor apenas se veían en el tema oscuro.

## 0.8.0 · 2026-11-08

- El visor lee el texto de las páginas de imagen con reconocimiento de texto (OCR) en el propio equipo y con la GPU: un modo para libros impresos (PP-OCRv5) y otro para manga (detector de globos y manga-ocr).
- Al tocar una línea se abre con furigana, palabras para consultar, su ficha y la creación de tarjetas. Cada página se lee una sola vez y se guarda.

## 0.7.0 · 2026-11-08

- La Ayuda de lectura estrena su visor, como un lector de PDF: EPUB de imágenes, CBZ y PDF, con zoom, doble página, desplazamiento continuo, sentido de lectura, índice y miniaturas.

## 0.6.0 · 2026-11-07

- El Portapapeles conserva la estructura de lo que se copia: párrafos, títulos, listas, tablas y el Markdown del chat de Claude.
- La biblioteca pasa a llamarse Ayuda de lectura.

## 0.5.1 · 2026-11-07

- El alemán, probado en YouTube, y los subtítulos automáticos con su puntuación.

## 0.5.0 · 2026-11-07

- El alemán como tercera lengua de estudio, con su analizador, sus diccionarios de Wiktionary y la voz transcrita por Parakeet.

## 0.4.3 · 2026-11-07

- Un modelo propio para la voz en inglés, y el inglés más pulido.

## 0.4.2 · 2026-11-07

- Un modelo nuevo para la voz en japonés, y letras de canciones que ya no pierden versos.

## 0.4.1 · 2026-11-07

- Letras de canciones: Claude coloca la letra pegada sobre los tiempos de la transcripción.
- Una lista de los modelos de voz guardados.

## 0.4.0 · 2026-11-07

- El inglés como lengua de estudio, con su analizador, sus diccionarios y su pronunciación en IPA. Cada idioma guarda lo suyo y se cambia con un clic.

## 0.3.0 · 2026-11-07

- La interfaz en seis idiomas, una bienvenida que pregunta por el idioma y el nivel, y el lector de páginas que colorea y añade furigana sin romper la página.

## 0.2.2 a 0.2.5 · 2026-11-05 y 2026-11-06

- La primera versión compilada para Chrome y Edge, y mejoras en el creador de tarjetas, sobre todo en Netflix, en los atajos y en la fluidez sin aceleración por hardware.

---

# What’s new

A summary of each release. The full notes, with what was tested and the packages, are in [Releases](https://github.com/Eliam4510/kotonoha/releases).

## 0.9.2 · 2026-11-08

- **Sharper manga OCR.** It reads ellipses («……») properly, leaves watermarks and page numbers out and follows the order of the panels. On 18 pages from five series, the error drops from 4.3 % to 2.8 % and false text from 11 to 4; on the three reference pages of a volume in EPUB, from 2.5 % to 0.5 %.
- **Study books and two columns.** Printed furigana no longer slips in as text even when nearly every kanji carries it, and a two-column page is read column by column.

## 0.9.1 · 2026-11-08

- **Image folders.** Manga that comes as images enters the Reading assistant by choosing or dragging the folder: each folder, or each volume inside it, becomes a book, with the cover first, the series title and a table of contents by chapter when it comes in folders. It is stored as a CBZ, without copying the images into memory: 40 real volumes, 3.3 GB, come in in about 40 seconds.
- **Whole two-page spreads.** In a two-page spread, a spread scanned in one piece, such as the colour pages at the start of a volume, stands on its own.
- Loose images can be imported too: together, they make one book. And a CBZ whose cover is called cover.jpg now puts it first.

## 0.9.0 · 2026-11-08

- **Text EPUBs in their own format.** A novel looks in the viewer the way its publisher made it: chapters, CSS, ruby, illustrations and vertical writing, with the page reader on top. Table of contents, zoom, links between chapters and the exact spot where you left off.
- **PDFs with text, without OCR.** The text inside the PDF is read at once, vertical columns included.
- **Tapping a word on the page** opens its word panel directly, in PDFs with text and in pages read with OCR, and marks it on the page.
- Fixes: the Clipboard misanalysed English and German text with several paragraphs when opened in its tab; the word panel’s usage label was not translated; active viewer buttons were barely visible in the dark theme.

## 0.8.0 · 2026-11-08

- The viewer reads the text of image pages with on-device text recognition (OCR) on the GPU: a mode for printed books (PP-OCRv5) and another for manga (bubble detector and manga-ocr).
- Tapping a line opens it with furigana, words to look up, its word panel and card creation. Each page is read once and saved.

## 0.7.0 · 2026-11-08

- The Reading assistant gets its viewer, like a PDF reader: image-based EPUB, CBZ and PDF, with zoom, two-page spreads, continuous scrolling, reading direction, table of contents and thumbnails.

## 0.6.0 · 2026-11-07

- The Clipboard keeps the structure of what is copied: paragraphs, headings, lists, tables and the Markdown from Claude’s chat.
- The library is now called Reading assistant.

## 0.5.1 · 2026-11-07

- German, tested on YouTube, and automatic subtitles with their punctuation.

## 0.5.0 · 2026-11-07

- German as a third study language, with its analyzer, Wiktionary dictionaries and speech transcribed by Parakeet.

## 0.4.3 · 2026-11-07

- A model of its own for English speech, and a more polished English.

## 0.4.2 · 2026-11-07

- A new model for Japanese speech, and song lyrics that no longer lose verses.

## 0.4.1 · 2026-11-07

- Song lyrics: Claude places pasted lyrics on the transcription’s timing.
- A list of saved speech models.

## 0.4.0 · 2026-11-07

- English as a study language, with its analyzer, dictionaries and IPA pronunciation. Each language keeps its own data, and switching takes one click.

## 0.3.0 · 2026-11-07

- The interface in six languages, a welcome screen that asks for language and level, and the page reader that colours text and adds furigana without breaking the page.

## 0.2.2 to 0.2.5 · 2026-11-05 and 2026-11-06

- The first compiled release for Chrome and Edge, and improvements to the card creator, above all on Netflix, to shortcuts and to smoothness without hardware acceleration.
