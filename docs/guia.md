<p align="right"><b>Español</b> · <a href="guide.md">English</a></p>

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
- [Gasto en Claude](#gasto-en-claude)
- [Datos y copia de seguridad](#datos-y-copia-de-seguridad)
- [Atajos de teclado](#atajos-de-teclado)
- [Problemas frecuentes](#problemas-frecuentes)

## Puesta en marcha

Todo se configura en **Ajustes**, dentro de la ventana de la extensión, que se abre con `Alt+Shift+W`.

| Paso | Dónde | Para qué sirve |
|---|---|---|
| Diccionarios | Ajustes, Diccionarios | JMdict en español e inglés, acento tonal de Kanjium y frecuencia de JPDB. Se descargan una vez y quedan en el navegador |
| Clave de la API de Claude | Ajustes, Claude | Explicaciones, revisión de lecturas, traducción y corrección. Se guarda solo en el navegador |
| Nivel e idioma | Ajustes, Tu nivel e idioma | Adapta las explicaciones, que pueden pedirse en español, inglés o japonés sencillo |
| Anki | Ajustes, Tarjetas y Anki | Opcional. Requiere Anki abierto con el complemento AnkiConnect |

La extensión funciona sin clave de Claude: los subtítulos, el diccionario, el furigana, las tarjetas y Whisper no la necesitan.

## Sobre el video

Al abrir un video con subtítulos en japonés aparece una barra flotante en la parte superior. Muestra el porcentaje de comprensión estimado, las frases recomendadas, las palabras conocidas y el modo de reproducción. Se oculta sola y reaparece al detener el ratón junto al borde superior, y se queda mientras el ratón siga cerca.

**Subtítulos.** Cada palabra lleva furigana, un color según su acento tonal y un subrayado según su estado: desconocida, rastreada, conocida o ignorada. Los puntos de gramática identificados se muestran como etiquetas.

**Mover los subtítulos.** Se arrastran desde cualquier punto, incluso desde una palabra, a la altura y el lado que se prefiera. La posición se guarda para todos los videos y se conserva en proporción al tamaño del video, también en modo teatro. Un doble clic sobre el fondo, o **Volver a su sitio** en los ajustes de visualización, los devuelve a su lugar.

**Ficha de palabra.** Al pasar el ratón sobre una palabra se abre su ficha, sin ninguna petición a Claude, con definiciones, frecuencia, audio, imágenes, ejemplos y enlaces a Jisho, JapanDict, Weblio, Goo, Kotobank, Wiktionary, Forvo y Massif. El enlace a JapanDict abre la entrada exacta de JMdict, no la lista de homógrafos.

**En esta frase.** Con clave de Claude, el botón **¿Qué significa en esta frase?** indica el sentido de la palabra en ese contexto y señala cuándo el uso es figurado o poético. Claude recibe 40 líneas alrededor de la frase y la traducción. Las pestañas **Explicar**, **Desglose** y **Traducir** funcionan igual: preguntan al pulsarlas. Toda respuesta se guarda, de modo que volver a esa palabra en esa frase no gasta nada y la ficha lo indica con **Guardada, sin gasto**. El botón **Profundizar** repite la consulta con Opus 5.5.

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
| Video de internet, sin el ayudante | Activar la captura de audio con `Alt+R` | Tiempo real, con unos segundos de retraso |

**Modelos.**

| Modelo | Descarga | Uso |
|---|---|---|
| Whisper Turbo | 1,5 GB | Por omisión. La mayor precisión medida |
| Whisper Turbo ligero | 564 MB | Algo menos preciso, con menos memoria de video |
| Whisper Base | 165 MB | Para equipos sin una GPU potente |

**Intensidad.** Determina qué fracción del tiempo trabaja la tarjeta gráfica. El resto lo descansa, y el descanso crece solo si otra aplicación la está ocupando.

| Intensidad | Ocupación | 30 minutos de video |
|---|---|---|
| Automática | 75 % con el equipo en uso, 90 % tras dos minutos sin uso | Unos 5 minutos |
| Suave | 30 % | Unos 12 minutos |
| Rápida | 90 % | Unos 4 minutos |

Durante la transcripción se puede pausar para liberar la tarjeta al instante y reanudar por el mismo punto. Si el controlador de video se reinicia, Whisper espera 20 segundos, recarga el modelo y continúa a la mínima intensidad. Al segundo fallo se detiene, y lo transcrito queda guardado.

### Ayudante local

Una extensión no puede descargar por sí sola el audio de un video. El ayudante es un pequeño programa local que lo hace con [yt-dlp](https://github.com/yt-dlp/yt-dlp) y FFmpeg. Requiere Python, y su instalador añade yt-dlp si falta. Se instala una vez desde la carpeta del proyecto:

```bash
powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1
```

Después hay que recargar la extensión en `edge://extensions` o `chrome://extensions`. El estado se comprueba en **Ajustes, Transcripción**.

| Aspecto | Comportamiento |
|---|---|
| Alcance | Solo la extensión puede llamarlo, y solo acepta direcciones http o https |
| Registro | Añade una clave por usuario en `HKCU`, sin permisos de administrador |
| Archivos | Usa una carpeta temporal que se borra al terminar o al cancelar |
| Identificador | Si la extensión se carga desde otra carpeta, su identificador cambia: se indica con `-Extension`, y aparece en la página de extensiones |
| Desinstalación | El mismo comando con `-Quitar` |

Si un video no se puede descargar, por ejemplo por ser privado o tener restricción de edad, el aviso ofrece transcribirlo mientras se reproduce.

## Tarjetas

| Atajo | Acción |
|---|---|
| `Q` | Crea una tarjeta con la palabra y la frase actuales |
| `E` | Envía la palabra, la selección o la imagen bajo el ratón al creador de tarjetas |

Las tarjetas pueden enviarse a Anki mediante AnkiConnect, con un tipo de nota propio o con el que crea la extensión, o guardarse en **Memoria**, el repaso integrado con FSRS. Los campos incluyen frase, furigana, traducción, definiciones, audio, imagen y notas. La captura de audio se activa con `Alt+R`.

**Audio e imagen del video.** Para grabar el audio de la frase hay que activar la captura con `Alt+R` en la pestaña del video. La captura es solo de esa pestaña: si está activa en otra, el icono del micrófono aparece apagado y la tarjeta se crea sin audio. Al crear la tarjeta, la línea vuelve a reproducirse a velocidad normal mientras se graba, y después el video queda donde estaba. La imagen no incluye nada de la interfaz. En sitios con DRM, como Netflix, el navegador entrega el fotograma en negro, de modo que la tarjeta se crea sin captura.

## Audio, imágenes y ejemplos

| Elemento | Origen | ¿Requiere clave? |
|---|---|---|
| Audio de la palabra | JapanesePod101 y Lingua Libre, por Wikimedia Commons | No |
| Audio de la frase | Grabado de la pestaña con `tabCapture`, en el propio equipo, y convertido a MP3 | No |
| Voces sintéticas | Azure Speech, si se configura. En su defecto, las voces del sistema, solo para escuchar | Solo para Azure |
| Imágenes | Openverse, con la primera glosa en inglés de JMdict como búsqueda | No |
| Fotograma | Captura del video, en el propio equipo | No |
| Ejemplos | Frases ya vistas por el usuario, guardadas en el navegador | No |
| Frase de ejemplo para una tarjeta | Claude, solo si la tarjeta no tiene frase | Claude |

## Páginas web, lector y biblioteca

**Páginas web.** Manteniendo `Shift` y pasando el ratón sobre una palabra japonesa se abre su ficha, en cualquier página. El subrayado por estado no modifica el documento: usa la CSS Custom Highlight API, de modo que no interfiere con aplicaciones como las hechas con React. `Alt+K`, `Alt+U` y `Alt+I` marcan en bloque el texto seleccionado como conocido, desconocido o ignorado.

**Lector.** Muestra cualquier texto pegado con las mismas ayudas que los subtítulos.

**Biblioteca.** Guarda libros EPUB, textos y subtítulos SRT, con el punto de lectura. También puede generar relatos con Claude ajustados al nivel configurado.

**Reproductor local.** Reproduce archivos propios, con los subtítulos incrustados de un MKV y la elección de pista de audio, mediante ffmpeg.wasm.

**Palabras y evaluación.** El explorador lista el vocabulario por estado, y la evaluación de nivel estima las palabras conocidas de partida.

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

Todos los datos se guardan en el navegador, en IndexedDB. **Ajustes, Tus datos** permite exportar e importar una copia con palabras, tarjetas, biblioteca, ajustes, subtítulos generados, correcciones y registro de gasto.

## Atajos de teclado

La referencia completa está en el panel de atajos, sobre el video.

| Grupo | Atajo | Acción |
|---|---|---|
| Barra | `Alt+X` | Fijar o soltar la barra |
| | `Alt+Z` | Mostrarla mientras se mantiene |
| | `Alt+T` | Abrir el traductor |
| Palabra | `1` o `U` | Marcar como desconocida |
| | `2` o `T` | Rastrear |
| | `3` o `K` | Marcar como conocida |
| | `4` o `I` | Ignorar |
| | `N` | Ir a la siguiente palabra desconocida |
| | `Alt+S` | Consultar en el diccionario |
| Tarjetas | `Q` | Crear tarjeta |
| | `E` | Enviar al creador |
| | `Alt+R` | Permitir la captura de audio |
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
| Aplicación | `Alt+Shift+W` | Abrir la ventana de Kotonoha |

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Tras compilar, nada cambia | El navegador conserva el service worker anterior. Hay que pulsar **Recargar** en la página de extensiones |
| «Para oír el video activa la captura de audio» | Chrome exige una acción del usuario para capturar una pestaña. Se resuelve con `Alt+R` en la pestaña del video |
| Whisper va muy lento | El navegador no ofrece acceso a la GPU. Conviene revisar la aceleración por hardware en sus ajustes |
| El ayudante no aparece como instalado | Tras ejecutar el instalador hay que recargar la extensión. Si la extensión se cargó desde otra carpeta, hay que indicar su identificador con `-Extension` |
| No se puede descargar un video | Con restricción de edad, privado o de pago, yt-dlp no puede obtenerlo. Se puede transcribir mientras se reproduce |
| YouTube devuelve subtítulos vacíos | Sus peticiones van firmadas por el reproductor. Basta con reproducir el video unos segundos |
| Anki no conecta | Anki debe estar abierto con AnkiConnect, y su configuración debe admitir el origen de la extensión. La extensión solicita el permiso la primera vez |
