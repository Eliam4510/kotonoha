<p align="right"><b>Español</b> · <a href="features.md">English</a> · <a href="de/features.md">Deutsch</a> · <a href="zh/features.md">简体中文</a> · <a href="ko/features.md">한국어</a> · <a href="ja/features.md">日本語</a></p>

# Funciones

Estado de cada función en la versión 0.4.2, con la forma en que se ha verificado.

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
| Ayudante local con yt-dlp y FFmpeg | Automática, con descarga local. Falta el registro real en el navegador y una descarga real de YouTube |
| Corrección del resultado con Claude | Simulador |
| Letra de una canción colocada sobre los tiempos de la transcripción: el texto sale de la letra y los tiempos, de Whisper | Simulador, con Whisper real, y sesión real con una canción |
| Haas-ja para la voz hablada en japonés y Whisper Turbo para las canciones, elegidos según el video | Automática, con Haas-ja y Whisper reales en la GPU |
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
| Lector de texto pegado | Automática |
| Lector en una pestaña normal, también en vista dividida junto a la página que se esté viendo | Automática, en Edge y Chrome |
| Seguir el portapapeles, sin que la pestaña tenga el foco | Automática |
| Biblioteca: EPUB, TXT y SRT | Automática |
| Relatos generados según el nivel | Simulador |
| Reproductor de archivos propios | Automática |
| Subtítulos incrustados en MKV y elección de pista de audio, con ffmpeg.wasm | Automática |
| Explorador de palabras por estado | Automática |
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
| Elegir el idioma que se estudia: en la bienvenida, en Ajustes o en el menú de la extensión | Automática |
| Palabras, diccionarios, tarjetas y ajustes separados por idioma | Automática |
| Interfaz en español, inglés, alemán, chino simplificado, coreano y japonés | Automática: tablas completas y capturas de cada idioma |
| Bienvenida con idioma, nivel, diccionarios, clave y destino de las tarjetas | Automática |
| Explicaciones y traducciones en un idioma distinto al de la interfaz, también portugués y francés | Automática |
| JMdict en alemán, además de español e inglés | Automática |
| Lecturas en kana o rōmaji | Automática |
| Paletas de color: habitual, para daltonismo y de alto contraste | Automática |
| Atajos de teclado a elegir, que funcionan con cualquier distribución de teclado | Automática |
| Tope de gasto mensual en Claude | Simulador |

## Inglés

| Función | Verificación |
|---|---|
| Subtítulos en inglés, con cada palabra analizada y los secundarios en el idioma de apoyo | Página imitada. Pendiente de una sesión real |
| Corrección de subtítulos automáticos y creación de inglés desde otro idioma | Página imitada |
| Pronunciación americana y británica en IPA, en la ficha y, si se pide, sobre cada palabra | Automática, con datos reales de Wiktionary |
| Color por sílaba tónica: la primera, una del medio o la última | Automática |
| Definiciones y traducciones de Wiktionary en español, alemán, chino, coreano y japonés, y definiciones en inglés | Automática, con datos reales |
| Frecuencia según subtítulos de películas y series | Automática, con datos reales |
| De qué palabra viene cada forma: *went* es *go*, *didn't* es *do* | Automática |
| Verbos con partícula y frases hechas, también separados: *picked it up* encuentra *pick up* | Automática |
| Gramática de A1 a C2: 51 reglas, confirmadas por Claude | Simulador |
| Lector de páginas, apagado al empezar, que deja en paz las páginas en otro idioma | Automática, y en 16 sitios públicos reales |
| Whisper en inglés, con las líneas partidas para leerlas | Automática, con una voz sintética |
| Instrucciones a Claude propias del inglés | Simulador |
| Audio de las palabras de Wikimedia Commons y Lingua Libre | Automática |
| Voces neuronales de Azure en inglés | Pendiente |
| Evaluación de nivel y camino de A1 a C2 | Automática |

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
| Idioma de estudio | Japonés e inglés. Cada idioma nuevo necesita su propio paquete, en `src/lenguas` |
| Análisis del inglés | Lo hace un modelo pequeño, que cabe en la extensión. En frases ambiguas puede equivocarse de categoría, y con ella de traducción bajo la palabra. La ficha sigue mostrando todas las definiciones |
| Diccionario inglés-inglés | Es grande: descarga unos 110 MB y ocupa unos 220 MB. Instalarlo y quitarlo lleva unos minutos. Solo se propone con la interfaz en inglés |
| Traducciones de la interfaz | Escritas con ayuda de IA, sin revisión nativa todavía. Los errores se corrigen en `idiomas/` |
| Lector de páginas | Solo actúa en el marco principal: no llega al texto dentro de un iframe. Lo que una página dibuje en un lienzo o en una imagen no es texto |
| Prompts de Claude | Las instrucciones siguen en español, también cuando pide la respuesta en otro idioma |
| Plataformas | Chrome y Edge de escritorio. El ayudante local está preparado para Windows |
| Imagen con DRM | En Netflix y otros sitios protegidos, el navegador entrega el fotograma en negro. La tarjeta lleva la imagen oficial del episodio, si el sitio la ofrece |
| Audio con DRM | Un sitio protegido puede no entregar su sonido a la captura. Tras dos frases mudas seguidas en un video, la línea ya no se vuelve a reproducir para grabarla |
| Sincronización | Sin servidor: el traspaso entre equipos se hace con la copia de seguridad |
| Música de fondo | Whisper puede perder conversaciones en voz baja bajo música fuerte |
| Letras de canciones | Los tiempos son por línea de Whisper, no por palabra. Con música muy fuerte, Whisper puede oír poco, y entonces más versos llevan un tiempo estimado |
