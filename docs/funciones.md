<p align="right"><b>Español</b> · <a href="features.md">English</a> · <a href="de/features.md">Deutsch</a> · <a href="zh/features.md">简体中文</a> · <a href="ko/features.md">한국어</a> · <a href="ja/features.md">日本語</a></p>

# Funciones

Estado de cada función en la versión 0.51.0, con la forma en que se ha verificado.

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
| En una ventana, también aparece al detener el ratón en el borde de arriba del video, bajo la cabecera del sitio (como la de YouTube), y no en medio de esa cabecera, donde está su buscador | Automática |
| Al cambiar el tamaño, el fondo o las lecturas con un panel abierto encima de los subtítulos, el panel se aparta un momento y deja ver el cambio; solo queda a la vista la fila que se está usando | Automática |
| La letra de la lengua (gótica, redondeada, de libro o a mano) es también la de los subtítulos y las fichas sobre el video: se elige en Ajustes o junto al tamaño, en el panel de subtítulos, y cambia al momento; con todas, la lectura no toca la palabra del 70 al 250 % | Automática |
| Subtítulos que se arrastran a cualquier punto del video, con imanes y sin salirse de él | Automática y sesión real |
| Cambio de línea sin parpadeos, y letra algo menor en los párrafos largos | Automática y sesión real |
| Los subtítulos acompañan al video al desplazar la página, sin temblar | Página imitada y sesión real |
| Una línea que aparece bajo un ratón quieto no abre fichas ni pausa el video | Automática |
| Subtítulos con furigana, color por acento tonal y subrayado por estado | Automática |
| Lecturas que IPADIC trae mal, corregidas: 環 suelto (かん, no たまき) y los kanji que van pegados como sufijo, como en 官能基, 電子殻 o 炭素鎖 | Automática |
| Modos de furigana, glosas y color: siempre, al pasar, desconocidas, nunca | Automática |
| El recuadro de los subtítulos deja aire en los cuatro lados y nada se pisa, con cualquier mezcla de tamaño (del 70 al 250 %), lecturas, glosas, traducción y fondo, en ventana ancha y estrecha; la traducción de cada palabra desconocida va debajo de ella | Automática |
| Ficha de palabra: definiciones, estado, frecuencia, audio, imágenes, ejemplos y enlaces | Automática |
| Orden de los trazos de cada kanji, animado y en bucle, con pausa y avance de uno en uno | Automática, con datos reales de KanjiVG |
| Kanji que ya conoces: junto a los trazos, las palabras conocidas o en aprendizaje con cada kanji de la palabra, las conocidas primero | Automática, con palabras sembradas en la base |
| Compartir como imagen: la tarjeta de la palabra (furigana, acento, lo que significa en la frase o el diccionario, la frase con la palabra resaltada) o de un punto de gramática, copiada al portapapeles al pulsar; Tinta o Papel; Guardar imagen | Automática, con un Claude simulado, leyendo el portapapeles |
| JLPT: vocabulario (8354 palabras), kanji (2211) y gramática (501 puntos) de N5 a N1 con lo que se conoce de cada nivel; cambiar el estado una a una o todas las elegidas; ficha del kanji con trazos y palabras del nivel; ejemplos de cada punto de gramática entre las frases vistas, y su explicación con Claude | Automática, con un Claude simulado |
| Diccionario: buscar por significado entre las palabras de uso común, con la glosa que encaja; la gramática del JLPT por su forma o su significado; bajo cada palabra, sus kanji con su nivel, las de uso común que significan lo mismo, los homófonos y las palabras parecidas (Claude); ocho categorías para explorar según las etiquetas de JMdict | Automática, con los diccionarios del perfil de pruebas y un Claude simulado |
| Página del diccionario a todo el ancho: lista de resultados, palabra y relacionadas en columnas según el ancho (o una columna centrada); sentidos con sus glosas juntas y su clase de palabra; tarjetas con la lectura encima; opuestos y «ver también» de JMdict; tamaño y letra en Ajustes, con una muestra que cambia al momento, y junto al buscador | Automática, con los diccionarios del perfil de pruebas |
| Pasar de una palabra a otra en el diccionario sin ver la anterior a medio quitar ni la nueva a medio llegar: se prepara mientras se ve la anterior y entra de una vez, con una barra si tarda | Automática, fotograma a fotograma |
| Las frases donde se ha visto una palabra, con su lectura, la palabra resaltada aunque esté conjugada, el minuto del video y «Volver a…», que trae la pestaña del video o lo abre y salta a ese momento (también en la pestaña Ejemplos de la ficha) | Automática: la dirección con el minuto en YouTube y el salto que queda pendiente en otros sitios |
| Página de un kanji: trazos en grande, significado, nivel, trazos, lecturas on y kun, piezas de KanjiVG con el radical y la parte fonética, tus palabras con él, las de uso común que lo llevan, dónde se ha visto, letra impresa, de libro y a mano, y su origen con Claude | Automática |
| Diccionario de kanji (Kanjium y KANJIDIC, 6812 kanji), que se instala desde la página del kanji: significado en español, lista oficial, nivel del Kanken y puesto; lecturas oficiales, las demás y las de nombres, con la época de cada on'yomi; radical con su nombre, cómo se formó, familia por el sonido, kanji que lo llevan dentro, parecidos, opuestos, de significado parecido y que se leen igual; formas antiguas y variantes | Automática, bajando el diccionario |
| Lecturas especiales: las palabras de uso común que no se leen como sus kanji (jukujikun y ateji de JMdict), en la página de cada kanji y como categoría para explorar | Automática |
| Practicar la escritura de un kanji con el ratón, un lápiz o el dedo, calcando o de memoria: cada trazo se corrige al soltarlo (va al revés, es otro de los que faltan o no se parece), con pista al segundo fallo o al pedirla y los trazos que conviene repasar | Automática, escribiendo con el ratón; el corrector, con 1413 trazos de 49 caracteres de KanjiVG |
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
| Con la pausa automática y **Reanudar tras un tiempo**, una ficha abierta detiene la cuenta atrás, que vuelve a empezar al cerrarla; con **Al pasar por el subtítulo**, también el ratón encima. Las opciones que no aplican no se muestran, y las dos formas de reanudar no pueden ir juntas | Automática |
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
| Bilibili: los subtítulos del autor y los de su IA, por la API de su reproductor y con la sesión iniciada; videos con sus partes y bangumi | Página imitada, hecha con lo visto en una sesión real, porque el sitio rechaza los navegadores automatizados. Con la extensión instalada, pendiente |
| Segunda pista en el idioma de apoyo | Automática |
| Traducción con Claude, por tramos, empezando por el punto de reproducción, con continuación si se cancela | Página imitada |
| Corrección de subtítulos automáticos, con el texto original consultable | Página imitada |
| Creación de japonés desde otro idioma | Página imitada |
| Importación de SRT, VTT, ASS, SSA, TTML, DFXP y letras LRC, guardada por título | Página imitada |
| Exportación a SRT, con la sincronía aplicada | Página imitada |
| Pistas de japonés recordadas entre regiones de Netflix | Página imitada. Falta confirmar con sesiones reales que el identificador del título coincide |
| Sincronización por desfase o con una o dos marcas | Automática |
| Marcar los tiempos a mano: la barra espaciadora (o un botón) mantenida mientras suena cada línea, y Retroceso para deshacer; las que faltan se mueven con la última marcada, y todo queda guardado para el video | Automática |
| Reloj de Netflix: tras un anuncio del medio, al pasar solo al siguiente episodio o tras un salto, los subtítulos siguen el momento del episodio que da el reproductor de Netflix, sin recargar la página; si su reloj no descuenta el anuncio, se ajusta por lo que corrió el video durante él, hasta que su reloj dé su medida; ese ajuste se puede quitar. **Volver a sincronizar**, **Quitar el ajuste** y `Alt+Shift+S` | Automática, con un Netflix simulado |

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
| Letra de una canción colocada donde se canta: con la voz (narabas, en la zona que da lo que oyó Whisper), con la voz aislada por Demucs en la GPU, o letra a letra con lo que oyó Whisper; Claude, si se le pide o si apenas casa, dice qué versos se cantan y en qué orden. Las palabras salen de la letra, sin marcas de sección ni créditos | Simulador, con Whisper real, narabas y Demucs; medido con 51 canciones japonesas y su letra sincronizada: con la voz aislada, la mitad de los versos a menos de 0,16 s y nueve de cada diez a menos de 0,9 s (sobre la mezcla, 0,19 s y 1,59 s) |
| Una letra incompleta se completa como se canta: el estribillo escrito una vez, o solo su título donde vuelve («[Chorus]», «(Repeat Chorus)», «サビ繰り返し», «※くり返し», «×2»); las marcas se despliegan y el resto lo deduce lo que oyó Whisper, sin IA | Medido con 51 canciones y letras fabricadas desde su LRC: con el estribillo una vez, 80 % de los versos a menos de 1 s (antes, 69 %); con su título donde vuelve, 88 % (antes, 72 %); la letra completa, igual |
| Que Claude lea la letra: la lee entera, tal como se pegó, con sus marcas, estrofas y coros, y dice qué versos se cantan y en qué orden, con las repeticiones que no escribe; los tiempos los ponen la voz y las letras, no Claude | Simulador en `letra.mjs`; con un Claude ideal sacado de los LRC de 51 canciones, 90 % de los versos a menos de 1 s con el estribillo una vez (sin IA, 80 %); sin voz, 84 % (colocando sobre las líneas que nombra Claude, como antes, 24 %); sin medir con la API de verdad |
| Al colocar una letra, los versos que Whisper no oyó no caen en un pasaje instrumental: YAMNet oye dónde se canta al transcribir la canción entera. Medido con 21 canciones japonesas de canales oficiales y su letra sincronizada: de 164 versos sin oír, 21 quedan más de un segundo más cerca de su sitio y 3 más lejos | Medida con canciones reales y el código real; YAMNet dentro de Kotonoha |
| Haas-ja para la voz hablada en japonés, Parakeet para la del inglés y Whisper Turbo para las canciones, elegidos según el video | Automática, con los tres modelos reales en la GPU, y sesión real en YouTube |
| Lista de modelos guardados, con lo que ocupa cada uno y borrado por modelo. Leerlos del disco ya no se anuncia como una descarga | Automática, y con Whisper real |

## Tarjetas

| Función | Verificación |
|---|---|
| Creación de un clic | Simulador |
| Creador con todos los campos | Simulador |
| Envío a Anki con AnkiConnect, con un tipo de nota propio o el de la extensión, con diseño propio: la palabra marcada, la escena, furigana o pinyin, modo noche, y puesto al día solo si no se cambió | Simulador |
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
| Repaso integrado con FSRS: deshacer (`Z`), editar (`E`), repetir el audio (`R`) y suspender; un límite de nuevas al día, con más solo por hoy; todas las tarjetas con su estado, búsqueda y acciones; el progreso con la racha, los aciertos y dos gráficas con su tabla | Automática |

## Ventana de la aplicación

| Función | Verificación |
|---|---|
| Cambiar de sección sin pasar por el fondo vacío: la nueva se prepara mientras se ve la anterior y entra de una vez, con una barra si tarda | Automática, fotograma a fotograma |
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
| Al leer valen los mismos modos de furigana, estado y color que sobre el video, con un selector en la barra del texto; ningún signo de cierre empieza un renglón; en una ventana estrecha la ficha se abre debajo del texto | Automática |
| Los modelos de voz se cargan mientras se graba (dictado y práctica): la segunda grabación de la práctica se analiza en 0,2 s, y el dictado se transcribe un segundo después de terminar | Automática, en la GPU del equipo de desarrollo |
| La grabación de cada dictado encima de su párrafo, para volver a oírla; va con el texto a la biblioteca, y la que ningún texto usa se borra pasada una semana | Automática |
| Practicar el acento tonal en el Cuaderno, los textos de la Biblioteca y la vista de texto: el acento de cada palabra dibujado, la grabación, la curva del tono sobre el acento esperado, un veredicto por palabra y las pausas largas | Automática, con una voz sintética |
| El tono de la voz medido en el navegador (YIN), las moras situadas con la voz y la transcripción, y dónde cae el tono en cada palabra, también con el pico retrasado y las moras ensordecidas | Automática; ajustado con pares mínimos (箸, 橋 y 端; 雨 y 飴) leídos por una voz sintética y con una grabación real |
| Las moras especiales en la práctica, con narabas: la っ, la ん y la vocal larga que faltan o sobran, con la mora marcada; la descarga del modelo comprobada con su SHA-256, la GPU solo si calcula como el procesador, y sin juzgar la っ delante de fricativa, las frases dichas de otra manera ni los titubeos al final de una palabra | Automática, con una voz sintética; medido con pares mínimos (おばあさん y おばさん, きって y きて…) dichos por dos voces sintéticas: 17 de 22 moras que faltaban y 10 de 10 de más, sin avisos en 22 de 24 frases bien dichas |
| Biblioteca: TXT, HTML y SRT, con los títulos, párrafos y listas de cada capítulo | Automática |
| Eliminar pide confirmación: un libro (con su archivo, su avance y lo anotado), un diccionario, un modelo guardado, una tarjeta de Memoria, una nota escrita o la clave de la API | Automática |
| Visor de libros de páginas: EPUB de imágenes, CBZ y PDF en su propia pestaña, con zoom, ajuste al ancho o a la página, una página, doble página y desplazamiento continuo | Automática |
| Pasar páginas en el visor sin ver el fondo entre una y otra: la nueva entra con su imagen lista y, si tarda, se queda la anterior con una barra | Automática, fotograma a fotograma |
| El OCR suelta sus modelos tras dos minutos sin leer, con el libro abierto: unos 470 MB de memoria y entre 0,7 y 1 GB de la tarjeta gráfica | Medida, con un manga real |
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
| Exportar PDF con texto: un PDF con las mismas páginas y el texto del OCR invisible encima, en su sitio, para buscar, seleccionar y copiar en cualquier lector; un PDF recibe el texto al final del archivo, sin tocar sus páginas, y un CBZ o un EPUB de imágenes se convierte en un PDF nuevo con cada JPEG tal cual. También el texto vertical y las páginas giradas, con lo editado a mano | Automática, y con un tomo de manga y un escaneo reales |
| Nitidez para los escaneos con poca resolución: tres niveles de enfoque y «Fondo blanco», guardados con cada libro, también con los colores invertidos | Automática, y con un escaneo real a 127 ppi |
| Vocabulario de un libro o de una colección: sus palabras contadas, las que más salen primero, con lectura, glosa, nivel del JLPT y sus mejores frases del libro con la página; cuánto se entiende y cuántas palabras faltan para el 90, el 95 y el 98 %; cambiar el estado de una o de todas las elegidas; tarjetas de golpe en Memoria o en Anki con la frase del libro, sin Claude; orden por veces, por aparición o por lo comunes que son; nombres propios aparte; la gramática del libro; en una colección, cada tomo con lo que trae de nuevo; leer con el OCR lo que falta desde la misma pantalla | Automática, con un texto, un EPUB de texto, un PDF, un CBZ con lo leído por el OCR y una colección; medido con una novela entera (unas 135 000 palabras en unos cuatro segundos) y con un tomo de manga real |
| Glosas en japonés elegidas por la clase de palabra: なる como 成る, もの y こと como sustantivos, y ある, くる o いう con la entrada que el diccionario guarda con kanji; entre las que se leen igual, la más usada | Automática (pruebas unitarias), y medida contra la 0.31.0 con 1 900 palabras de una novela: 110 ganan su glosa, ninguna la pierde y las 6 que cambian lo hacen a mejor |
| Diccionarios de la última versión de yomidevs que llegan vacíos: se baja la versión anterior más reciente que los trae enteros | Automática (pruebas unitarias), y con las versiones rotas reales del 12 y el 14 de noviembre de 2026 |
| Editar el texto de una línea a mano, guardado aparte de lo leído y con «Restaurar» | Automática |
| Notas y marcadores, como en un lector de PDF: marcar páginas, resaltar en cuatro colores o subrayar una frase, lo seleccionado aunque ocupe varios renglones o una palabra, con un comentario, y notas sueltas sobre la página; en el panel «Notas y marcadores», todo por páginas, para ir, editar, quitar o copiar como texto | Automática |
| Buscar en el libro: en el texto del PDF y en el del OCR, con lo editado, sin distinguir anchos ni hiragana y katakana, también una palabra partida entre dos renglones; resultados por páginas y marcados en la página | Automática |
| Vista de texto: la página como texto, en párrafos y con los títulos aparte, con la ayuda de lectura del Cuaderno (furigana, comprensión, lectura en voz alta, fichas y tarjetas); cada libro la recuerda | Automática, y los párrafos con 16 páginas reales |
| Revisar con Claude el texto de una página, con su imagen: solo los cambios que no coinciden, letra a letra, para elegir cuáles aplicar, guardados como líneas editadas | Simulador |
| Tocar una palabra de la página abre su frase entera, aunque ocupe varios renglones, en una ventana flotante como la de los subtítulos, con furigana, sus palabras, su ficha y la creación de tarjetas; dos toques, la frase, y tres, el párrafo. Un imán lleva un toque entre dos renglones al más cercano | Automática, con un PDF hecho por el navegador, en horizontal y en vertical |
| Menús con nombre en una sola fila (Libro, Ver, Ir, Texto, Ayudas, Anotar y Ayuda), con la tecla de cada orden y también con el teclado; Buscar una acción (Ctrl+K), que encuentra cualquier orden o lleva a una página por su número, y Atajos de teclado («?») | Automática: pruebas unitarias del registro de órdenes (teclas sin repetir, menús y paleta) y de extremo a extremo |
| Herramientas del visor: Seleccionar, Mano (arrastrar mueve la página), Resaltador (lo arrastrado queda resaltado, sin abrir la ventana) y Añadir una nota, y un menú con el clic derecho en la página | Automática |
| Paneles a la izquierda que se ensanchan y recuerdan su ancho; barra de estado con la página, el capítulo, lo que va del libro y de dónde sale el texto; volver tras un salto (Alt+←); modo lectura; «Aa» con las ayudas de lectura, que valen en todo Kotonoha, y lo que vale solo para el libro; un libro abierto no abre otra pestaña | Automática |
| La página aumentada: subrayado por estado, furigana (todas, desconocidas, al pasar o ninguna) y gramática sobre la página, sin tapar el furigana impreso; con el texto de un PDF y con el OCR de libros, que ahora sabe dónde va cada letra por los pasos del reconocedor | Automática: pruebas unitarias del sitio de cada palabra y su lectura, de los cortes del CTC y del furigana impreso; de extremo a extremo con un PDF con ruby |
| La traducción de la frase abierta como un subtítulo bajo ella, leída de lo guardado sin gastar; la ficha al pasar el ratón con Mayús, Ctrl o Alt; cuánto se entiende de lo que se ve | Automática, con un Claude falso |
| Leer en voz alta siguiendo la frase, de página en página; Consultadas: las palabras elegidas en un libro, a tarjetas de golpe con su frase, su furigana, sus definiciones y un recorte de la página | Automática |
| Leer una zona (O): un rectángulo dibujado sobre la página se lee con el OCR, aunque el del libro esté apagado; lo leído entra en el texto de la página, en su sitio, y se abre en la ventana; en un manga, como un globo leído con manga-ocr. No se guarda | Automática: pruebas unitarias del recorte y de cómo entra lo leído en la página; de extremo a extremo en un libro y en un manga, también con una zona sin texto |
| Los EPUB de texto, con lo del visor de páginas: los menús, Buscar una acción (Ctrl+K, también con el foco en el libro), los atajos, «Aa», el índice a la izquierda, Atrás (Alt+←), la barra de estado y el modo lectura | Automática |
| Los textos de la Biblioteca (lo pegado, los relatos, los artículos) se leen en el visor, en una pestaña propia, con sus menús, «Aa», sus páginas y Editar en el Cuaderno | Automática |
| Importar una carpeta, también desde una colección: todos sus PDF, EPUB y CBZ, en todas sus subcarpetas y en orden, con títulos que no se repiten y sin duplicar lo que ya estaba | Automática |
| «Tu equipo», en la bienvenida y en Ajustes: qué tal irán aquí la voz local, las letras de canciones y el OCR, con lo que el navegador dice de la gráfica y una prueba con el OCR de una página de muestra; cada pieza, con su tiempo y un consejo. Nada se apaga | Automática: pruebas unitarias de los niveles y las estimaciones; de extremo a extremo con la gráfica de verdad y sin ella |
| Medir en el uso real: lo que tardan la voz y el OCR se guarda en «Tu equipo» y manda sobre la prueba; si un video se ve más deprisa de lo que se transcribe, se avisa, y «Esperar a la transcripción» lo pausa hasta que vuelve a ir por delante; en «Automática», la gráfica descansa más si el video da tirones; el OCR lee menos páginas por delante en un equipo lento y propone «Leer una zona» | Automática: pruebas unitarias del ritmo, los tirones y lo medido; de extremo a extremo con una transcripción de verdad más lenta que el video, y con el OCR |
| Presentar las funciones: la bienvenida acaba en «¿Por dónde quieres empezar?», con cuatro caminos; «Descubre Kotonoha», en Inicio, con las funciones por familias y un botón para probar cada una; un texto de ejemplo de dominio público en cada lengua; pistas de la primera vez, solo para quien instala; y «Lo nuevo» tras actualizar, una vez | Automática: pruebas unitarias de los textos de ejemplo y de lo nuevo; de extremo a extremo con un perfil nuevo, en japonés y en inglés |
| Voces de AivisHub dentro de Kotonoha: «Instalar las voces» baja el BERT de AivisSpeech, un diccionario y la voz まお (unos 0,9 GB, comprobados con su SHA-256) y lee las frases en japonés sin AivisSpeech abierto, con la voz en la gráfica; un catálogo de AivisHub con búsqueda, filtros, muestras y licencias; el acento con yomi y las reglas de enlace de AivisSpeech (el 92 % de las moras como él); una pregunta en la ficha y un aviso en Inicio, una vez | Automática: pruebas unitarias de la entrada de la voz, del lector de AIVMX y del acento con un corpus de 210 frases frente a AivisSpeech; de extremo a extremo instalando y leyendo con la voz de verdad, y con el catálogo de AivisHub |
| La ventana no tapa lo que queda por leer: va al margen de la página si cabe, y si no, sobre lo ya leído (encima del renglón, o a la derecha de la columna en vertical); se mueve, se agranda y se fija a un lado como panel, que se ensancha y recuerda su ancho | Automática (pruebas unitarias de la colocación) |
| Seleccionar arrastrando, letra a letra y entre renglones, con Traducir, Explicar, Desglosar, Escuchar, Resaltar, Nota y Copiar; Ctrl+C copia lo abierto | Automática |
| Pasar de página con flechas a la vista a los lados, el teclado o deslizando: tocar la página solo cierra lo abierto, y fallar por poco al tocar una palabra ya no pasa de página | Automática |
| Cada página se lee una sola vez y se guarda; su texto también llega a los lectores de pantalla | Automática |
| EPUB de texto en el visor, con su propio formato: capítulos, CSS, ruby, ilustraciones y escritura vertical, y el lector de páginas encima, con colores, furigana y fichas | Automática, con un EPUB vertical con ruby, CSS e ilustración |
| Lo que trae un EPUB no se ejecuta ni carga nada de fuera: ni scripts, ni marcos, ni formularios, ni atributos on* | Automática, con un EPUB con trampas |
| Índice, zoom, enlaces entre capítulos, texto vertical u horizontal a elegir y el punto exacto donde se dejó cada libro | Automática |
| PDF con texto: el texto del propio archivo se lee al instante, sin OCR, también en columnas verticales, y los radicales Kangxi pasan al kanji que son | Automática, con un PDF japonés hecho por el navegador |
| Tocar una palabra en la página abre su ficha directamente y la marca sobre la página, en los PDF con texto y en el modo Libro del OCR | Automática |
| Relatos generados según el nivel | Simulador |
| Reproductor de archivos propios | Automática |
| Subtítulos incrustados en MKV y elección de pista de audio, con ffmpeg.wasm | Automática |
| Controles propios del reproductor: velocidad, volumen, saltar de línea, la frase de cada momento en la barra de tiempo y pantalla completa con los subtítulos | Automática |
| Carpetas enteras como lista de reproducción, en orden natural, con los subtítulos de cada capítulo repartidos por idioma | Automática |
| Seguir donde se dejó cada archivo, «Seguir viendo» y abrir otra vez con un clic | Automática |
| Audio en el reproductor: MP3, M4A, OGG, WAV y FLAC | Automática |
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

## Chino

| Función | Verificación |
|---|---|
| Subtítulos en chino, con cada palabra analizada, el pinyin sobre cada carácter y los secundarios en el idioma de apoyo | Página imitada |
| La pista simplificada antes que la tradicional, y una tradicional pasada a caracteres simplificados | Página imitada |
| Palabras partidas con los diccionarios y la frecuencia, y el pinyin del diccionario; si hay varios, el de la frase | Medida con 200 frases frente a jieba y pypinyin: iguales el 91 % de los cortes y el 96 % de las sílabas. Lo demás es casi todo criterio (el tono neutro de CC-CEDICT, el cambio de tono que no se aplica) o error de la referencia |
| Cada sílaba y su pinyin, del color de su tono, en los subtítulos, el lector de páginas, el visor y la ficha | Automática, en un video imitado |
| Cómo suena: el pinyin como se dice en la frase, con el cambio de tono de 一, 不 y los terceros tonos seguidos, el tono neutro y el 儿化 | Automática, con casos como 你好, 我很好, 展览馆, 一个, 第一, 看一看, 是不是 y 一点儿 |
| Práctica de los tonos con el micrófono, sin modelos: la voz partida en sílabas y la forma de su tono juzgada en el registro de quien habla | Medida con 364 palabras de Lingua Libre de 16 hablantes nativos, sueltas y juntas de tres en tres: calibrada con la mitad y comprobada con la otra mitad, de hablantes distintos. En frases da por buenas el 70 % de las sílabas dichas con su tono y el 19 % de las dichas con otro. Una voz sintética con los cuatro tonos sale entera en la prueba automática |
| CC-CEDICT, traducciones breves de Wiktionary en el idioma de la interfaz y frecuencia, con las lecturas de todos igualadas | Automática, con datos reales |
| Buscar por pinyin, con tonos o sin ellos | Automática, con datos reales |
| Gramática del HSK 1 al 6: 105 reglas, cada una en el nivel del temario de 2025, confirmadas por Claude | Automática, con cada regla contrastada con el nivel del temario |
| Pantalla del HSK: vocabulario, hanzi y gramática de cada nivel del temario de 2025, con el pinyin y la glosa de CC-CEDICT | Automática, con las listas generadas y la pantalla real |
| Página de cada hanzi: pinyin, nivel, radical con su nombre de clase, piezas, cómo se formó, la pieza del sonido y la del significado, forma tradicional y los que se leen igual | Automática, con el diccionario de Make Me a Hanzi descargado de verdad |
| Orden de los trazos de Hanzi Writer y práctica de la escritura | Automática, con los trazos descargados de verdad |
| Lector de páginas, con el pinyin sobre cada carácter | Automática |
| Audio de las palabras de Wikimedia Commons y Lingua Libre | Automática |
| Whisper Turbo para la voz y las canciones | Pendiente |
| Voces de Azure | Pendiente |

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
| Sin parpadeos | Lo que cambia entero (una sección, una página del visor, una palabra del diccionario) se prepara mientras se ve lo anterior y entra de una vez; si tarda, una barra fina lo dice |
| Memoria contenida | El analizador del japonés carga su diccionario sin relleno y lo descomprime el navegador; el OCR suelta sus modelos cuando deja de leer, y Whisper tres minutos después de transcribir |
| Las páginas no se reescriben | El subrayado web usa la CSS Custom Highlight API, sin añadir nada al contenido. Solo se abre el interlineado donde el furigana no cabe |
| Datos locales | Todo queda en el navegador, y el audio de la transcripción no sale del equipo |

## Limitaciones conocidas

| Limitación | Detalle |
|---|---|
| PDF muy grandes | Mientras está abierto, un PDF reserva tanta memoria como pesa el archivo (así trabaja pdf.js): uno de 550 MB aparece con más de 1 GB en el administrador de tareas, aunque solo se use de verdad la parte leída. Al cerrarlo se libera |
| Nombres propios en el vocabulario | Solo se apartan los que IPADIC reconoce como nombres; los de personajes que también son palabras (アイ, ルビー) salen como palabras y se pueden marcar como ignorados. Solo cuenta el texto ya leído: en un libro de imágenes, las páginas leídas con el OCR |
| Idioma de estudio | Japonés, inglés, alemán y chino. Cada idioma nuevo necesita su propio paquete, en `src/lenguas` |
| Análisis del inglés | Lo hace un modelo pequeño, que cabe en la extensión. En frases ambiguas puede equivocarse de categoría, y con ella de traducción bajo la palabra. La ficha sigue mostrando todas las definiciones |
| Análisis del alemán | Sale de las formas de los diccionarios: sin el alemán–inglés, cada palabra es su propia forma. Entre dos palabras posibles decide la frecuencia, sin mirar la frase; Claude corrige lo que falle al revisar la línea |
| Compuestos alemanes | Un sustantivo compuesto que no esté en los diccionarios no se descompone en sus partes |
| Análisis del chino | Las palabras salen de los diccionarios y la frecuencia, sin un modelo: un nombre o una palabra nueva queda carácter a carácter. El pinyin sobre las palabras lleva el tono de diccionario; cómo cambia al hablar se ve en Cómo suena |
| Práctica de los tonos | Sin transcribir, las sílabas se sitúan por la voz: una sílaba de más o de menos descoloca las de después. El tercer tono es el que menos se distingue (el 62 % de los bien dichos sale bien), porque en lo más grave la voz se vuelve áspera y se pierde el tono |
| Diccionario inglés-inglés | Es grande: descarga unos 110 MB y ocupa unos 220 MB. Instalarlo y quitarlo lleva unos minutos. Solo se propone con la interfaz en inglés |
| Traducciones de la interfaz | Escritas con ayuda de IA, sin revisión nativa todavía. Los errores se corrigen en `idiomas/` |
| Lector de páginas | Solo actúa en el marco principal: no llega al texto dentro de un iframe. Lo que una página dibuje en un lienzo o en una imagen no es texto |
| Prompts de Claude | Las instrucciones siguen en español, también cuando pide la respuesta en otro idioma |
| Plataformas | Chrome y Edge de escritorio. El ayudante local está preparado para Windows |
| Imagen con DRM | En Netflix y otros sitios protegidos, el navegador entrega el fotograma en negro. La tarjeta lleva la imagen oficial del episodio, si el sitio la ofrece |
| Audio con DRM | Un sitio protegido puede no entregar su sonido a la captura. Tras dos frases mudas seguidas en un video, la línea ya no se vuelve a reproducir para grabarla |
| Visor | El OCR puede confundir letras parecidas (エ y 工, ー y 一), saltarse alguna y perder los subíndices de las fórmulas; la imagen original siempre queda a la vista. El modo Libro está medido con texto horizontal. Un libro con DRM no se abre. Los archivos de los libros no van en la copia de seguridad de un solo archivo, sino en la copia completa. Un EPUB de texto se recorre por capítulos, con desplazamiento, y no por páginas; en el modo Manga se toca el globo entero, no cada palabra: la palabra se elige en la ventana, y dentro de un globo no se selecciona arrastrando. Las ayudas sobre la página no van en los globos de manga, donde no se sabe dónde va cada letra, y las páginas leídas con el OCR antes de la 0.37.0 reparten sus letras a lo ancho del renglón. |
| Sincronización | Sin servidor: el traspaso entre equipos se hace con la copia completa |
| Música de fondo | Whisper puede perder conversaciones en voz baja bajo música fuerte |
| Letras de canciones | Uno de cada diez versos queda a más de 0,9 s de donde se canta, y unos pocos, a varios segundos, en pasajes que Whisper no oye. Sin Demucs, sobre la mezcla, uno de cada diez queda a más de 1,59 s. Demucs necesita WebGPU, y narabas y Demucs se descargan aparte (1,4 GB) |
