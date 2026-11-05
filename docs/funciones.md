<p align="right"><b>Español</b> · <a href="features.md">English</a></p>

# Funciones

Estado de cada función en la versión 0.1.0, con la forma en que se ha verificado.

| Verificación | Significado |
|---|---|
| Automática | Probada de extremo a extremo con Edge y la extensión cargada |
| Simulador | El código real corre completo, contra un servidor falso de la API de Claude o de AnkiConnect |
| Página imitada | Además, en una página con la misma estructura de reproductor que Netflix o YouTube |
| Pendiente | Requiere una sesión real del sitio o credenciales propias |

## Sobre el video

| Función | Verificación |
|---|---|
| Barra flotante con palabras conocidas, comprensión y frases recomendadas | Automática |
| Subtítulos con furigana, color por acento tonal y subrayado por estado | Automática |
| Modos de furigana, glosas y color: siempre, al pasar, desconocidas, nunca | Automática |
| Ficha de palabra: definiciones, estado, frecuencia, audio, imágenes, ejemplos y enlaces | Automática |
| Explicar, desglosar y traducir con Claude | Simulador |
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
| YouTube: pistas firmadas por el reproductor | Página imitada. Pendiente de una sesión real, porque el sitio no sirve subtítulos a un navegador automatizado |
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

## Tarjetas

| Función | Verificación |
|---|---|
| Creación de un clic | Simulador |
| Creador con todos los campos | Simulador |
| Envío a Anki con AnkiConnect, con un tipo de nota propio o el de la extensión | Simulador |
| Audio de la frase grabado del video, a MP3 | Automática, con audio simulado |
| Captura del fotograma, también con DRM | Automática |
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
| Diccionario con búsqueda libre y formas conjugadas | Automática |
| Lector de texto pegado | Automática |
| Biblioteca: EPUB, TXT y SRT | Automática |
| Relatos generados según el nivel | Simulador |
| Reproductor de archivos propios | Automática |
| Subtítulos incrustados en MKV y elección de pista de audio, con ffmpeg.wasm | Automática |
| Explorador de palabras por estado | Automática |
| Evaluación de nivel | Automática |
| Ajustes completos y prompts editables | Automática |
| Copia de seguridad | Automática |

## Páginas web

| Función | Verificación |
|---|---|
| Consulta de palabras con `Shift` y el ratón | Automática |
| Subrayado por estado, sin modificar la página | Automática |
| Envío de la selección o de una imagen al creador con `E` | Automática |
| Marcado en bloque del texto seleccionado con `Alt+K`, `Alt+U` y `Alt+I` | Automática |

## Criterios de diseño

| Criterio | Aplicación |
|---|---|
| El sentido depende de la frase | El bloque «En esta frase» da el sentido en contexto, señala los usos figurados o poéticos, y va primero en la tarjeta |
| Lecturas correctas | Claude revisa las lecturas de cada línea, y se puede corregir una a mano |
| Contexto amplio | Claude recibe el guion completo, las ocho líneas vecinas y la traducción |
| Nada se paga dos veces | Lo revisado se guarda por texto de línea, y un estribillo solo se analiza una vez |
| Empezar por lo que se ve | Traducción, corrección y revisión ordenan los tramos según el punto de reproducción |
| El equipo sigue siendo usable | La transcripción descansa, se adapta al uso y se detiene ante fallos repetidos |
| Las páginas no se tocan | El subrayado web usa la CSS Custom Highlight API, sin reescribir el DOM |
| Datos locales | Todo queda en el navegador, y el audio de la transcripción no sale del equipo |

## Limitaciones conocidas

| Limitación | Detalle |
|---|---|
| Idioma de estudio | Solo japonés: la lógica de análisis es específica de este idioma |
| Idioma de la interfaz | Solo español. Las explicaciones de Claude pueden pedirse en español, inglés o japonés sencillo |
| Plataformas | Chrome y Edge de escritorio. El ayudante local está preparado para Windows |
| Sincronización | Sin servidor: el traspaso entre equipos se hace con la copia de seguridad |
| Música de fondo | Whisper puede perder conversaciones en voz baja bajo música fuerte |
