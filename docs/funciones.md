<p align="right"><b>Español</b> · <a href="features.md">English</a> · <a href="de/features.md">Deutsch</a> · <a href="zh/features.md">简体中文</a> · <a href="ko/features.md">한국어</a> · <a href="ja/features.md">日本語</a></p>

# Funciones

Estado de cada función en la versión 0.27.7, con la forma en que se ha verificado.

| Verificación | Significado |
|---|---|
| Automática | Probada de extremo a extremo con Edge y la extensión cargada |
| Simulador | El código real corre completo, contra un servidor falso de la API de Claude o de AnkiConnect |
| Página imitada | Además, en una página con la misma estructura de reproductor que Netflix o YouTube |
| Sesión real | Comprobada a mano en YouTube, con Chrome, una sesión real y la API de Claude |
| Pendiente | Requiere una sesión real del sitio o credenciales propias |

## Sobre el video

| Función | Verificación |
|---|---|
| Barra flotante con palabras conocidas, comprensión y frases recomendadas | Automática |
| La barra aparece al detener el ratón arriba, se queda mientras siga cerca y no se despierta al pasar de largo | Automática y sesión real |
| Subtítulos que se arrastran a cualquier punto del video, con imanes y sin salirse de él | Automática y sesión real |
| Cambio de línea sin parpadeos, y letra algo menor en los párrafos largos | Automática y sesión real |
| Los subtítulos acompañan al video al desplazar la página, sin temblar | Página imitada y sesión real |
| Una línea que aparece bajo un ratón quieto no abre fichas ni pausa el video | Automática |
| Subtítulos con furigana, color por acento tonal y subrayado por estado | Automática |
| Modos de furigana, glosas y color: siempre, al pasar, desconocidas, nunca | Automática |
| Ficha de palabra: definiciones, estado, frecuencia, audio, imágenes, ejemplos y enlaces | Automática |
| Orden de los trazos de cada kanji, animado y en bucle, con pausa y avance de uno en uno | Automática, con datos reales de KanjiVG |
| Kanji que ya conoces: junto a los trazos, las palabras conocidas o en aprendizaje con cada kanji de la palabra, las conocidas primero | Automática, con palabras sembradas en la base |
| Compartir como imagen: la tarjeta de la palabra (furigana, acento, lo que significa en la frase o el diccionario, la frase con la palabra resaltada) o de un punto de gramática, copiada al portapapeles al pulsar; Tinta o Papel; Guardar imagen | Automática, con un Claude simulado, leyendo el portapapeles |
| JLPT: vocabulario (8354 palabras), kanji (2211) y gramática (501 puntos) de N5 a N1 con lo que se conoce de cada nivel; cambiar el estado una a una o todas las elegidas; ficha del kanji con trazos y palabras del nivel; ejemplos de cada punto de gramática entre las frases vistas, y su explicación con Claude | Automática, con un Claude simulado |
| Diccionario: buscar por significado entre las palabras de uso común, con la glosa que encaja; la gramática del JLPT por su forma o su significado; bajo cada palabra, sus kanji con su nivel, las de uso común que significan lo mismo, los homófonos y las palabras parecidas (Claude); siete categorías para explorar según las etiquetas de JMdict | Automática, con los diccionarios del perfil de pruebas y un Claude simulado |
| Gramática con estados: nuevo, aprendiendo o sabido en el globo del video, la ficha, el JLPT y el diccionario; lo sabido no se señala bajo los subtítulos; dónde se ha visto cada punto; tarjeta de opción múltiple con distractores de Claude; importar desde Anki contra los 501 puntos de las listas | Automática (estados, filtro, guardado y vuelta atrás en la pantalla JLPT); la importación, con pruebas unitarias |
| Modo Dictado: frase oculta, pausa al final, escribir lo oído y comparar (en japonés por la lectura y con las otras lecturas del diccionario); Oír otra vez, Seguir con Enter; Repetir con tu voz (botón y tecla P) abre la práctica del acento con la frase | Automática, sobre la página de video de pruebas |
| Cómo suena de verdad (inglés): la frase con su forma hablada encima, con reducciones, formas débiles, uniones, t o d con you y la t suave americana, y una leyenda; por reglas, sin Claude | Automática, con pruebas unitarias de las reglas |
| La ficha abre con el diccionario, sin ninguna petición a Claude | Simulador y sesión real |
| Qué significa en esta frase, explicar, desglosar y traducir con Claude, a petición | Simulador, y sesión real para el significado en la frase |
| Cada respuesta se guarda: la misma palabra en la misma frase no se vuelve a pedir | Simulador y sesión real |
| Preguntas libres sobre una palabra o una frase | Simulador |
| Gramática JLPT: unas 100 reglas confirmadas por Claude, con un resumen por video | Simulador |
| Palabras prioritarias: las desconocidas que más se repiten en el video | Automática |
| Modos de reproducción: escucha y lectura intensivas, híbrido, enfoque en una palabra y personalizado | Automática |
| Velos sobre los subtítulos | Automática |
| Aceleración o salto de escenas sin diálogo | Automática |
| Navegador de subtítulos: filtros, marcadores, selección y unión de líneas | Automática |
| Traductor flotante | Simulador |
| Atajos de teclado | Automática |

## Subtítulos

| Función | Verificación |
|---|---|
| YouTube: pistas firmadas por el reproductor | Sesión real. Las pruebas automáticas usan una página imitada, porque el sitio no sirve subtítulos a un navegador automatizado |
| Netflix: pistas del reproductor, TTML | Página imitada. Pendiente de una sesión real |
| Disney+, Crunchyroll, Viki, Bilibili, iQIYI y Prime Video, por detección genérica | Pendiente |
| Segunda pista en el idioma de apoyo | Automática |
| Traducción con Claude, por tramos, empezando por el punto de reproducción, con continuación si se cancela | Página imitada |
| Corrección de subtítulos automáticos, con el texto original consultable | Página imitada |
| Creación de japonés desde otro idioma | Página imitada |
| Importación de SRT, VTT, ASS, SSA, TTML y DFXP, guardada por título | Página imitada |
| Exportación a SRT, con la sincronía aplicada | Página imitada |
| Pistas de japonés recordadas entre regiones de Netflix | Página imitada. Falta confirmar con sesiones reales que el identificador del título coincide |
| Sincronización por desfase o con una o dos marcas | Automática |

## Transcripción

| Función | Verificación |
|---|---|
| Whisper en la GPU con WebGPU, para archivos propios | Automática, con videos reales |
| Whisper en tiempo real desde la captura de la pestaña | Automática, con audio real |
| Recuperación de la voz omitida bajo música | Automática, con videos reales |
| Control de carga: descansos, intensidad automática y pausa | Automática, con medidas de fluidez |
| Recuperación ante la pérdida de la GPU | Automática, destruyendo el dispositivo WebGPU |
| Ayudante local en PowerShell con yt-dlp, sin Python, con FFmpeg o sin él | Automática: instalador sin registro, las dos conversiones, cancelar y los errores, con descarga local; el registro real con Edge, y una descarga real de YouTube con QuickJS |
| La orden de instalación del ayudante en Ajustes, con el identificador de la copia y un enlace a su descarga | Automática |
| `Instalar.cmd` de doble clic: encuentra Kotonoha en los navegadores, baja yt-dlp y QuickJS comprobando su SHA-256 y, si no hay copia, instala la extensión con identificador fijo | Automática, sin tocar el registro |
| **Actualizar ahora**: el ayudante pone la versión nueva en la carpeta de la copia, con su SHA-256 y la misma clave, y la extensión se recarga | Automática, de punta a punta con Edge |
| Copia completa en una carpeta: libros, texto del OCR y dictados, sin claves de API | Automática, de ida y vuelta |
| Corrección del resultado con Claude | Simulador |
| Letra de una canción colocada sobre los tiempos de la transcripción: el texto sale de la letra y los tiempos, de Whisper | Simulador, con Whisper real, y sesión real con una canción |
| Haas-ja para la voz hablada en japonés, Parakeet para la del inglés y Whisper Turbo para las canciones, elegidos según el video | Automática, con los tres modelos reales en la GPU, y sesión real en YouTube |
| Lista de modelos guardados, con lo que ocupa cada uno y borrado por modelo. Leerlos del disco ya no se anuncia como una descarga | Automática, y con Whisper real |

## Tarjetas

| Función | Verificación |
|---|---|
| Creación de un clic | Simulador |
| Creador con todos los campos | Simulador |
| Envío a Anki con AnkiConnect, con un tipo de nota propio o el de la extensión | Simulador |
| Audio de la frase grabado del video, a MP3, del tramo exacto y a velocidad normal | Automática, con la captura real de una pestaña |
| La captura es por pestaña: desde otra no se graba silencio, y una grabación muda no se guarda | Automática, con la captura real de una pestaña |
| Captura del fotograma, con el video como única cosa a la vista | Automática, con la captura real de una pestaña |
| Todos los atajos de teclado, y la tecla real de la captura en avisos y menús | Automática |
| Sin aceleración por hardware, la interfaz quita el desenfoque para no perder fotogramas | Automática |
| Audio de la palabra: JapanesePod101 y Lingua Libre | Automática |
| Voces neuronales de Azure, con clave propia | Pendiente |
| Voz del navegador sin clave de Azure: la mejor que ofrezca (las «Natural» de Edge, las de Google en Chrome) u otra elegida en Ajustes, por idioma | Automática |
| Voz japonesa local con AivisSpeech o VOICEVOX: se encuentra sola, se elige la voz y el estilo, lee con el acento del diccionario y guarda los audios en una caché; sirve para leer en voz alta, la práctica, la ficha y las tarjetas | Automática, con un motor simulado y con AivisSpeech 1.2.0 en el equipo: coincide con el diccionario en 37 de 37 frases acentuales y lee una frase en 0,6 s con el procesador |
| Imágenes de Openverse | Automática |
| Creación de varias tarjetas desde líneas seleccionadas | Simulador |
| Palabras conocidas a partir de los mazos de Anki | Simulador |
| Repaso integrado con FSRS | Automática |

## Ventana de la aplicación

| Función | Verificación |
|---|---|
| Inicio con resumen de vocabulario y repaso | Automática |
| Gasto en Claude: total del mes, gráfica por días y modelos, tareas y registro de peticiones | Simulador |
| Diccionario con búsqueda libre y formas conjugadas | Automática |
| Cuaderno: lo pegado o copiado conserva sus párrafos, saltos de línea, títulos, listas, citas, código, tablas y negritas, sin el furigana de la página de origen | Automática |
| Cuaderno en una pestaña normal, también en vista dividida junto a la página que se esté viendo | Automática, en Edge y Chrome |
| Seguir el portapapeles, sin que la pestaña tenga el foco | Automática |
| Dictar al Cuaderno: el micrófono, el tiempo y el nivel mientras se graba, y el texto al final, ya analizado, transcrito en el equipo con el modelo de voz de los ajustes | Automática, con voces sintéticas en japonés e inglés |
| Cuaderno: un editor a todo lo ancho con títulos, listas con subpuntos, citas, código y negritas, con botones y atajos (# , - , ・ , 1. , > , Tab, Ctrl+B); Editar y Leer en la misma página; lo pegado con su estructura; se guarda solo, y en la biblioteca si se pide, y un texto de la biblioteca se vuelve a editar | Automática: escribir con los atajos y los botones, leer, guardar en la biblioteca y volver a abrir desde ella |
| Organizar: Claude pone título, subtítulos, párrafos y listas a un texto pegado de corrido; avisa si cambió alguna palabra, y Ctrl+Z lo deshace | Automática, con un Claude simulado |
| Lectura en voz alta con velocidad (0,6× a 1,2×) y modo (seguido, frase a frase o repitiendo la frase); escuchar o practicar cualquier trozo seleccionado, sin su furigana | Automática |
| Los modelos de voz se cargan mientras se graba (dictado y práctica): la segunda grabación de la práctica se analiza en 0,2 s, y el dictado se transcribe un segundo después de terminar | Automática, en la GPU del equipo de desarrollo |
| La grabación de cada dictado encima de su párrafo, para volver a oírla; va con el texto a la biblioteca, y la que ningún texto usa se borra pasada una semana | Automática |
| Practicar el acento tonal en el Cuaderno, los textos de la Biblioteca y la vista de texto: el acento de cada palabra dibujado, la grabación, la curva del tono sobre el acento esperado, un veredicto por palabra y las pausas largas | Automática, con una voz sintética |
| El tono de la voz medido en el navegador (YIN), las moras situadas con la voz y la transcripción, y dónde cae el tono en cada palabra, también con el pico retrasado y las moras ensordecidas | Automática; ajustado con pares mínimos (箸, 橋 y 端; 雨 y 飴) leídos por una voz sintética y con una grabación real |
| Las moras especiales en la práctica, con narabas: la っ, la ん y la vocal larga que faltan o sobran, con la mora marcada; la descarga del modelo comprobada con su SHA-256, la GPU solo si calcula como el procesador, y sin juzgar la っ delante de fricativa, las frases dichas de otra manera ni los titubeos al final de una palabra | Automática, con una voz sintética; medido con pares mínimos (おばあさん y おばさん, きって y きて…) dichos por dos voces sintéticas: 17 de 22 moras que faltaban y 10 de 10 de más, sin avisos en 22 de 24 frases bien dichas |
| Biblioteca: TXT, HTML y SRT, con los títulos, párrafos y listas de cada capítulo | Automática |
| Visor de libros de páginas: EPUB de imágenes, CBZ y PDF en su propia pestaña, con zoom, ajuste al ancho o a la página, una página, doble página y desplazamiento continuo | Automática |
| Carpetas de imágenes como libros: cada carpeta, o cada tomo dentro de ella, entra como un libro, con la portada delante, el índice por capítulos y las dobles páginas apaisadas solas | Automática, y con 40 tomos reales de manga |
| Colecciones en la estantería: una serie con sus tomos o un tema, con su tipo, su descripción y su portada; una carpeta con varios tomos entra ya como una colección, y un tomo nuevo se añade a la suya | Automática |
| Progreso de lectura: cuánto se lleva de cada libro y de cada colección, «Terminado» al llegar al final o a mano, «Seguir leyendo» y filtros por estado | Automática |
| Portadas: los PDF la traen desde que se importan; la de cada libro se elige con una página del visor o una imagen, y la de cada colección, entre las de sus libros o una imagen | Automática |
| Sentido de derecha a izquierda tomado del propio libro, con la portada sola en doble página | Automática |
| Miniaturas, índice del libro, ir a una página, pantalla completa y colores invertidos | Automática |
| Los libros se guardan aparte y se leen a trozos: un PDF de cientos de MB no se carga entero. El visor recuerda la página, la vista y el zoom de cada uno | Automática, y con un PDF real de 347 MB |
| Reconocimiento de texto (OCR) en el propio equipo, con la GPU: modo Libro, con el detector de PP-OCRv5 y el reconocedor de PP-OCRv6, que deja fuera el furigana impreso y lee columna a columna, y modo Manga, con un detector de globos y manga-ocr, en el orden de las viñetas y sin marcas de agua | Automática, y medido a mano en páginas reales: un 2,8 % de error por carácter en 18 páginas de manga de cinco series y un 0,5 % en un tomo en EPUB, un 2,2 % en un libro de texto y, en PDF de química escaneados, con fórmulas y tablas, un 0,2 % a 180 ppp y un 1,2 % a 144 ppp, leyendo la imagen escaneada tal cual |
| Texto del PDF: en un PDF con la capa de texto de otro programa de OCR, elegir entre ese texto y el OCR de Kotonoha, y que cada libro lo recuerde | Automática, y con un escaneo real |
| El OCR lee por delante: las páginas siguientes (ocho en un manga, cuatro en un libro) antes de llegar, y deja de lado las que se saltan | Automática |
| Procesar: leer con el OCR un libro entero desde su tarjeta, con el avance, pausa y «Texto listo» al acabar | Automática, y con un tomo real |
| Editar el texto de una línea a mano, guardado aparte de lo leído y con «Restaurar» | Automática |
| Notas y marcadores, como en un lector de PDF: marcar páginas, resaltar en cuatro colores o subrayar una línea, una palabra o un tramo, con un comentario, y notas sueltas sobre la página; en el panel «Notas y marcadores», todo por páginas, para ir, editar, quitar o copiar como texto | Automática |
| Buscar en el libro: en el texto del PDF y en el del OCR, con lo editado, sin distinguir anchos ni hiragana y katakana, también una palabra partida entre dos renglones; resultados por páginas y marcados en la página | Automática |
| Vista de texto: la página como texto, en párrafos y con los títulos aparte, con la ayuda de lectura del Cuaderno (furigana, comprensión, lectura en voz alta, fichas y tarjetas); cada libro la recuerda | Automática, y los párrafos con 16 páginas reales |
| Revisar con Claude el texto de una página, con su imagen: solo los cambios que no coinciden, letra a letra, para elegir cuáles aplicar, guardados como líneas editadas | Simulador |
| Tocar una línea de la página abre su texto con furigana y palabras para consultar, con su ficha y la creación de tarjetas | Automática |
| Cada página se lee una sola vez y se guarda; su texto también llega a los lectores de pantalla | Automática |
| EPUB de texto en el visor, con su propio formato: capítulos, CSS, ruby, ilustraciones y escritura vertical, y el lector de páginas encima, con colores, furigana y fichas | Automática, con un EPUB vertical con ruby, CSS e ilustración |
| Lo que trae un EPUB no se ejecuta ni carga nada de fuera: ni scripts, ni marcos, ni formularios, ni atributos on* | Automática, con un EPUB con trampas |
| Índice, zoom, enlaces entre capítulos, texto vertical u horizontal a elegir y el punto exacto donde se dejó cada libro | Automática |
| PDF con texto: el texto del propio archivo se lee al instante, sin OCR, también en columnas verticales, y los radicales Kangxi pasan al kanji que son | Automática, con un PDF japonés hecho por el navegador |
| Tocar una palabra en la página abre su ficha directamente y la marca sobre la página, en los PDF con texto y en el modo Libro del OCR | Automática |
| Relatos generados según el nivel | Simulador |
| Reproductor de archivos propios | Automática |
| Subtítulos incrustados en MKV y elección de pista de audio, con ffmpeg.wasm | Automática |
| Explorador de palabras por estado | Automática |
| Horas de inmersión: el tiempo con un video en marcha y subtítulos en la lengua que se estudia, con un libro en el visor y leyendo en el Cuaderno o la biblioteca; en Inicio, hoy, los últimos siete días, el total, la racha, una barra por día y lo que más se vio y leyó | Automática: un video propio que se reproduce de verdad y días anteriores sembrados en la base |
| Evaluación de nivel | Automática |
| Ajustes completos y prompts editables | Automática |
| Copia de seguridad de todos los idiomas y de los ajustes, en un solo archivo | Automática |

## Páginas web

| Función | Verificación |
|---|---|
| Consulta de una palabra con un clic; en enlaces y botones, al dejar el ratón encima | Automática, y en 31 sitios públicos reales |
| Subrayado por estado y furigana, sin añadir nada al contenido de la página | Automática, y en 31 sitios públicos reales |
| Sin separar líneas, el diseño no se mueve: ni elementos, ni medidas del documento | Automática, y en 31 sitios públicos reales |
| Si el furigana no cabe entre dos líneas, se abre el interlineado de ese texto, y se puede desactivar | Automática, y en el chat de Claude con una sesión real |
| En una caja con scroll propio, el furigana se mueve con el texto, sin estela, y se recorta bajo lo que tape la caja | Automática, y en el chat de Claude con una sesión real |
| Recuadros de código con japonés | Automática, y en el chat de Claude con una sesión real |
| Enlaces y botones siguen funcionando con su propio clic | Automática |
| Furigana en todas las palabras, en las nuevas, al pasar el ratón o nunca, en kana o rōmaji | Automática |
| Texto que cambia: el que llega en directo, carruseles, acordeones y cajas con scroll | Automática |
| Árboles de sombra | Automática |
| Botón del borde de la página para ajustar colores y furigana | Automática |
| Envío de la selección o de una imagen al creador con `E` | Automática |
| Marcado en bloque del texto seleccionado con `Alt+K`, `Alt+U` y `Alt+I` | Automática |

## Idiomas y personalización

| Función | Verificación |
|---|---|
| Elegir el idioma que se estudia: en Inicio y en la barra lateral, con su bandera, en la bienvenida, en Ajustes o en el menú de la extensión | Automática |
| Palabras, diccionarios, tarjetas y ajustes separados por idioma | Automática |
| Aviso de versión nueva desde GitHub, una vez al día, en Inicio y en el menú de la extensión; se cierra por versión y se apaga en Ajustes, Versión | Automática, con GitHub simulado |
| Interfaz en español, inglés, alemán, chino simplificado, coreano y japonés | Automática: tablas completas y capturas de cada idioma |
| Bienvenida con idioma, nivel, diccionarios, clave y destino de las tarjetas | Automática |
| Explicaciones y traducciones en un idioma distinto al de la interfaz, también portugués y francés | Automática |
| JMdict en alemán, además de español e inglés | Automática |
| Lecturas en kana o rōmaji | Automática |
| Paletas de color: habitual, para daltonismo y de alto contraste | Automática |
| Atajos de teclado a elegir, que funcionan con cualquier distribución de teclado | Automática |
| Tope de gasto mensual en Claude | Simulador |
| Otros proveedores de IA con la API de OpenAI (OpenRouter, DeepSeek, OpenAI, LM Studio, Ollama): sus modelos en cada tarea, la clave aparte, respuestas en flujo, esquema JSON o modo JSON, menos tokens si no admiten tantos, y el gasto con el coste que dicen | Proveedor simulado, que se comporta como DeepSeek |

## Inglés

| Función | Verificación |
|---|---|
| Subtítulos en inglés, con cada palabra analizada y los secundarios en el idioma de apoyo | Página imitada, y sesión real en YouTube |
| Corrección de subtítulos automáticos, con las mayúsculas y la puntuación que faltan, y creación de inglés desde otro idioma | Página imitada, y sesión real en YouTube |
| Pronunciación americana y británica en IPA, en la ficha y, si se pide, sobre cada palabra | Automática, con datos reales de Wiktionary |
| Color por sílaba tónica: la primera, una del medio o la última | Automática |
| Definiciones y traducciones de Wiktionary en español, alemán, chino, coreano y japonés, y definiciones en inglés | Automática, con datos reales |
| Frecuencia según subtítulos de películas y series | Automática, con datos reales |
| De qué palabra viene cada forma: *went* es *go*, *didn't* es *do* | Automática |
| Verbos con partícula y frases hechas, también separados: *picked it up* encuentra *pick up* | Automática |
| Gramática de A1 a C2: 51 reglas, confirmadas por Claude | Simulador |
| Lector de páginas, apagado al empezar, que deja en paz las páginas en otro idioma | Automática, y en 16 sitios públicos reales |
| Parakeet y Whisper en inglés, con las líneas partidas para leerlas | Automática, con una voz sintética, y en una sesión real |
| Cómics con el modo **Cómic** del visor: cada globo con el reconocedor de libros, por viñetas de izquierda a derecha | Automática: 0,4 % de error por carácter en páginas de prueba, y un 12 % en una página real de 1922 rotulada a mano |
| OCR de libros en inglés | Medida: 1,5 % de error por carácter en un escaneo real del siglo XIX, casi todo en la cabecera |
| Voz neuronal en el navegador: Kokoro, con seis voces | Automática; Whisper Turbo entiende sus frases sin errores |
| Instrucciones a Claude propias del inglés | Simulador |
| Audio de las palabras de Wikimedia Commons y Lingua Libre | Automática |
| Voces neuronales de Azure en inglés | Pendiente |
| Evaluación de nivel y camino de A1 a C2 | Automática |

## Alemán

| Función | Verificación |
|---|---|
| Subtítulos en alemán, con cada palabra analizada y los secundarios en el idioma de apoyo | Página imitada, y sesión real en YouTube |
| Corrección de subtítulos automáticos con las instrucciones del alemán, que también ponen la puntuación que falta | Página imitada, y sesión real en YouTube |
| De qué palabra sale cada forma, con las formas de Wiktionary: *ging* es *gehen*, *Häuser* es *Haus*. Entre dos posibles, la más frecuente | Automática, con datos reales |
| Verbos separables con la partícula al final: *fängt morgen an* encuentra *anfangen* | Automática, con datos reales |
| Pronunciación en IPA, sin variantes regionales, y color por sílaba tónica | Automática, con datos reales de Wiktionary |
| Definiciones y traducciones de Wiktionary en español, inglés, chino, coreano y japonés, y definiciones en alemán | Automática, con datos reales |
| Frecuencia según subtítulos de películas y series | Automática, con datos reales |
| Gramática de A1 a C2: 24 reglas, confirmadas por Claude | Automática |
| Lector de páginas, apagado al empezar | Automática |
| Parakeet para la voz y Whisper Turbo para las canciones | Automática, con una grabación real |
| Cómics con el modo **Cómic**, con ä, ö, ü y ß | Automática: 0,4 % de error en páginas de prueba |
| OCR de libros en alemán, con letra moderna; la gótica (Fraktur) no se lee | Medida: 0,03 % de error en páginas de prueba con cuatro tipografías, y un 75 % en una página en Fraktur de 1919 |
| Voz neuronal en el navegador: Piper, con la voz de Thorsten | Automática; Whisper Turbo entiende sus frases sin errores |
| Audio de las palabras de Wikimedia Commons y Lingua Libre | Automática |

## Criterios de diseño

| Criterio | Aplicación |
|---|---|
| El sentido depende de la frase | El bloque «En esta frase» da el sentido en contexto, señala los usos figurados o poéticos, y va primero en la tarjeta |
| Lecturas correctas | Claude revisa las lecturas de cada línea, y se puede corregir una a mano |
| Contexto amplio | Claude recibe 40 líneas alrededor de la frase y la traducción. El guion completo se envía al corregir, y en las consultas es opcional |
| Nada se paga dos veces | Cada respuesta se guarda por palabra y frase, y lo revisado por texto de línea. Una respuesta interrumpida se termina y se guarda, y dos consultas iguales a la vez comparten la misma petición |
| Claude solo cuando hace falta | La ficha abre con el diccionario, y la revisión cubre el tramo que está por verse en lugar del video entero |
| Empezar por lo que se ve | Traducción, corrección y revisión ordenan los tramos según el punto de reproducción |
| El equipo sigue siendo usable | La transcripción descansa, se adapta al uso y se detiene ante fallos repetidos |
| Las páginas no se reescriben | El subrayado web usa la CSS Custom Highlight API, sin añadir nada al contenido. Solo se abre el interlineado donde el furigana no cabe |
| Datos locales | Todo queda en el navegador, y el audio de la transcripción no sale del equipo |

## Limitaciones conocidas

| Limitación | Detalle |
|---|---|
| Idioma de estudio | Japonés, inglés y alemán. Cada idioma nuevo necesita su propio paquete, en `src/lenguas` |
| Análisis del inglés | Lo hace un modelo pequeño, que cabe en la extensión. En frases ambiguas puede equivocarse de categoría, y con ella de traducción bajo la palabra. La ficha sigue mostrando todas las definiciones |
| Análisis del alemán | Sale de las formas de los diccionarios: sin el alemán–inglés, cada palabra es su propia forma. Entre dos palabras posibles decide la frecuencia, sin mirar la frase; Claude corrige lo que falle al revisar la línea |
| Compuestos alemanes | Un sustantivo compuesto que no esté en los diccionarios no se descompone en sus partes |
| Diccionario inglés-inglés | Es grande: descarga unos 110 MB y ocupa unos 220 MB. Instalarlo y quitarlo lleva unos minutos. Solo se propone con la interfaz en inglés |
| Traducciones de la interfaz | Escritas con ayuda de IA, sin revisión nativa todavía. Los errores se corrigen en `idiomas/` |
| Lector de páginas | Solo actúa en el marco principal: no llega al texto dentro de un iframe. Lo que una página dibuje en un lienzo o en una imagen no es texto |
| Prompts de Claude | Las instrucciones siguen en español, también cuando pide la respuesta en otro idioma |
| Plataformas | Chrome y Edge de escritorio. El ayudante local está preparado para Windows |
| Imagen con DRM | En Netflix y otros sitios protegidos, el navegador entrega el fotograma en negro. La tarjeta lleva la imagen oficial del episodio, si el sitio la ofrece |
| Audio con DRM | Un sitio protegido puede no entregar su sonido a la captura. Tras dos frases mudas seguidas en un video, la línea ya no se vuelve a reproducir para grabarla |
| Visor | El OCR puede confundir letras parecidas (エ y 工, ー y 一), saltarse alguna y perder los subíndices de las fórmulas; la imagen original siempre queda a la vista. El modo Libro está medido con texto horizontal. Un libro con DRM no se abre. Los archivos de los libros no van en la copia de seguridad de un solo archivo, sino en la copia completa. Un EPUB de texto se recorre por capítulos, con desplazamiento, y no por páginas; en el modo Manga se toca el globo entero, no cada palabra. |
| Sincronización | Sin servidor: el traspaso entre equipos se hace con la copia completa |
| Música de fondo | Whisper puede perder conversaciones en voz baja bajo música fuerte |
| Letras de canciones | Los tiempos son por línea de Whisper, no por palabra. Con música muy fuerte, Whisper puede oír poco, y entonces más versos llevan un tiempo estimado |
