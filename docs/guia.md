<p align="right"><b>Español</b> · <a href="guide.md">English</a> · <a href="de/guide.md">Deutsch</a> · <a href="zh/guide.md">简体中文</a> · <a href="ko/guide.md">한국어</a> · <a href="ja/guide.md">日本語</a></p>

# Guía de uso

Esta guía describe el uso diario de Kotonoha. La instalación está en el [README](../README.md#instalación), y la lista completa de funciones, en [funciones.md](funciones.md).

## Contenido

- [Puesta en marcha](#puesta-en-marcha)
- [Sobre el video](#sobre-el-video)
- [Subtítulos](#subtítulos)
- [Transcripción con Whisper](#transcripción-con-whisper)
- [Tarjetas](#tarjetas)
- [Audio, imágenes y ejemplos](#audio-imágenes-y-ejemplos)
- [Páginas web, lector y biblioteca](#páginas-web-lector-y-biblioteca)
- [Estudiar inglés](#estudiar-inglés)
- [Estudiar alemán](#estudiar-alemán)
- [Gasto en Claude](#gasto-en-claude)
- [Datos y copia de seguridad](#datos-y-copia-de-seguridad)
- [Atajos de teclado](#atajos-de-teclado)
- [Problemas frecuentes](#problemas-frecuentes)

## Puesta en marcha

La primera vez se abre una bienvenida que pregunta el idioma, el que se quiere estudiar y el nivel, y propone instalar los diccionarios, añadir la clave de Claude y elegir dónde van las tarjetas. Se puede saltar, y volver a verla desde **Ajustes, Apariencia**. Todo se configura después en **Ajustes**, dentro de la ventana de la extensión, que se abre con `Alt+Shift+K`.

| Paso | Dónde | Para qué sirve |
|---|---|---|
| Diccionarios | Ajustes, Diccionarios | JMdict en español, inglés o alemán, acento tonal de Kanjium y frecuencia de JPDB. Se descargan una vez y quedan en el navegador |
| Clave de la API de Claude | Ajustes, Claude | Explicaciones, revisión de lecturas, traducción y corrección. Se guarda solo en el navegador |
| Otros proveedores de IA | Ajustes, Otros proveedores de IA | OpenRouter, DeepSeek u OpenAI con su clave, o LM Studio y Ollama en el propio equipo, para las tareas que se elijan. Claude sigue siendo el de siempre |
| Idioma y nivel | Ajustes, Idioma y nivel | Idioma de la interfaz, y por separado el de las explicaciones y las traducciones. El nivel adapta las explicaciones y decide cuánto furigana se ve al principio |
| Idioma que estudias | **Inicio** y la barra lateral, Ajustes, Idioma y nivel, el menú de la extensión, o **Ajustes de video, Subtítulos** sobre el propio video | Japonés, inglés o alemán. Cada uno guarda sus palabras, diccionarios, tarjetas y ajustes |
| Anki | Ajustes, Tarjetas y Anki | Opcional. Requiere Anki abierto con el complemento AnkiConnect |

La extensión funciona sin clave de Claude: los subtítulos, el diccionario, el furigana, los colores, las tarjetas y Whisper no la necesitan.

**Otros proveedores de IA.** En **Ajustes, Otros proveedores de IA** se añaden OpenRouter, DeepSeek u OpenAI, con su clave, o LM Studio y Ollama en el propio equipo, sin clave. **Ver sus modelos** busca los que ofrece cada uno y **Probar la conexión** le hace una petición mínima. Después, en **Modelo y esfuerzo por tarea**, cada tarea puede usar uno de sus modelos. Las respuestas con estructura se piden con su esquema JSON y, si el proveedor no lo admite, como DeepSeek, en modo JSON con el esquema en las instrucciones; si no admite tantos tokens de respuesta, se piden menos. El gasto se anota con el coste que dice el proveedor (OpenRouter lo dice), y los modelos del propio equipo cuentan cero. Las claves se guardan aparte, como la de Claude, y nunca llegan a las páginas. Las instrucciones están afinadas para Claude: con otros modelos, las respuestas pueden salir peores. Ollama solo atiende a las extensiones si se arranca con `OLLAMA_ORIGINS=chrome-extension://*`.

### Adaptarla

| Opción | Dónde | Para qué sirve |
|---|---|---|
| Lecturas en rōmaji | Ajustes, Idioma y nivel | Para quien aún no lee kana. Vale para los subtítulos, las fichas y las páginas |
| Colores de las palabras | Ajustes, Apariencia | Tres paletas: la habitual, una para daltonismo que se distingue sin rojo ni verde, y una de alto contraste |
| Atajos | Ajustes, Atajos de teclado | Los de sobre el video se cambian ahí. Los que usa el navegador, como la captura de audio, en su página de atajos |
| Tope de gasto | Ajustes, Claude | Al llegar a él, Claude deja de usarse hasta el mes siguiente |
| Sitios sin lector | Ajustes, Lector de páginas, o el botón del borde de la página | Lo apaga solo donde estorbe |

## Sobre el video

Al abrir un video con subtítulos en japonés aparece una barra flotante en la parte superior. Muestra el porcentaje de comprensión estimado, las frases recomendadas, las palabras conocidas y el modo de reproducción. Se oculta sola y reaparece al detener el ratón junto al borde superior, y se queda mientras el ratón siga cerca.

**Subtítulos.** Cada palabra lleva furigana, un color según su acento tonal y un subrayado según su estado: desconocida, rastreada, conocida o ignorada. Los puntos de gramática identificados se muestran como etiquetas.

**Mover los subtítulos.** Se arrastran desde cualquier punto, incluso desde una palabra, a la altura y el lado que se prefiera. La posición se guarda para todos los videos y se conserva en proporción al tamaño del video, también en modo teatro. Un doble clic sobre el fondo, o **Volver a su sitio** en los ajustes de visualización, los devuelve a su lugar.

**Ficha de palabra.** Al pasar el ratón sobre una palabra se abre su ficha, sin ninguna petición a Claude, con definiciones, frecuencia, audio, imágenes, ejemplos, orden de los trazos y enlaces a Jisho, JapanDict, Weblio, Goo, Kotobank, Wiktionary, Forvo y Massif. El enlace a JapanDict abre la entrada exacta de JMdict, no la lista de homógrafos.

**En esta frase.** Con clave de Claude, el botón **¿Qué significa en esta frase?** indica el sentido de la palabra en ese contexto y señala cuándo el uso es figurado o poético. Claude recibe 40 líneas alrededor de la frase y la traducción. Las pestañas **Explicar**, **Desglose** y **Traducir** funcionan igual: preguntan al pulsarlas. Toda respuesta se guarda, de modo que volver a esa palabra en esa frase no gasta nada y la ficha lo indica con **Guardada, sin gasto**. El botón **Profundizar** repite la consulta con Opus 5.5.

**Compartir como imagen.** El botón **Compartir como imagen** de la ficha, junto a la frecuencia, dibuja una tarjeta con la palabra, su furigana y su acento, lo que significa en esa frase (o lo que dice el diccionario, si no se ha preguntado a Claude), la frase donde apareció con la palabra resaltada y el título del video o del libro, y la copia al portapapeles: basta con pegarla en un chat con Ctrl+V. Cada punto de **Gramática en esta frase** tiene el mismo botón, con el patrón, su nivel, su significado y el primer punto de la explicación de Claude. La tarjeta sale en **Tinta** o en **Papel**, como los temas, y recuerda el último estilo; **Guardar imagen** la descarga como PNG. Se dibuja en el navegador, sin enviar nada.

**Trazos.** La pestaña **Trazos** de la ficha enseña cómo se escribe cada kanji de la palabra: los trazos se dibujan uno a uno, en bucle y con su número. Se puede pausar, avanzar de uno en uno y cambiar la velocidad. Los datos son de [KanjiVG](https://kanjivg.tagaini.net): cada kanji se descarga la primera vez y queda guardado en el navegador. Debajo, **Con estos kanji ya conoces** reúne, para cada kanji, las palabras que lo llevan y ya están marcadas como conocidas o en aprendizaje (冷蔵庫: 冷たい, 車庫, 金庫), las conocidas primero: el kanji nuevo se recuerda a partir de lo que ya se sabe.

**Navegador de subtítulos.** Con `G` se abre un panel lateral con todas las líneas, filtros, marcadores y selección múltiple. También permite unir líneas, crear varias tarjetas y sincronizar.

**Modos de reproducción.**

| Modo | Comportamiento |
|---|---|
| Normal | Reproduce sin detenerse ni ocultar subtítulos |
| Escucha preparada | Pausa antes de cada frase y muestra la traducción |
| Lectura intensiva | Pausa antes de cada frase para leerla y después escucharla |
| Escucha intensiva | Oculta los subtítulos hasta que se pronuncia la frase, y después pausa y los muestra |
| Híbrido intensivo | Pausa después de cada frase, con los subtítulos visibles |
| Mostrar al pausar | Solo muestra subtítulos con el video en pausa |
| Enfoque 1D | Se detiene en las frases con una sola palabra desconocida |
| Personalizado | Permite ajustar pausas y velos |

Las escenas sin diálogo pueden acelerarse o saltarse desde el panel de video.

## Subtítulos

### Elegir pistas

El panel **Video y subtítulos**, pestaña **Subtítulos**, permite elegir la pista en japonés y la secundaria. Por omisión se prefieren los subtítulos hechos a mano frente a los automáticos, y los importados por encima de todos.

### Traducir con Claude

El botón **Traducir al español** del panel **Subtítulos con IA**, o **Traducir con Claude** junto a la pista secundaria, traduce los subtítulos japoneses al idioma de apoyo: español, inglés, portugués, francés o alemán.

- El trabajo empieza por el tramo que se está viendo, de modo que esa parte queda lista en segundos.
- El resultado aparece a medida que llega.
- Si se cancela, lo traducido se conserva y una nueva pulsación solo pide las líneas que faltan.

### Corregir subtítulos automáticos

Los subtítulos automáticos confunden a menudo los homófonos. Claude los corrige usando el título y el texto completo como contexto, sin hacer preguntas.

- Está activado por omisión para las pistas automáticas, y se puede desactivar en el panel.
- Solo cambia lo que tiene un error claro. Una línea que Claude considera inventada por el reconocimiento se elimina.
- Las correcciones se guardan y no se vuelven a solicitar.
- El navegador marca las líneas corregidas y permite ver el texto original.

### Crear japonés desde otro idioma

Cuando solo hay subtítulos en otro idioma, Claude puede adaptarlos al japonés. Es una traducción de una traducción, de modo que no coincidirá del todo con lo que se oye. Un archivo de subtítulos en japonés, si existe, siempre será mejor.

### Importar y exportar

Cada pista tiene los botones **Importar** y **Exportar SRT**. También se puede arrastrar un archivo sobre el video. Se admiten SRT, VTT, ASS, SSA, TTML y DFXP.

- Lo importado queda guardado para ese título, y tiene prioridad sobre las pistas del sitio.
- La exportación incluye los ajustes de sincronía.

### Regiones de Netflix

Los subtítulos en japonés de un título de Netflix se guardan al verlos, junto con su identificador. Si el catálogo de otra región ofrece el mismo título sin esa pista, Kotonoha la presenta como «Japonés (guardados)», y como secundarios los que ofrezca esa región. Exportar a SRT e importar el archivo cubre el mismo caso de forma manual.

### Sincronizar

La pestaña **Sincronizar** ajusta el desfase de cada pista. También se puede pulsar **Esta línea suena ahora** en el navegador: con una marca se corrige el desfase, y con dos, también la velocidad. El desfase se ajusta con `Alt+I` y `Alt+O`.

## Transcripción con Whisper

Whisper genera subtítulos en japonés cuando un video no los trae. Se ejecuta en la tarjeta gráfica mediante WebGPU, y el audio no sale del equipo. La primera vez descarga el modelo, que queda guardado en el navegador. En Netflix no se ofrece, porque sus títulos casi siempre traen subtítulos.

| Fuente | Qué hace falta | Velocidad |
|---|---|---|
| Archivo propio, en el reproductor de la aplicación | Nada | Unos 5 minutos por cada 30 de video |
| Video de internet, con el ayudante local | Instalar el ayudante | Unos 5 minutos por cada 30 de video, más la descarga |
| Video de internet, sin el ayudante | Activar la captura de audio con `Alt+Shift+M` o con el interruptor del menú de la extensión | Tiempo real, con unos segundos de retraso |

**Modelos.**

| Modelo | Descarga | Uso |
|---|---|---|
| Automático | | Por omisión. Haas-ja para la voz en japonés, Parakeet para la voz en inglés y en alemán, y Whisper Turbo para las canciones |
| Haas-ja | 1,3 GB | Solo japonés. El más preciso y rápido con voz hablada, también con música de fondo, y con puntuación |
| Parakeet | 1,3 GB | Inglés y alemán. El más preciso y rápido con voz hablada, también con música de fondo, con puntuación y los tiempos más exactos |
| Whisper Turbo | 1,5 GB | El mejor con canciones |
| Whisper Turbo ligero | 564 MB | Algo menos preciso, con menos memoria de video |
| Whisper Base | 165 MB | Para equipos sin una GPU potente |

En automático, un video es una canción si se ha pegado su letra, si el sitio lo clasifica como música o si el título lo dice, como «MV» o «歌ってみた». Con voz hablada en japonés, Haas-ja comete un 3 % de errores frente al 9 % de Whisper Turbo, y transcribe 30 minutos en alrededor de un minuto, frente a unos 5. Con canciones escribe solo una parte de lo que se canta, y ahí Whisper Turbo es mejor. En inglés pasa lo mismo con Parakeet: un 6,8 % de errores frente al 9,6 % de Whisper Turbo, y tiempos tres veces más exactos. Mientras transcribe, el panel indica qué modelo está trabajando.

Los modelos se guardan en el navegador y no se vuelven a descargar: cada vez se leen del disco, lo que puede tardar unos segundos. En **Ajustes, Transcripción de voz, Modelos guardados** se ve lo que ocupa cada uno y se puede borrar. Desinstalar la extensión también los borra.

**Intensidad.** Determina qué fracción del tiempo trabaja la tarjeta gráfica. El resto lo descansa, y el descanso crece solo si otra aplicación la está ocupando.

| Intensidad | Ocupación | 30 minutos de video |
|---|---|---|
| Automática | 75 % con el equipo en uso, 90 % tras dos minutos sin uso | Unos 5 minutos |
| Suave | 30 % | Unos 12 minutos |
| Rápida | 90 % | Unos 4 minutos |

Durante la transcripción se puede pausar para liberar la tarjeta al instante y reanudar por el mismo punto. Si el controlador de video se reinicia, Whisper espera 20 segundos, recarga el modelo y continúa a la mínima intensidad. Al segundo fallo se detiene, y lo transcrito queda guardado.

### Letras de canciones

Whisper acierta los tiempos, pero en una canción falla muchas palabras. Si alguien ha publicado la letra, por ejemplo en un comentario del video, se puede pegar en **Letra de la canción**, en el panel **Subtítulos con IA**, y Claude la coloca sobre esos tiempos.

- Claude solo indica qué verso suena sobre qué líneas de la transcripción. Las palabras salen tal cual de la letra, y los tiempos, de Whisper.
- Si la letra se pega antes de transcribir o durante la transcripción, se ajusta sola al terminar, y no se gasta en corregir ni en revisar lo que Whisper oyó. Si el video ya tiene una pista, también sirve como referencia de tiempos, con **Ajustar la letra a estos tiempos**.
- Un estribillo escrito una sola vez se coloca en cada sitio donde suene. Lo que no se canta, como marcas de sección, rōmaji o traducciones, se ignora.
- Un verso que Whisper no recogió recibe un tiempo estimado, y el aviso final dice cuántos hay. En ese caso, **Esta línea suena ahora**, en el navegador, permite afinar la sincronía.
- El resultado es una pista más, «Japonés (letra)», guardada para ese video. La transcripción original sigue disponible. Se hace una sola petición a Claude por canción, y repetir el ajuste con la misma letra no vuelve a gastar.
- En un video de internet sin el ayudante local, Whisper tiene que oír la canción entera: al terminar el video, la transcripción se detiene sola y la letra se ajusta.

### Ayudante local

Una extensión no puede descargar por sí sola el audio de un video. El ayudante es un pequeño programa local escrito en PowerShell, que viene con Windows: no hace falta instalar Python ni FFmpeg. Baja el audio con [yt-dlp](https://github.com/yt-dlp/yt-dlp) y, además, actualiza la extensión (ver **Versiones nuevas**, en [Datos y copia de seguridad](#datos-y-copia-de-seguridad)). Se descarga de la página de la última versión, en `kotonoha-X.Y.Z-ayudante.zip`, se descomprime en cualquier carpeta y se hace doble clic en `Instalar.cmd`. El instalador:

- copia el ayudante a `%LOCALAPPDATA%\Kotonoha\ayudante`, de modo que la carpeta descomprimida ya no hace falta;
- baja yt-dlp y QuickJS, con el que yt-dlp resuelve el desafío de YouTube, de sus páginas oficiales en GitHub, y comprueba el SHA-256 de cada uno;
- busca Kotonoha en Chrome, Edge, Brave y Chromium, y registra el ayudante para cada copia que encuentra;
- si no encuentra ninguna, ofrece instalar también la extensión, con un identificador fijo, y explica cómo cargarla.

El estado se comprueba en **Ajustes, Transcripción**. Si el instalador no encuentra una copia, Ajustes muestra la orden con su identificador, para ejecutarla en la carpeta del ayudante:

```bash
powershell -ExecutionPolicy Bypass -File instalar.ps1 -Extension IDENTIFICADOR
```

| Aspecto | Comportamiento |
|---|---|
| Alcance | Solo la extensión puede llamarlo, y solo acepta direcciones http o https |
| Registro | Añade una clave por usuario en `HKCU`, sin permisos de administrador |
| Conversión | Con FFmpeg en el equipo, el ayudante convierte el audio. Sin él, lo convierte la extensión con su propio FFmpeg, algo más despacio |
| yt-dlp | Se pone al día solo una vez por semana: YouTube cambia a menudo |
| Archivos | Usa una carpeta temporal que se borra al terminar o al cancelar |
| Desinstalación | Doble clic en `Desinstalar.cmd`. La extensión y sus datos no se tocan |

Si un video no se puede descargar, por ejemplo por ser privado o tener restricción de edad, el aviso ofrece transcribirlo mientras se reproduce.

## Tarjetas

| Atajo | Acción |
|---|---|
| `Q`, `Alt+Q` | Crea una tarjeta con la palabra y la frase actuales |
| `E` | Envía la palabra, la selección o la imagen bajo el ratón al creador de tarjetas |

Las tarjetas pueden enviarse a Anki mediante AnkiConnect, con un tipo de nota propio o con el que crea la extensión, o guardarse en **Memoria**, el repaso integrado con FSRS. Los campos incluyen frase, furigana, traducción, definiciones, audio, imagen y notas. La captura de audio se activa con `Alt+Shift+M` o con el interruptor del menú de la extensión.

**Audio e imagen del video.** Para grabar el audio de la frase hay que activar la captura en la pestaña del video, con `Alt+Shift+M` o con el interruptor del menú de la extensión. La captura es solo de esa pestaña: si está activa en otra, el icono del micrófono aparece apagado y la tarjeta se crea sin audio. Al crear la tarjeta, la línea vuelve a reproducirse a velocidad normal mientras se graba, y después el video queda donde estaba. La imagen no incluye nada de la interfaz. En sitios con DRM, como Netflix, el navegador entrega el fotograma en negro: la tarjeta lleva entonces la imagen oficial del episodio, o ninguna si el sitio no la ofrece. Un sitio protegido también puede no entregar su sonido: la tarjeta se crea sin audio y, tras dos frases mudas seguidas en un video, la línea ya no se vuelve a reproducir para grabarla.

## Audio, imágenes y ejemplos

| Elemento | Origen | ¿Requiere clave? |
|---|---|---|
| Audio de la palabra | JapanesePod101 y Lingua Libre, por Wikimedia Commons | No |
| Audio de la frase | Grabado de la pestaña con `tabCapture`, en el propio equipo, y convertido a MP3 | No |
| Voces sintéticas | Azure Speech, si se configura. En su defecto, las del navegador: la mejor que ofrezca, u otra elegida en **Ajustes, Voces**, solo para escuchar | Solo para Azure |
| Voz local | AivisSpeech o VOICEVOX, abiertos en el propio equipo, solo en japonés: lee con el acento del diccionario, y sus audios sirven también para las tarjetas | No |
| Imágenes | Openverse, con la primera glosa en inglés de JMdict como búsqueda | No |
| Fotograma | Captura del video, en el propio equipo | No |
| Ejemplos | Frases ya vistas por el usuario, guardadas en el navegador | No |
| Frase de ejemplo para una tarjeta | Claude, solo si la tarjeta no tiene frase | Claude |

## Páginas web, lector y biblioteca

**Páginas web.** En cualquier página con texto japonés, el lector subraya las palabras según lo que se sabe de ellas y les añade furigana. Un clic en una palabra abre su ficha. En enlaces y botones el clic sigue siendo del sitio, y la ficha se abre al dejar el ratón encima, o al momento con `Shift`. Arrastrar sigue seleccionando texto, y con la ficha abierta funcionan `1` a `4` y `Q`.

El botón del borde derecho ajusta los colores y el furigana sin salir de la página, y el menú de la extensión enciende y apaga el lector. El furigana tiene cuatro modos: en todas las palabras, solo en las nuevas, al pasar el ratón o nunca. En **Ajustes, Lector de páginas** se puede pedir que la ficha se abra siempre al pasar el ratón, o que el clic en enlaces también consulte.

Nada de esto añade nada al contenido de la página. Los colores usan la CSS Custom Highlight API y las lecturas van en una capa aparte, de modo que seleccionar, copiar y buscar siguen igual, y no interfiere con aplicaciones como las hechas con React. También funciona en lo que se desplaza dentro de una caja, como la conversación de un chat: el furigana se mueve con el texto y pasa por debajo de la barra de escribir. No actúa sobre campos de texto ni sobre texto en chino o coreano.

**Separar líneas.** Muchas páginas dejan poco aire entre líneas, y el furigana chocaría con la línea de arriba. Ahí se abre el interlineado de ese texto, solo lo necesario, y es lo único que el lector puede mover en una página. No se hace en botones ni en menús, ni donde el texto se saldría de una caja de alto fijo: en esos casos, si no hay ningún aire, el furigana se deja para cuando se pasa el ratón. El interruptor **Separar líneas**, en el botón del borde, lo desactiva, y entonces el diseño no se mueve nada.

`Alt+K`, `Alt+U` y `Alt+I` marcan en bloque el texto seleccionado como conocido, desconocido o ignorado.

**Cuaderno.** Lo que antes era el Portapapeles: una página a todo lo ancho para escribir y pegar texto con formato, y leerlo con las mismas ayudas que los subtítulos. Arriba, **Editar** y **Leer** cambian de modo en la misma página. Al editar, el selector de bloque pone **Texto**, **Título**, **Subtítulo**, **Apartado** o **Código**, y los botones, **Lista**, **Lista numerada**, **Cita** y **Negrita**. También se escribe con los atajos de costumbre: `# ` al empezar una línea para un título, `- ` (o ・ en japonés) para una lista, `1. ` para una numerada, `> ` para una cita, Tab para un subpunto y Ctrl+B para la negrita. Lo pegado de una página conserva su estructura y deja fuera su furigana, y el Markdown que se copia del chat de Claude entra con su formato. **Organizar** le pide a Claude que ponga título, subtítulos, párrafos y listas a un texto pegado de corrido, sin cambiar las palabras; si cambiara alguna, lo avisa, y Ctrl+Z lo deja como estaba. Lo escrito se guarda solo en el navegador; **Guardar en la biblioteca** lo lleva a la biblioteca, y desde entonces se guarda también allí. **Nota nueva** empieza otra en blanco sin perder la anterior: si no estaba en la biblioteca, va a ella. Un texto de la biblioteca se vuelve a editar con **Editar en el Cuaderno**. Todo se guarda como Markdown, que sigue siendo texto: se lee igual en la biblioteca y en la copia de seguridad.

**Modo web.** La ventana de la aplicación no tiene pestañas, así que no puede entrar en la vista dividida del navegador. El botón **Modo web** del Cuaderno lo abre en una pestaña normal, sin la barra lateral, y **Abrir el Cuaderno junto a esta pestaña**, en el menú de la extensión, lo pone directamente al lado de la página que se esté viendo (Chrome 155 o posterior). En esa pestaña, **Seguir el portapapeles** añade al final lo que se copie en cualquier sitio en la lengua que se estudia, mientras la pestaña esté a la vista. **Abrir la selección en el Cuaderno**, en el menú del texto seleccionado de cualquier página, también lo añade al final. Es una página de la propia extensión: no necesita servidor, funciona sin conexión y el texto no sale del equipo.

**Dictar.** **Dictar**, en el Cuaderno, graba con el micrófono y añade lo dicho al final, en un párrafo propio, y lo enseña ya analizado y con furigana. Mientras graba se ven el tiempo y el nivel del micrófono; **Terminar** acaba la grabación y **Cancelar** la descarta. La transcripción se hace en el equipo con el modelo elegido en **Ajustes**, en «Transcripción de voz»: en automático, Haas-ja para el japonés y Parakeet para el inglés y el alemán. El modelo se carga mientras se habla, así que al terminar la transcripción tarda unos segundos. Ni la grabación ni el texto salen del equipo. Encima del párrafo queda la grabación, para volver a oírla, y va con el texto cuando se guarda en la biblioteca. Al editar, la grabación es un bloque «Grabación del dictado»: si se quita, el párrafo se queda y la grabación se borra más adelante, pasada una semana desde que se grabó. La primera vez, el navegador pide permiso para usar el micrófono. Cada grabación dura diez minutos como mucho.

**Leer en voz alta.** En el Cuaderno, en los textos de la biblioteca y en la vista de texto del visor, **Leer en voz alta**, en la barra de abajo, lee el texto frase a frase con la voz de las frases: la local, la neuronal, la de Azure o la del navegador. El botón de la velocidad pasa por 0,6×, 0,8×, 1× y 1,2×, y el del modo, por **Seguido**, **Frase a frase**, que se para al acabar cada frase, y **Repetir**, que repite la misma frase con un respiro para decirla a la vez. Los dos se recuerdan. Al seleccionar con el ratón cualquier trozo del texto aparece **Escuchar**, que lo lee, y en japonés **Practicar**, que abre la práctica del acento con ese trozo: una palabra, media frase o varias frases.

**Practicar el acento.** En el Cuaderno, en los textos de la Ayuda de lectura y en la vista de texto del visor, **Practicar**, en la barra de abajo, abre la práctica de la frase en curso; **Frase anterior** y **Frase siguiente** pasan a otra. Sobre cada palabra se dibuja su acento: una línea, alta o baja en cada mora, que cae tras el núcleo. **Oír la frase** la lee con la voz de Azure, si hay clave, o con la del navegador. **Grabar** graba la frase leída en voz alta, veinte segundos como mucho. Kotonoha mide el tono de la grabación en el propio navegador y la transcribe en el equipo con Haas-ja, que dice dónde suena cada palabra. La gráfica pone la curva del tono de la voz sobre el acento esperado, y cada palabra lleva un veredicto: **Bien**, si el tono cae donde debe; **Revisar**, si cae en otro sitio o no cae, con dónde debía caer y dónde cayó; **Sin juzgar**, en las formas conjugadas cuyo acento no se sabe, y **No se reconoció**, si la palabra no aparece en la grabación. También se señalan las pausas largas entre palabras dentro de una frase. **Oír tu grabación** la reproduce y **Volver a grabar** repite la prueba. Se juzga dónde cae el tono, que es lo que distingue el acento: la subida del principio, que en el habla seguida a veces no se hace, no cuenta, ni la última mora antes de una pausa, que lleva la entonación de la frase. El acento de cada palabra sale del diccionario «Acento tonal (Kanjium)»; sin él, solo se juzgan las formas corteses en 〜ます, cuyo núcleo no depende del verbo. Es una orientación: con frases leídas, la medida automática no acierta siempre. Ni la grabación ni el texto salen del equipo, y la grabación no se guarda. El modelo de voz se carga al abrir la práctica y sigue cargado mientras esté abierta: la primera grabación espera a que termine de cargarse, unos treinta segundos en el equipo de desarrollo, y las siguientes se analizan en menos de un segundo.

**Moras especiales.** Con **Comprobar también っ, ん y vocales largas**, en el panel de la práctica, Kotonoha mira además si en la grabación falta o sobra una mora especial: una っ que no se oye (きて por きって), una ん (かじ por かんじ), una vocal larga dicha corta (おばさん por おばあさん) o una de más (おばあさん por おばさん). Cada aviso, con la etiqueta **Mora**, dice en qué palabra, y la mora queda marcada en el acento esperado; sin avisos, **Moras** dice que ni faltan ni sobran. Lo oye narabas, un modelo de fonemas del japonés que corre en el equipo: en la GPU si calcula igual que el procesador, y si no en el procesador. La primera vez se descargan 1,26 GB de la publicación de su autor en GitHub, que se comprueban con su SHA-256 y quedan en el navegador; **Ajustes, Transcripción de voz**, en **Modelos guardados**, los borra. No se juzga la っ delante de s, sh, z, j, h o f, que el modelo no marca, ni una frase que se dijo de otra manera o que no se reconoció. Una vocal alargada o una pausa al final de una palabra tampoco cuentan: son titubeos, no errores de la palabra. Medido con pares mínimos dichos por dos voces sintéticas: vio 17 de 22 moras que faltaban y 10 de 10 de más, y no avisó de nada en 22 de 24 frases bien dichas.

**Voz local.** Con AivisSpeech o VOICEVOX abiertos en el equipo, Kotonoha lee las frases en japonés con ellos: la lectura en voz alta, **Oír la frase** en la práctica, la ficha y el audio de las tarjetas. En **Ajustes, Voces**, la **Voz local** dice si encontró alguno en sus puertos de siempre (10101 para AivisSpeech, 50021 para VOICEVOX), se activa con **Leer las frases con la voz local** y se elige la **Voz y estilo**. Con **Acento del diccionario**, antes de leer corrige el acento de cada palabra con el del diccionario de acento, así que la voz modelo dice lo que el diccionario dice. Los audios se guardan en una caché: una frase ya leída suena al momento. Si el programa está cerrado, se lee con Azure, si hay clave, o con la voz del navegador. AivisSpeech es gratis y nada sale del equipo.

**Ayuda de lectura.** Guarda libros EPUB, CBZ y PDF y carpetas de imágenes, que se abren en el visor, y textos y subtítulos SRT, con el punto de lectura y la estructura de cada capítulo. También puede generar relatos con Claude ajustados al nivel configurado.

**Visor.** Los EPUB hechos de imágenes, como el manga y los libros escaneados, los CBZ y los PDF se abren en el visor, en una pestaña propia, como en un lector de PDF. Tiene zoom (**Acercar**, **Alejar**, **Ajustar al ancho** y **Página completa**, también con Ctrl y la rueda del ratón), tres vistas (**Una página**, **Doble página** y **Desplazamiento continuo**), **Miniaturas**, el **Índice** del libro y **Pantalla completa**. Un libro que declara que se lee de derecha a izquierda, como el manga, se muestra así: la flecha izquierda avanza, y en doble página la portada puede ir sola para que las parejas coincidan con el tomo impreso. Las flechas, Inicio y Fin pasan de página, y F activa la pantalla completa. El archivo se guarda tal cual en el almacenamiento del navegador y se lee a trozos, sin cargarlo entero, y el visor recuerda la página, la vista y el zoom de cada libro.

**Carpetas de imágenes.** El manga que viene en imágenes se importa con **Elegir una carpeta de imágenes** o arrastrando la carpeta. Cada carpeta con imágenes es un libro. Si solo trae subcarpetas que parecen tomos, por su nombre («第01巻», «Vol. 2», «v03») o por traer unas doscientas imágenes, cada tomo entra aparte, con el nombre de la serie delante si el suyo es solo el número; si parecen capítulos, son el índice de un solo libro. Las páginas van en orden natural, con la portada delante aunque se llame «cover.jpg»; lo que no es imagen se ignora, y un ComicInfo.xml da el título y el sentido de lectura. Cada libro se guarda como un CBZ, sin volver a comprimir las imágenes ni copiarlas en memoria. En **Doble página**, una página apaisada, que es una doble página escaneada de una pieza, va sola.

**Colecciones y progreso.** Los libros se agrupan en colecciones, como una serie con sus tomos o los libros de un tema. Una carpeta con varios tomos entra ya como una colección con su nombre, y un tomo nuevo de esa carpeta se añade a ella. **Nueva colección** crea una a mano, con su nombre, su tipo (**Manga**, **Novela**, **Estudio** u **Otro**) y una descripción. Dentro de una colección, **Añadir libros** trae libros de la estantería, **Importar aquí** importa archivos directamente en ella, **Portada** elige la de uno de sus libros o una imagen propia, y **Quitar la colección** deja sus libros en la estantería. Cada libro muestra cuánto se ha leído y queda **Terminado** al llegar a su última página; su menú lo cambia de colección, le cambia la portada, lo marca como terminado o lo deja para volver a empezar. **Seguir leyendo**, arriba de la estantería, lleva a lo que se está leyendo, y los filtros **Leyendo**, **Sin empezar** y **Terminados** muestran cada cosa, también dentro de las colecciones. Un PDF trae su portada y su número de páginas desde que se importa, y en el visor **Usar esta página como portada** convierte cualquier página en la portada.

**Texto de las páginas.** El botón **Leer el texto de las páginas** reconoce el texto de las páginas de imagen en el propio equipo, con la GPU, y lo deja encima de la página: al pasar el ratón se marca cada línea, y al tocarla se abre a un lado con furigana y palabras para consultar, con su ficha y la creación de tarjetas. Hay dos modos: **Libro**, para libros impresos y PDF escaneados, y **Manga**, para globos y texto vertical, que no confunde el furigana con el texto. En inglés y alemán, el segundo se llama **Cómic** y lee cada globo con el reconocedor de libros, de izquierda a derecha. En **Libro**, el furigana impreso no se mezcla con el texto y una página a dos columnas se lee columna a columna; en **Manga**, los globos van en el orden de las viñetas y se dejan fuera las marcas de agua y los números de página. Un libro que se lee de derecha a izquierda empieza en modo **Manga**. En un PDF que ya trae su propio texto se usa ese texto; si es la capa de otro programa de OCR, con errores, al apagar **Texto del PDF** Kotonoha lee también esas páginas. En un PDF escaneado, el OCR lee la imagen escaneada tal cual, a su resolución, y no la página pintada en pantalla: así se equivoca mucho menos. La primera vez se descargan los modelos, 25 MB para libros y 178 MB para manga, y cada página se lee una sola vez, en uno o dos segundos. El OCR puede confundir letras parecidas o perder los subíndices de una fórmula; la imagen original sigue a la vista. Las páginas siguientes se leen antes de llegar a ellas, así que al pasar de página su texto ya está. Si una línea sale con una letra cambiada, **Editar**, en el panel de la línea, permite escribir su texto a mano: lo editado se guarda aparte, no se pierde aunque la página se vuelva a leer, y **Restaurar** vuelve al texto leído. Desde la tarjeta de cada libro, en la Ayuda de lectura, **Procesar** lee con el OCR todas sus páginas de una vez, con el avance a la vista; se puede pausar y seguir más tarde sin perder nada, y al acabar el libro queda con **Texto listo** y el OCR encendido.

**Notas y marcadores.** En los libros de páginas, **Marcar esta página** cuelga una cinta en la página, que se ve también en las miniaturas. En el panel de una línea, **Resaltar** la pinta en uno de cuatro colores, y **Subrayar** la subraya; con una palabra elegida, o un tramo seleccionado arrastrando, se puede marcar solo eso. Cada resaltado admite un comentario, con **Comentar**. **Añadir una nota** deja una nota en el punto de la página que se toque: un papelito que se abre para leerla o cambiarla. El panel **Notas y marcadores** lo reúne todo por páginas, lleva a cada cosa, la edita o la quita, y **Copiar** lo pone en el portapapeles como texto. Los resaltados se guardan sobre la imagen de la página, así que siguen en su sitio aunque el OCR la vuelva a leer, y todo entra en la copia de seguridad.

**Buscar en el libro.** **Buscar en el libro**, o Ctrl+F, busca una palabra en todas las páginas que tienen texto: el que trae el PDF y el que leyó el OCR, con lo editado encima. No distingue mayúsculas, anchos ni hiragana y katakana, y en japonés encuentra también una palabra partida entre dos renglones. Lo encontrado sale por páginas, con un poco de texto alrededor; Intro lleva al siguiente y Mayúsculas+Intro al anterior, y en la página queda marcado. Las páginas que el OCR aún no ha leído no se buscan: el panel dice cuántas son, y **Procesar** las lee todas de una vez.

**Vista de texto.** **Ver como texto** cambia la imagen de la página por su texto, con los renglones juntos en párrafos y los títulos aparte, y con la ayuda de lectura del Cuaderno: furigana, colores, la comprensión, **Leer en voz alta** y las fichas para crear tarjetas. En un manga, cada globo es un párrafo. Las páginas se pasan igual que en la imagen, y **Ver las páginas** vuelve a ella. Cada libro recuerda en qué vista se dejó.

**Revisar con Claude.** **Revisar el texto con Claude** manda a Claude la imagen de la página y el texto leído, y Claude propone solo las líneas que no coinciden con la imagen. Cada cambio se enseña letra a letra, se eligen los que se aplican y nada cambia hasta pulsar **Aplicar**. Una línea revisada lleva «Revisado con Claude» en su panel, y **Restaurar** la devuelve a como estaba. Hace falta la clave de Claude. La tarea usa Claude Haiku 5.5, que cuesta menos de un céntimo de dólar por página, y su modelo se cambia en **Ajustes**, en «Revisión del texto de las páginas». Revisar otra vez la misma página con el mismo texto no se vuelve a pagar. La página revisada se envía a Claude, como cualquier otra consulta; el resto del libro no sale del equipo.

**Libros de texto.** Un EPUB de texto, como una novela, se abre en el visor con su propio formato: sus capítulos, su CSS, su ruby, sus ilustraciones y su escritura vertical. Encima va el lector de páginas, como en una web: colores, furigana y un clic en una palabra para abrir su ficha. Las flechas, Re Pág, Av Pág y la rueda pasan de página; en un libro vertical se avanza hacia la izquierda, y al final de un capítulo se pasa al siguiente. El **Índice** lleva a cada capítulo, los enlaces del libro funcionan, **Acercar** y **Alejar** cambian el tamaño del texto y **Texto vertical** permite leer en horizontal un libro vertical. El visor recuerda el capítulo y el punto exacto. Nada de lo que trae el libro se ejecuta ni carga nada de internet.

**PDF con texto.** Si un PDF trae su texto, se usa directamente, sin OCR ni descargas: basta con tocar una línea. Al tocar una palabra en la página, en un PDF con texto o en una página leída en modo **Libro**, su ficha se abre directamente y la palabra queda marcada sobre la página.

**Reproductor local.** Reproduce archivos propios, con los subtítulos incrustados de un MKV y la elección de pista de audio, mediante ffmpeg.wasm.

**Palabras y evaluación.** El explorador lista el vocabulario por estado, y la evaluación de nivel estima las palabras conocidas de partida.

**Horas de inmersión.** Kotonoha cuenta el tiempo que se escucha y se lee la lengua que se estudia: un video en marcha con subtítulos en esa lengua, también un archivo propio; un libro abierto en el visor; y el Cuaderno o un texto de la biblioteca mientras se lee, es decir, con la página a la vista y algo hecho en ella en los últimos tres minutos. El video en pausa no cuenta. **Inicio** enseña las horas de hoy, de los últimos siete días y del total, la **Racha** de días seguidos con al menos cinco minutos, una barra por cada día de la semana y lo que más se ha visto y leído. Cada lengua lleva su propia cuenta, y la copia de seguridad la incluye.

## Estudiar inglés

El idioma se elige en la bienvenida, en **Ajustes, Idioma y nivel** o en el menú de la extensión. Cada uno tiene sus propias palabras, diccionarios, tarjetas, biblioteca y ajustes de lectura, y al volver a otro todo sigue donde estaba. La interfaz, la clave de Claude y el gasto son comunes.

Todo lo que explica esta guía funciona igual, con estas diferencias:

| Elemento | En inglés |
|---|---|
| Diccionarios | Wiktionary en el idioma de la interfaz, en dos partes: definiciones y traducciones breves. Con la interfaz en inglés se propone el inglés-inglés, que descarga unos 110 MB y ocupa unos 220 MB |
| Pronunciación | IPA americana y británica en la ficha. Sobre las palabras empieza apagada, y se enciende en el panel **Visualización**. Cuál de las dos se escribe se elige en **Ajustes, Idioma y nivel** |
| Color de acento | Indica la sílaba tónica: la primera, una del medio o la última. También empieza apagado |
| Formas | La ficha dice de qué palabra viene cada una: *went* abre *go*, y *didn't*, *do* |
| Verbos con partícula | La ficha los busca aunque vayan separados: en *picked it up* aparece *pick up*. Lo mismo con las frases hechas |
| Gramática | Puntos de A1 a C2, con la misma confirmación de Claude |
| Lector de páginas | Empieza apagado, porque hay inglés en casi todas las páginas. Se enciende en el menú de la extensión o en **Ajustes, Lector de páginas** |
| Trazos y corrección de lecturas | No se ofrecen |
| Cómics | En el visor, el modo **Cómic** (el de **Manga** en japonés) lee cada globo con el reconocedor de libros, en el orden de las viñetas y de izquierda a derecha. Medido: un 0,4 % de error por carácter en páginas de prueba y un 12 % en una página de *Krazy Kat* de 1922, rotulada a mano |
| OCR de libros | Medido con un escaneo real del siglo XIX: un 1,5 % de error por carácter, casi todo en la cabecera de la página |
| Voz de las frases | En **Ajustes, Voces**, **Voz neuronal en el navegador** lee las frases con Kokoro, en el propio equipo y sin clave, con seis voces de Estados Unidos y del Reino Unido. La primera vez descarga 92 MB; cada frase nueva tarda unos segundos en el procesador y después queda guardada |

## Estudiar alemán

Se elige como el inglés, y todo funciona igual, con estas diferencias:

| Elemento | En alemán |
|---|---|
| Diccionarios | Wiktionary en el idioma de la interfaz, con definiciones y traducciones breves, y además el alemán–inglés, que se propone siempre porque trae las formas conjugadas y declinadas de cada palabra: descarga unos 17 MB. Con la interfaz en alemán se propone también el alemán–alemán, de unos 55 MB |
| Formas | La ficha abre la palabra de la que sale cada forma y dice cuál es: *ging* abre *gehen*, en pretérito, y *Häuser*, *Haus*, en plural. Si una forma puede salir de dos palabras, como *schönen*, gana la más frecuente. Los artículos van a *der* y *ein*, y las formas de *sein*, a *sein* |
| Verbos separables | La ficha los busca aunque la partícula vaya al final de la oración: en *fängt morgen an* aparece *anfangen*. Lo mismo con las frases hechas |
| Pronunciación | IPA en la ficha, sin las variantes regionales. Sobre las palabras empieza apagada, igual que el color de acento, que indica la sílaba tónica |
| Gramática | Puntos de A1 a C2, como el Perfekt, el Konjunktiv, la pasiva o las subordinadas con el verbo al final, con la misma confirmación de Claude |
| Transcripción | Parakeet para la voz y Whisper Turbo para las canciones. Con una grabación real, Parakeet escribió con mayúsculas y puntuación en menos de la mitad del tiempo de Whisper |
| Lector de páginas | Empieza apagado. Se enciende en el menú de la extensión o en **Ajustes, Lector de páginas** |
| Trazos y corrección de lecturas | No se ofrecen |
| Cómics | El modo **Cómic**, como en inglés, con ä, ö, ü y ß: un 0,4 % de error en páginas de prueba |
| OCR de libros | Lee bien la letra moderna: un 0,03 % de error en páginas de prueba con cuatro tipografías. La letra gótica (Fraktur) de los libros antiguos no se lee: en una página de 1919 falló tres de cada cuatro letras |
| Voz de las frases | **Voz neuronal en el navegador** lee las frases con Piper, con la voz de Thorsten, en el propio equipo y sin clave. La primera vez descarga 63 MB, y lee una frase en menos de un segundo |

## Gasto en Claude

La pantalla de inicio incluye la tarjeta **Gasto en Claude**, con lo gastado en el mes frente al crédito indicado en Ajustes, una gráfica por días y modelos, el reparto por tareas y un registro de cada petición, con sus tokens. El coste se calcula con los tokens que informa la API y sus precios públicos, y solo cuenta lo pedido desde esta extensión en este navegador.

Lo que más gasta por video es la corrección de los subtítulos automáticos, seguida de la traducción y de la revisión de lecturas, sentidos y gramática. La revisión cubre unos minutos por delante del punto de reproducción y continúa a medida que avanza; lo revisado queda guardado. Se puede desactivar en **Generar subtítulos**, o pedir el video entero con **Revisar todo el video**. El [estudio de costos](costos.md) da las cifras medidas, por video y por mes.

Tres ajustes deciden cuánto se usan las consultas de palabras:

| Ajuste | Dónde | Por omisión | Efecto |
|---|---|---|---|
| Preguntar el significado al abrir una palabra | Ajustes, Claude | Desactivado | Cada palabra nueva que se abra sería una petición |
| Guion completo como contexto | Ajustes, Claude | Desactivado | Más contexto para nombres y referencias, a mayor coste por consulta |
| Pestaña inicial | Ajustes, Diccionarios | Solo el diccionario | Una pestaña de Claude preguntaría al abrir cada palabra |

## Datos y copia de seguridad

Todos los datos se guardan en el navegador, en IndexedDB. **Ajustes, Tus datos** permite exportar e importar un solo archivo con las palabras, tarjetas, biblioteca, subtítulos generados y correcciones de cada idioma que se haya usado, junto con los ajustes y el registro de gasto. Las claves de API y los diccionarios no se incluyen. Una copia anterior a la versión 0.4.0 se restaura como japonés.

**Copia completa.** **Exportar a una carpeta** guarda, además, los archivos de los libros, lo que el OCR leyó y lo editado, y los dictados, en una carpeta con la fecha. **Restaurar de una carpeta** lo pone todo en otra copia sin borrar lo que ya tenga. Sirve para pasar Kotonoha a otro equipo, o a una copia instalada con el identificador fijo, porque cada copia guarda sus datos aparte. Los diccionarios y los modelos se vuelven a instalar desde Ajustes.

**Versiones nuevas.** Una vez al día, Kotonoha pregunta a GitHub cuál es la última versión publicada. Si es más nueva que la instalada, lo dice en **Inicio** y en el menú de la extensión, con un enlace a su página. El aviso de una versión se cierra y no vuelve hasta la siguiente. **Ajustes, Versión** muestra la versión instalada, busca a mano y apaga los avisos con **Avisar de versiones nuevas**. Con el ayudante instalado, en una copia cargada desde una carpeta, el aviso y **Ajustes, Versión** ofrecen **Actualizar ahora**: el ayudante descarga el paquete, comprueba su SHA-256 con el `SHA256SUMS.txt` de la versión, lo copia sobre la carpeta de la extensión conservando su identificador, y la extensión se recarga sola en cuanto nada esté en marcha. Las copias de las tiendas se actualizan solas.

## Atajos de teclado

La referencia completa está en el panel de atajos, sobre el video. Se pueden cambiar en **Ajustes, Atajos de teclado**, y también funcionan con teclados coreanos, rusos o con el japonés activado, porque se guía por la posición de la tecla.

| Grupo | Atajo | Acción |
|---|---|---|
| Barra | `Alt+X` | Fijar o soltar la barra |
| | `Alt+V` | Mostrarla mientras se mantiene |
| | `Alt+T` | Abrir el traductor |
| Palabra | `1` o `U` | Marcar como desconocida |
| | `2` o `T` | Rastrear |
| | `3` o `K` | Marcar como conocida |
| | `4` o `I` | Ignorar |
| | `N` | Ir a la siguiente palabra desconocida |
| | `Alt+S` | Consultar en el diccionario |
| Tarjetas | `Q`, `Alt+Q` | Crear tarjeta |
| | `E` | Enviar al creador |
| | `Alt+Shift+M` | Permitir la captura de audio |
| Selección | `B` | Marcar el subtítulo |
| | `L` | Seleccionar el subtítulo |
| | `J` | Unir los seleccionados |
| Video | `A` o `←` | Subtítulo anterior |
| | `D` o `→` | Subtítulo siguiente |
| | `S` o `↓` | Repetir el subtítulo |
| | `Alt+→`, `Alt+←` | Avanzar o retroceder 5 segundos |
| Subtítulos | `R` | Mostrar u ocultar todo |
| | `W` o `↑` | Mostrar u ocultar el japonés |
| | `G` | Navegador de subtítulos |
| | `C` | Copiar el subtítulo |
| | `Alt+Shift+G` | Generar secundarios |
| Aplicación | `Alt+Shift+K` | Abrir la ventana de Kotonoha |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Tras compilar, nada cambia | El navegador conserva el service worker anterior. Hay que pulsar **Recargar** en la página de extensiones |
| «Para oír el video activa la captura de audio» | Chrome exige una acción del usuario para capturar una pestaña. Se resuelve con `Alt+Shift+M` o con el interruptor del menú de la extensión, en la pestaña del video |
| Un atajo de `Alt+Shift+M`, `Alt+Shift+K` o `Alt+Q` no responde | Chrome no asigna a una extensión una tecla que ya tenga otra, aunque esté desactivada, y no avisa. El menú de la extensión y el panel de atajos muestran la tecla real, y se puede cambiar en `chrome://extensions/shortcuts` |
| `Alt+R` o `Alt+Z` abren Radeon Software | Son atajos de esa aplicación en los equipos con gráfica AMD. Kotonoha usa `Alt+Shift+M` y `Alt+V` |
| La interfaz aparece sin desenfoque | Con la aceleración por hardware apagada, el desenfoque sobre el video pierde fotogramas, de modo que la extensión lo sustituye por un fondo más denso |
| Whisper va muy lento | El navegador no ofrece acceso a la GPU. Conviene revisar la aceleración por hardware en sus ajustes |
| El ayudante no aparece como instalado | Tras ejecutar el instalador hay que recargar la extensión. Si la extensión se cargó desde otra carpeta, hay que indicar su identificador con `-Extension` |
| No se puede descargar un video | Con restricción de edad, privado o de pago, yt-dlp no puede obtenerlo. Se puede transcribir mientras se reproduce |
| YouTube devuelve subtítulos vacíos | Sus peticiones van firmadas por el reproductor. Basta con reproducir el video unos segundos |
| Anki no conecta | Anki debe estar abierto con AnkiConnect, y su configuración debe admitir el origen de la extensión. La extensión solicita el permiso la primera vez |
