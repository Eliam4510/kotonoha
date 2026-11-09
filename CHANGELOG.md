# Novedades

Un resumen de cada versión. Las notas completas, con lo probado y los paquetes, están en [Releases](https://github.com/Eliam4510/kotonoha/releases). [English below](#whats-new).

## 0.20.0 · 2026-11-09

- **Kanji que ya conoces.** En la pestaña **Trazos** de la ficha, **Con estos kanji ya conoces** reúne, para cada kanji de la palabra, las que ya sabes o estás aprendiendo con él: 冷蔵庫 trae 冷たい, 車庫 y 金庫. El kanji nuevo se recuerda a partir de lo que ya se sabe.
- **Horas de inmersión.** Kotonoha cuenta el tiempo que escuchas y lees la lengua que estudias: videos en marcha con sus subtítulos, también archivos propios, libros en el visor y lo que lees en el Portapapeles y la biblioteca. **Inicio** enseña las horas de hoy, de la semana y del total, la racha de días seguidos, una barra por día y lo que más has visto y leído. La copia de seguridad la incluye.

## 0.19.0 · 2026-11-09

- **Moras especiales en la práctica del acento.** Con **Comprobar también っ, ん y vocales largas**, la práctica dice si en la grabación falta o sobra una っ (きて por きって), una ん (かじ por かんじ) o una vocal larga (おばさん por おばあさん), y marca la mora en el acento esperado. Lo oye en el equipo narabas, un modelo de fonemas del japonés que se descarga la primera vez (1,26 GB), se comprueba con su SHA-256 y va en la GPU solo si calcula igual que el procesador. Medido con pares mínimos dichos por dos voces sintéticas: vio 17 de 22 moras que faltaban y 10 de 10 de más, y no avisó de nada en 22 de 24 frases bien dichas.

## 0.18.0 · 2026-11-09

- **Cómics en inglés y alemán.** En el visor, el modo **Cómic** lee cada globo con el reconocedor de libros, en el orden de las viñetas y de izquierda a derecha; antes, el modo Manga solo sabía japonés. Medido: un 0,4 % de error por carácter en páginas de prueba en los dos idiomas y un 12 % en una página real de 1922 rotulada a mano.
- **OCR medido en inglés y alemán.** Un 1,5 % de error en un escaneo real del siglo XIX en inglés y un 0,03 % en páginas de prueba en alemán. La letra gótica (Fraktur) no se lee.
- **Voces neuronales en el navegador.** Kokoro lee el inglés, con seis voces, y Piper el alemán, con la voz de Thorsten, en el propio equipo y sin clave. Whisper Turbo entendió sin errores las frases de prueba de las dos.

## 0.17.0 · 2026-11-09

- **Ayudante sin Python.** El ayudante local está escrito en PowerShell, que viene con Windows, y usa el `yt-dlp.exe` oficial con QuickJS para YouTube. `Instalar.cmd` se ejecuta con un doble clic: copia el ayudante a su sitio, baja yt-dlp y QuickJS comprobando su SHA-256, encuentra Kotonoha en Chrome, Edge, Brave y Chromium, y, si no hay ninguna copia, instala también la extensión con un identificador fijo. FFmpeg ya no hace falta: sin él, la extensión convierte el audio con su propio FFmpeg.
- **Actualizar ahora.** Con el ayudante instalado, el aviso de versión nueva y **Ajustes, Versión** la ponen con un clic: el ayudante baja el paquete, comprueba su SHA-256, lo copia sobre la carpeta de la extensión conservando su identificador, y la extensión se recarga sola.
- **Copia completa.** **Ajustes, Tus datos** exporta a una carpeta, además de lo de siempre, los archivos de los libros, el texto del OCR y los dictados, y los restaura en otra copia o en otro equipo. Ninguna copia lleva ya las claves de API.
- Material para publicar en Edge Add-ons y Chrome Web Store: ficha, justificación de los permisos, capturas y [política de privacidad](docs/privacidad.md).

## 0.16.0 · 2026-11-08

- **Otros proveedores de IA.** Además de Claude, OpenRouter, DeepSeek y OpenAI con su clave, y LM Studio y Ollama en el propio equipo: se añaden en **Ajustes, Otros proveedores de IA**, con sus modelos y una prueba de conexión, y en **Modelo y esfuerzo por tarea** cada tarea elige el suyo. Las respuestas llegan en flujo; las que piden estructura van con su esquema JSON o, si el proveedor no lo admite, en modo JSON. El gasto se anota con el coste que dice el proveedor. Claude sigue siendo el de siempre.

## 0.15.0 · 2026-11-08

- **Voz japonesa local.** Con AivisSpeech o VOICEVOX abiertos en el equipo, Kotonoha lee las frases con ellos: en voz alta, en la práctica, en la ficha y en el audio de las tarjetas. Los encuentra solo, se elige la voz en **Ajustes, Voces** y lee con el acento del diccionario, que corrige antes de leer. Los audios quedan en una caché. Medido en el equipo de desarrollo: AivisSpeech coincide con el diccionario en 37 de 37 frases acentuales y lee una frase en 0,6 s con el procesador.
- **Práctica del acento.** Señala menos errores que no lo son: la caída hacia la última mora antes de una pausa ya vale como la del núcleo (〜ました, 橋を。), y las expresiones del diccionario con partícula (雨が降る) se juzgan palabra por palabra.

## 0.14.0 · 2026-11-08

- **Practicar el acento tonal.** En el Portapapeles, los textos de la Ayuda de lectura y la vista de texto, **Practicar** enseña el acento de cada palabra de la frase, graba cómo se lee y pone la curva del tono de la voz sobre la esperada, con un veredicto por palabra (**Bien**, **Revisar**, **Sin juzgar**) y las pausas largas. El tono se mide en el navegador y la grabación se transcribe en el equipo con Haas-ja; no se guarda ni sale del equipo.

## 0.13.1 · 2026-11-08

- **Cambiar de idioma a la vista.** Inicio tiene un selector con las tres lenguas, cada una con su bandera y su nombre, y la barra lateral muestra la que se estudia, con un menú para cambiarla.
- **Aviso de versiones nuevas.** Una vez al día, Kotonoha mira en GitHub la última versión publicada y, si es más nueva, lo dice en Inicio y en el menú de la extensión. **Ajustes, Versión** muestra la versión instalada, busca a mano y apaga el aviso.
- **Voz del navegador.** Sin clave de Azure, la lectura en voz alta y la ficha usan la mejor voz del navegador, como las «Natural» de Edge o las de Google en Chrome, en lugar de dejar que el navegador elija. En **Ajustes, Voces** se puede elegir otra para cada idioma.
- La orden de instalación del ayudante, en **Ajustes, Transcripción**, lleva ya el identificador de la extensión y se ejecuta en la carpeta del zip descargado, con un enlace a la descarga.

## 0.13.0 · 2026-11-08

- **Dictar al Portapapeles.** **Dictar** graba con el micrófono y añade lo dicho al final del texto, ya analizado y con furigana. Se transcribe en el equipo con el modelo de voz de los ajustes (Haas-ja en japonés, Parakeet en inglés y alemán), y la grabación queda encima de su párrafo para volver a oírla, también en la biblioteca.
- Con Parakeet, en inglés y en alemán, una frase larga partida en dos líneas ya no pega la primera palabra de la segunda línea al final de la primera, tampoco en los subtítulos generados.

## 0.12.0 · 2026-11-08

- **Buscar en el libro.** **Buscar en el libro**, o Ctrl+F, encuentra una palabra en todas las páginas con texto, el del PDF o el del OCR, sin distinguir anchos ni hiragana y katakana, y también partida entre dos renglones. Lo encontrado sale por páginas y queda marcado en la página; Intro pasa al siguiente.
- **Vista de texto.** **Ver como texto** muestra la página como texto, en párrafos y con los títulos aparte, con la ayuda de lectura del Portapapeles: furigana, comprensión, lectura en voz alta y tarjetas. En un manga, cada globo es un párrafo.
- **Revisar con Claude.** **Revisar el texto con Claude** compara el texto leído con la imagen de la página y propone solo lo que no coincide, letra a letra, para elegir qué aplicar. Lo aplicado queda como una línea editada, con «Restaurar». Usa Claude Haiku 5.5: menos de un céntimo de dólar por página.

## 0.11.0 · 2026-11-08

- **Notas y marcadores, como en un lector de PDF.** En los libros de páginas, **Marcar esta página** cuelga una cinta en la página, también en las miniaturas. Desde el panel de una línea se resalta en cuatro colores o se subraya la línea entera, una palabra o un tramo seleccionado, con un comentario si se quiere. **Añadir una nota** deja un papelito en el punto de la página que se toque.
- **El panel «Notas y marcadores».** Reúne todo lo anotado por páginas: lleva a cada cosa, la edita o la quita, y **Copiar** lo pone en el portapapeles como texto con formato, para pegarlo en otra parte.
- Los resaltados se guardan sobre la imagen de la página: siguen en su sitio aunque el OCR la vuelva a leer. Todo entra en la copia de seguridad y se va con el libro al eliminarlo.

## 0.10.0 · 2026-11-08

- **Colecciones.** La estantería agrupa los libros en colecciones: una serie con sus tomos o los libros de un tema, con su tipo (manga, novela, estudio u otro), una descripción y su portada. Una carpeta con varios tomos entra ya como una colección, y un tomo nuevo de esa carpeta se añade a ella. Cada colección tiene su página, con sus libros en orden, el tomo por el que se va y un botón para seguir.
- **Progreso de lectura.** Cada libro muestra cuánto se ha leído y queda terminado al llegar a su última página, o a mano; también se puede volver a empezar. «Seguir leyendo», arriba de la estantería, lleva a lo que se está leyendo, y los filtros muestran lo que se lee, lo que está sin empezar y lo terminado.
- **Portadas.** Un PDF trae su portada y su número de páginas desde que se importa, también los importados antes. La portada de cada libro se puede cambiar por una imagen o, en el visor, con «Usar esta página como portada».
- La estantería se actualiza al volver del visor, y el visor ya no deshace lo que se cambia en ella mientras un libro está abierto.

## 0.9.6 · 2026-11-08

- **Los PDF escaneados, leídos de su imagen.** En un PDF escaneado, el OCR lee ahora la imagen escaneada tal cual, a su resolución, en lugar de la página pintada en pantalla, que se reescalaba y se guardaba en JPEG. En dos libros de química escaneados, el error baja del 3,9 % al 0,2 % a 180 ppp y del 3,7 % al 1,2 % a 144 ppp. Se usa cuando la página es solo el escaneo, con o sin la capa invisible de otro OCR; si hay algo más encima, se lee la página pintada, como antes.
- Para buscar las líneas, las páginas pequeñas se amplían a la escala de una página pintada; el texto se lee de los píxeles originales.
- Lo leído de los PDF se vuelve a leer al abrir cada página, y un PDF ya procesado vuelve a ofrecer **Procesar**. Lo de los EPUB y CBZ y lo editado a mano se conservan.

## 0.9.5 · 2026-11-08

- **Un OCR de libros más fino.** El modo Libro lee con el reconocedor de PP-OCRv6, que salió en junio de 2026, y conserva el detector de antes, que parte mejor las líneas. En las páginas de referencia, el error baja casi un tercio en el visor (del 4,7 % al 3,4 %), a la misma velocidad. Recupera kanji sueltos que antes se perdían, como el 水 de «塩は水に溶ける», y respeta la puntuación de los libros de ciencias. Se comparó también con PP-OCRv6 medium, que apenas mejora y tarda el triple, y con NDLOCR-Lite, que se quedó en un 6 %.
- La descarga para libros pasa de 21 a 25 MB. Lo leído en modo Libro se vuelve a leer con el reconocedor nuevo; lo del manga y lo editado se conservan.

## 0.9.4 · 2026-11-08

- **Leer sin esperas.** El OCR lee las páginas siguientes antes de llegar a ellas (ocho en un manga, cuatro en un libro), así que al pasar de página su texto ya está. Si se salta a otra parte del libro, lo que se dejó atrás deja de leerse y va primero lo que se ve.
- **Procesar.** Desde la tarjeta de cada libro, en la Ayuda de lectura, se lee el libro entero con el OCR de una vez, con el avance a la vista y pausa. Al acabar queda con «Texto listo» y el OCR encendido.
- **Editar.** En el panel de una línea se puede escribir su texto a mano, por ejemplo si salió con un kanji cambiado. Lo editado se guarda aparte, sobrevive aunque la página se vuelva a leer y se puede restaurar.

## 0.9.3 · 2026-11-08

- **Texto del PDF.** En un PDF escaneado que trae la capa de texto de otro programa de OCR, a menudo con errores, se puede apagar **Texto del PDF** para que Kotonoha lea las páginas con su propio OCR. Cada libro lo recuerda.

## 0.9.2 · 2026-11-08

- **Un OCR de manga más fino.** Lee bien los puntos suspensivos («……»), deja fuera las marcas de agua y los números de página, y sigue el orden de las viñetas. En 18 páginas de cinco series, el error baja del 4,3 % al 2,8 % y los textos falsos, de 11 a 4; en las tres páginas de referencia de un tomo en EPUB, del 2,5 % al 0,5 %.
- **Libros de estudio y a dos columnas.** El furigana impreso ya no se cuela como texto aunque lo lleve casi cada kanji, y una página a dos columnas se lee columna a columna.
- Las páginas que el OCR ya había leído se vuelven a leer con lo nuevo la próxima vez que se abren.

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

## 0.20.0 · 2026-11-09

- **Kanji you already know.** On the **Strokes** tab of the word panel, **With these kanji you already know** gathers, for each kanji of the word, the words you already know or are learning with it: 冷蔵庫 brings up 冷たい, 車庫 and 金庫. The new kanji is remembered through what you already know.
- **Immersion hours.** Kotonoha counts the time you spend listening to and reading the language you study: playing videos with their subtitles, including your own files, books in the viewer and what you read in the Clipboard and the library. **Home** shows the hours for today, the week and in total, your streak of days in a row, one bar per day and what you have watched and read the most. The backup includes it.

## 0.19.0 · 2026-11-09

- **Special morae in pitch accent practice.** With **Also check っ, ん and long vowels**, the practice says whether a っ (きて for きって), a ん (かじ for かんじ) or a long vowel (おばさん for おばあさん) is missing or extra in the recording, and highlights the mora in the expected accent. It is heard on your computer by narabas, a Japanese phoneme model downloaded the first time (1.26 GB), checked against its SHA-256 and run on the GPU only if it calculates the same as the processor. Measured with minimal pairs said by two synthetic voices: it caught 17 of 22 missing morae and 10 of 10 extra ones, and gave no warning on 22 of 24 sentences said correctly.

## 0.18.0 · 2026-11-09

- **Comics in English and German.** In the viewer, **Comic** mode reads each speech balloon with the book recognizer, in panel order and from left to right; Manga mode only knew Japanese. Measured: 0.4 % character error on test pages in both languages and 12 % on a real hand-lettered 1922 page.
- **OCR measured in English and German.** 1.5 % error on a real 19th-century English scan and 0.03 % on German test pages. Blackletter (Fraktur) is not read.
- **Neural voices in the browser.** Kokoro reads English, with six voices, and Piper reads German, in Thorsten’s voice, on your own computer and with no key. Whisper Turbo understood the test sentences of both without errors.

## 0.17.0 · 2026-11-09

- **A helper without Python.** The local helper is written in PowerShell, which comes with Windows, and uses the official `yt-dlp.exe` with QuickJS for YouTube. `Instalar.cmd` runs with a double click: it copies the helper into place, downloads yt-dlp and QuickJS checking their SHA-256, finds Kotonoha in Chrome, Edge, Brave and Chromium and, if there is no copy, installs the extension too with a fixed ID. FFmpeg is no longer needed: without it, the extension converts the audio with its own FFmpeg.
- **Update now.** With the helper installed, the new-version notice and **Settings, Version** install it with one click: the helper downloads the package, checks its SHA-256, copies it over the extension's folder keeping its ID, and the extension reloads itself.
- **Full copy.** **Settings, Your data** exports to a folder, besides the usual, the book files, the OCR text and the dictations, and restores them into another copy or on another computer. No copy includes API keys any more.
- Material for publishing on Edge Add-ons and the Chrome Web Store: listing, permission justifications, screenshots and [privacy policy](docs/privacidad.md#english).

## 0.16.0 · 2026-11-08

- **Other AI providers.** Besides Claude: OpenRouter, DeepSeek and OpenAI with their key, and LM Studio and Ollama on the computer itself. They are added in **Settings, Other AI providers**, with their models and a connection test, and each task picks its own in **Model and effort per task**. Answers are streamed; those that need structure go with their JSON schema or, if the provider does not support it, in JSON mode. Spending is recorded with the cost the provider reports. Claude remains the default.

## 0.15.0 · 2026-11-08

- **Local Japanese voice.** With AivisSpeech or VOICEVOX open on the computer, Kotonoha reads sentences with them: read aloud, the practice, the word panel and card audio. It finds them on its own, the voice is chosen in **Settings, Voices**, and it reads with the dictionary’s accent, corrected before reading. The audio is cached. Measured on the development computer: AivisSpeech agrees with the dictionary in 37 of 37 accent phrases and reads a sentence in 0.6 s on the CPU.
- **Pitch accent practice.** It flags fewer errors that are not errors: the fall into the last mora before a pause now counts as the nucleus fall (〜ました, 橋を。), and dictionary expressions with a particle inside (雨が降る) are judged word by word.

## 0.14.0 · 2026-11-08

- **Pitch accent practice.** In the Clipboard, the Reading assistant’s texts and the text view, **Practice** shows the accent of each word in the sentence, records how it is read and lays the voice’s pitch curve over the expected one, with a verdict per word (**Good**, **Check**, **Not judged**) and long pauses. The pitch is measured in the browser and the recording is transcribed on the computer with Haas-ja; it is neither kept nor sent anywhere.

## 0.13.1 · 2026-11-08

- **Switching languages in plain sight.** Home has a selector with the three languages, each with its flag and its name, and the sidebar shows the language being studied, with a menu to change it.
- **New version notices.** Once a day, Kotonoha checks GitHub for the latest published version and, if it is newer, says so on Home and in the extension menu. **Settings, Version** shows the installed version, checks by hand and turns the notice off.
- **Browser voice.** Without an Azure key, read aloud and the word panel use the browser's best voice, such as Edge's "Natural" voices or Google's in Chrome, instead of letting the browser pick. Another one can be chosen per language in **Settings, Voices**.
- The helper's install command, in **Settings, Transcription**, now includes the extension's ID and runs in the folder of the downloaded zip, with a link to the download.

## 0.13.0 · 2026-11-08

- **Dictation into the Clipboard.** **Dictate** records from the microphone and adds what was said at the end of the text, already analysed and with furigana. It is transcribed on the computer with the speech model from the settings (Haas-ja for Japanese, Parakeet for English and German), and the recording stays above its paragraph so it can be played again, also in the library.
- With Parakeet, in English and German, a long sentence split across two lines no longer glues the first word of the second line to the end of the first, in generated subtitles as well.

## 0.12.0 · 2026-11-08

- **Search the book.** **Search the book**, or Ctrl+F, finds a word on every page with text, from the PDF or from OCR, ignoring character width and the difference between hiragana and katakana, and also when it is split across two lines. Results are listed by page and marked on the page; Enter goes to the next one.
- **Text view.** **View as text** shows the page as text, in paragraphs with headings set apart, with the Clipboard's reading help: furigana, comprehension, read aloud and cards. In a manga, each speech bubble is a paragraph.
- **Review with Claude.** **Review the text with Claude** compares the text that was read with the page image and suggests only what does not match, letter by letter, so you can choose what to apply. Applied changes become edited lines, with "Restore". It uses Claude Haiku 5.5: less than one US cent per page.

## 0.11.0 · 2026-11-08

- **Notes and bookmarks, as in a PDF reader.** In page books, **Bookmark this page** hangs a ribbon on the page, also in the thumbnails. From a line's panel, the whole line, a word or a selected stretch can be highlighted in four colours or underlined, with a comment if wanted. **Add a note** leaves a slip of paper on the spot of the page that is tapped.
- **The "Notes and bookmarks" panel.** It gathers everything noted, by page: it leads to each item, edits it or removes it, and **Copy** puts it on the clipboard as formatted text, to paste elsewhere.
- Highlights are stored on the page image: they stay in place even if OCR reads the page again. Everything is included in the backup and goes with the book when it is deleted.

## 0.10.0 · 2026-11-08

- **Collections.** The shelf groups books into collections: a series with its volumes or the books on a topic, with a type (manga, novel, study or other), a description and a cover. A folder with several volumes comes in as a collection, and a new volume from that folder is added to it. Each collection has its own page, with its books in order, the volume being read and a button to carry on.
- **Reading progress.** Each book shows how much has been read and is marked finished when its last page is reached, or by hand; it can also be started over. "Keep reading", at the top of the shelf, leads to what is being read, and the filters show what is being read, what has not been started and what is finished.
- **Covers.** A PDF has its cover and page count as soon as it is imported, including those imported earlier. Each book's cover can be replaced with an image or, in the viewer, with "Use this page as the cover".
- The shelf refreshes when you come back from the viewer, and the viewer no longer undoes changes made on the shelf while a book is open.

## 0.9.6 · 2026-11-08

- **Scanned PDFs, read from their image.** In a scanned PDF, OCR now reads the scanned image as it is, at its own resolution, instead of the page as drawn on screen, which was rescaled and stored as JPEG. In two scanned chemistry books, the error drops from 3.9 % to 0.2 % at 180 ppi and from 3.7 % to 1.2 % at 144 ppi. This applies when the page is just the scan, with or without the invisible layer of another OCR; if there is anything else on top, the drawn page is read, as before.
- To find the lines, small pages are enlarged to the scale of a drawn page; the text is read from the original pixels.
- What was read in PDFs is read again when each page is opened, and an already processed PDF offers **Process** again. EPUB and CBZ pages and hand edits are kept.

## 0.9.5 · 2026-11-08

- **Sharper OCR for books.** Book mode reads with the PP-OCRv6 recognizer, released in June 2026, and keeps the previous detector, which splits lines better. On the reference pages, the error drops by almost a third in the viewer (from 4.7 % to 3.4 %), at the same speed. It recovers single kanji that used to get lost, such as the 水 in «塩は水に溶ける», and keeps the punctuation of science books. It was also compared with PP-OCRv6 medium, which barely improves and takes three times as long, and with NDLOCR-Lite, which stayed at 6 %.
- The download for books goes from 21 to 25 MB. What was read in Book mode is read again with the new recognizer; manga pages and edits are kept.

## 0.9.4 · 2026-11-08

- **Reading without waiting.** OCR reads the next pages before you reach them (eight in a manga, four in a book), so when you turn the page its text is already there. If you jump elsewhere in the book, what was left behind stops being read and what you see comes first.
- **Process.** From each book's card in the Reading assistant, the whole book is read with OCR at once, with progress in view and a pause. When it finishes, the book shows "Text ready" and has OCR turned on.
- **Edit.** In a line's panel, its text can be typed by hand, for instance when it came out with a wrong kanji. The edit is stored separately, survives the page being read again and can be restored.

## 0.9.3 · 2026-11-08

- **PDF text.** In a scanned PDF that carries another OCR program's text layer, often with errors, **PDF text** can be turned off so that Kotonoha reads the pages with its own OCR. Each book remembers it.

## 0.9.2 · 2026-11-08

- **Sharper manga OCR.** It reads ellipses («……») properly, leaves watermarks and page numbers out and follows the order of the panels. On 18 pages from five series, the error drops from 4.3 % to 2.8 % and false text from 11 to 4; on the three reference pages of a volume in EPUB, from 2.5 % to 0.5 %.
- **Study books and two columns.** Printed furigana no longer slips in as text even when nearly every kanji carries it, and a two-column page is read column by column.
- Pages the OCR had already read are read again with the new version the next time they are opened.

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
