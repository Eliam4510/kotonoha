# Novedades

Un resumen de cada versión. Las notas completas, con lo probado y los paquetes, están en [Releases](https://github.com/Eliam4510/kotonoha/releases). [English below](#whats-new).

## 0.30.1 · 2026-11-10

- **De una palabra a otra, sin fantasmas.** Al abrir otra palabra en el diccionario (otro resultado de la lista, una de las que significan lo mismo, una palabra de «Donde la has visto» o un kanji) se veía la anterior, luego la página vacía con esqueletos y luego la nueva llegando a trozos, con la página cambiando de alto en cada uno. Ahora la nueva se prepara mientras sigue a la vista la anterior y entra de una vez, con un fundido corto. Si tarda, la anterior se atenúa y una barra fina dice que algo llega. Las frases de «Donde la has visto» llegan ya con su lectura, en vez de aparecer sin ella y crecer un momento después, y una palabra abierta desde abajo de la página se ve desde su principio.
- **Claude ya no avisa de que «la frase llegó vacía».** Al explicar una palabra buscada suelta en el diccionario, o al preguntar por las palabras parecidas, la petición llevaba una frase vacía, 「」, y la respuesta empezaba por ahí. Ahora se le dice que la palabra se consulta suelta. Las respuestas que se guardaron así se vuelven a pedir una vez.
- **Sin barras de desplazamiento de sobra.** La pista de la estrella «De uso común», aunque no se viera, asomaba por la derecha de su tarjeta y hacía salir una barra bajo la lista de resultados; otras pistas hacían lo mismo junto al borde de una página. Las pistas ya no existen mientras no se ven, y las de las marcas de una tarjeta se abren hacia dentro.
- El botón **Buscar** ya no parpadea con «Buscando…» en cada búsqueda, y las búsquedas recientes de la portada no se mueven antes de tiempo.

## 0.30.0 · 2026-11-10

Una versión de acabado, sin funciones nuevas. Se ha medido cada pantalla con muchas mezclas de opciones (tamaños, lecturas, glosas, temas, idiomas de la interfaz, anchos de ventana y letras del diccionario) buscando lo que quedaba cortado, pegado a un borde o encima de otra cosa, y se ha corregido lo encontrado.

- **Subtítulos con aire.** La lectura quedaba a pocos píxeles del borde de arriba del recuadro, y el texto, casi tocando el de abajo. Ahora hay sitio alrededor a cualquier tamaño, del 40 al 250 %, con y sin lecturas, con y sin traducción y sin el fondo. Con la letra muy grande, el bloque se encoge lo justo para no salirse del video. En una ventana estrecha, donde la línea se parte en dos, la lectura del renglón de abajo ya no pisa el de arriba.
- **La traducción de cada palabra, debajo de ella.** Con **Traducción de palabras** en las desconocidas, las glosas flotaban encima y se pisaban entre sí y con las lecturas. Ahora cada una va bajo su palabra, que le hace sitio.
- **La lectura ya no toca la palabra.** El navegador compone la lectura pegada a la palabra, y con la letra gótica del diccionario llegaban a tocarse. Ahora queda un espacio entre las dos con las cuatro letras, la lectura no baja de 10 píxeles (en las tarjetas pequeñas y en el navegador de subtítulos medía 8) y tiene aire hasta el borde de su tarjeta.
- **Las mismas opciones al leer que sobre el video.** En el Cuaderno, la Biblioteca y el visor, la lectura salía en todas las palabras aunque se hubiera elegido verla solo en las desconocidas o al pasar el ratón, y ni el subrayado del estado ni el color del acento seguían lo elegido. Ahora valen igual en todas partes, y la barra del texto trae un selector, **Furigana**, para cambiarlo sin ir a un video.
- **Ni un punto solo al principio de un renglón.** Al leer, un 「。」 o una coma podía quedar al principio del renglón siguiente, separado de su palabra. Ya no, tampoco en los subtítulos partidos en dos. Y los renglones miden lo mismo lleven lectura o no.
- **En una ventana estrecha, la ficha va debajo.** En el Cuaderno, la Biblioteca y la vista de texto del visor, con media pantalla de ancho, la ficha de una palabra se montaba sobre el texto y tapaba la frase. Ahora se abre debajo, a lo ancho, y la palabra consultada sube a la vista.
- **Refranes y frases largas.** En las tarjetas del diccionario, una frase larga se partía por cualquier sitio y dejaba una sílaba suelta en el segundo renglón. Las listas de frases usan ahora tarjetas más anchas y, si aun así hay que partir, se parte entre palabras.
- **Borrar pide confirmación.** Eliminar un libro, con su archivo, su avance y sus notas, era un clic en un icono pequeño, sin vuelta atrás: ahora pregunta antes. Los diccionarios, los modelos guardados, una tarjeta de Memoria, una nota escrita y la clave de la API piden una segunda pulsación en el mismo botón.
- **Avisos que faltaban.** **Copiar** confirma que ha copiado; **Añadir conocidas**, en Palabras, dice cuántas entraron; **Pegar**, en el Cuaderno, avisa si el portapapeles está vacío o el navegador no deja leerlo; **Exportar**, la copia de seguridad, y **Guardar imagen** dicen que el archivo se ha descargado, porque la ventana de Kotonoha no enseña las descargas del navegador, y si una imagen o una grabación no se puede bajar para la tarjeta, se dice. La copia de seguridad lleva en su nombre la fecha local, no la de Greenwich.
- **El índice de Ajustes** marcaba una sección que ya no estaba a la vista al saltar con Av Pág o con la barra de desplazamiento.
- **Detalles.** Las pestañas de la ficha no se tocan entre sí ni se cortan con puntos suspensivos (en el panel del visor van en dos filas); el título de «¿Qué significa aquí?» no se parte en dos; las rayas de cada nivel en el sendero de la portada, que no se veían, vuelven a estar; los formatos de la Biblioteca se reparten en dos filas parejas, y las imágenes que no cargan en la ficha se quitan en vez de dejar su hueco.

## 0.29.0 · 2026-11-09

- **El diccionario de kanji.** Un diccionario nuevo, **Kanji (Kanjium y KANJIDIC)**, con 6812 kanji, que se instala desde la propia página de un kanji o en Ajustes (unos 3 MB). Con él, cada kanji dice lo que significa en español, en qué lista oficial está (Jōyō con su curso, Jinmeiyō o fuera de las listas), su nivel del Kanken y su puesto entre los más usados.
- **Todas las lecturas.** Las de la lista oficial primero y, aparte, las que no están en ella y las que solo se usan en nombres. Cada on'yomi dice de qué época viene (Go-on, Kan-on, Tō-on), y las oficiales que casi no se usan van señaladas.
- **Radical, origen y formas antiguas.** El radical con el nombre que se le da en clase (さんずい) y su número, cómo se formó el kanji (pictograma, indicativo, compuesto de ideas o fonosemántico) y sus formas antiguas y variantes: 國 para 国. La página de una forma antigua avisa de cómo se escribe hoy.
- **Los kanji que lo rodean.** Su familia por el sonido (晴, 清 y 精 con 青), los que lo llevan dentro, los que se le parecen y se confunden al leer, sus opuestos, los de significado parecido y los que se leen igual (神, 紙 y 髪 para かみ), con si se distinguen por el acento.
- **Lecturas especiales.** Las palabras de uso común que no se leen como sus kanji, como 今日, 大人 o 寿司 (el jukujikun y el ateji de JMdict), en la página de cada kanji y como categoría nueva en **Explorar el diccionario**.
- **Practicar la escritura.** En la página de un kanji, **Practicar** deja escribirlo con el ratón, un lápiz o el dedo, **Calcando** o **De memoria**. Cada trazo se corrige al soltarlo: si va al revés, si es otro de los que faltan o si no se parece, lo dice. Al segundo fallo, o con **Pista**, el trazo se dibuja solo, y al terminar dice qué trazos conviene repasar.
- **Las listas del diccionario salen al momento.** El índice que usan las palabras con un kanji, los sinónimos, la búsqueda por significado y las categorías se hacía cada vez que arrancaba el navegador y tardaba unos 16 segundos. Ahora se hace más de tres veces más rápido, se guarda y se deja listo al arrancar: la primera lista sale en menos de medio segundo.
- **Trazos de los kanji menos comunes.** El servidor de los trazos no daba los de los kanji que no tenía guardados, como 國, y salían «sin datos de trazos». Ahora se piden al repositorio de KanjiVG.
- **La lectura, lejos del borde.** En las tarjetas del diccionario, la lectura quedaba a 3 píxeles del borde de arriba; ahora tiene aire. Las palabras largas se escriben más pequeñas en vez de partirse en dos renglones, y las piezas repetidas de un kanji (los tres 一 de 三) salen una vez.

## 0.28.0 · 2026-11-09

- **Un diccionario completo, a toda la ventana.** La página del diccionario usa todo el ancho: la lista de resultados a la izquierda, la palabra en el centro y, a la derecha, sus kanji, sus opuestos, las que significan lo mismo y las que se leen igual. Con menos ancho pasa a dos columnas y, en una ventana estrecha, a una. Las palabras se leen mucho mejor: más grandes, con una letra gótica de lectura fácil y la lectura siempre encima. Cada sentido junta sus glosas y lleva encima su clase de palabra (verbo godan, transitivo, coloquial), separado por diccionario, y la página abre sin ninguna pestaña: ni audio ni Claude hasta que se piden.
- **Listas en tarjetas.** Resultados, sinónimos, homófonos, opuestos, onomatopeyas y las demás categorías salen como tarjetas grandes, con la lectura encima, el significado debajo, una estrella si es de uso común y un punto si ya la conoces o la estás aprendiendo. Escrita en kana, la búsqueda separa las palabras que se leen así (のむ da 飲む y 呑む); con kanji, da también las que empiezan por ella (日本 da 日本語 y 日本人).
- **Opuestos y «ver también».** Las referencias de JMdict en inglés ya no se mezclan con las definiciones: salen aparte, como palabras que se pueden abrir, con su significado en el primer diccionario. 上手 tiene a 下手 como opuesto.
- **Donde la has visto, con su minuto.** Bajo la palabra, las frases de tus videos y textos en que apareció, con la lectura encima y la palabra resaltada aunque vaya conjugada. Las de un video llevan el minuto y **Volver a 12:34**: trae la pestaña del video si sigue abierta, o lo abre, y salta a ese momento. También en la pestaña **Ejemplos** de la ficha sobre el video.
- **La página de un kanji.** Buscar un kanji suelto, como 愛, abre su página: sus trazos en grande, lo que significa, su nivel y sus lecturas, sus piezas de KanjiVG con el radical y la parte que le da el sonido, las palabras que ya conoces con él, las de uso común que lo llevan, dónde lo has visto, cómo se ve impreso, en letra de libro y a mano, y **Origen y cómo recordarlo**, con Claude. Si también es palabra, **Palabra** lo abre como tal.
- **Tamaño, ancho y letra.** Junto al buscador se cambian el tamaño de las palabras y el ancho; en **Ajustes, Diccionarios, Página del diccionario**, también la letra: gótica, redondeada, de libro o la de escribir a mano de los libros de texto.
- La ficha ya no enseña como definición la fila de grafías de JMdict (日本にほん★にっぽん★).

## 0.27.7 · 2026-11-09

- **La Ayuda de lectura se llama ahora Biblioteca.** Es el nombre que ya usaban el Cuaderno («Guardar en la biblioteca») y las copias de seguridad. Cambia en la barra lateral, el menú de la extensión, el visor y los mensajes, en los seis idiomas de la interfaz, en la documentación y en sus imágenes.
- **Los estados de una palabra caben en el panel del visor.** En el panel estrecho de una línea, «Ignorada» se salía y tapaba el botón de al lado.

## 0.27.6 · 2026-11-09

- **〜ので, solo cuando es «porque».** 「どうしたのですか」, 「〜のでしょう」, 「〜のである」 o 「〜のではないか」 llevan el の explicativo, no 〜ので, y salían marcados: en la novela de la revisión eran 185 de 311 detecciones. Tampoco 「のには」 es 〜のに.

## 0.27.5 · 2026-11-09

- **La gramática bajo los subtítulos, más fiable.** Revisadas las reglas con una novela entera (8622 frases): 「なくては」 y 「なくちゃ」 («hay que») salían como 〜てはいけない («no se debe»), justo lo contrario, y ahora son 〜なければならない; la interjección 「なるほど」 ya no es 〜ほど; el 過ぎる de «pasar» (三十分過ぎた, 昼過ぎ) ya no es 〜すぎる; el adjetivo 「うまい」 ya no es 〜まい, y 「ようになる」 y 「ようにする」 ya no se toman por 〜ようだ.

## 0.27.4 · 2026-11-09

- **Menos gramática de más bajo los subtítulos.** La regla de 〜ておく tomaba 「できます」 («poder») y 〜てくる (持ってきます) por 〜ておく, y ponía un chip falso bajo muchísimas frases. Ahora pide la お de verdad.
- El README enseña la gramática con estados y el Dictado, con sus imágenes en cada idioma de la interfaz que presenta el japonés.

## 0.27.3 · 2026-11-09

- **La ficha del Cuaderno, entera.** En el Cuaderno, la ficha de una palabra empieza debajo de la cabecera y, con la altura de la ventana, su parte de abajo, con **Enviar al creador**, quedaba fuera hasta desplazar la página. Ahora cabe entera.
- El README japonés, que presenta el inglés, enseña la pestaña **Cómo suena** (音声変化) con una imagen.

## 0.27.2 · 2026-11-09

- **El diccionario dice lo que sabe hacer.** Su portada explica que, además de escribir la palabra en japonés, se puede escribir lo que significa, como «perro» o «aunque», para buscarla por su significado o encontrar la gramática: hasta ahora no lo anunciaba en ningún sitio.
- En japonés, la pestaña **Cómo suena** de la ficha se llama 音声変化, el término habitual en los materiales de inglés, y cabe en una línea.

## 0.27.1 · 2026-11-09

- **Sinónimos en el diccionario.** Debajo de cada palabra, **Significan lo mismo** reúne las de uso común con el mismo significado, como 食う, 召し上がる o 頂く para 食べる, sacadas del propio diccionario al momento y sin gastar nada. Para saber en qué se diferencian sigue estando **Palabras parecidas y en qué se diferencian**, con Claude.
- **La copia de seguridad lleva la gramática.** Lo marcado en cada punto de gramática (sabido o aprendiendo) y dónde se ha visto no entraba, desde la 0.25.0, ni en la copia de seguridad ni en la copia completa. Ahora va en las dos y vuelve al restaurar.

## 0.27.0 · 2026-11-09

- **Cómo suena de verdad el inglés.** La ficha de una palabra inglesa tiene una pestaña nueva, **Cómo suena**, que enseña la frase como se dice al hablar seguido, con la forma hablada encima de cada trozo: reducciones (*going to* → *gonna*), formas débiles (*to* → *tə*), uniones (*turn off* → *tur‿noff*), la t o la d con *you* (*meet you* → *meechu*) y la t suave americana (*get it* → *ge‿dit*), con una leyenda. Se calcula con reglas, sin gastar nada.

## 0.26.0 · 2026-11-09

- **Dictado.** Un modo de reproducción nuevo: oculta la frase, pausa al final y en su lugar se escribe lo que se ha oído. Al comprobar, cada palabra sale en verde, en amarillo o subrayada, con la nota. En japonés se compara cómo se lee, con las otras lecturas del diccionario: 後 escrito «あと» vale aunque el analizador leyera «ご».
- **Repetir con tu voz.** Desde el resultado del dictado, o con `P` sobre cualquier subtítulo, la práctica del acento se abre con esa frase en la ventana de Kotonoha.
- En la práctica, las moras de dos letras (じゅ, ぎょ) ya no se parten en dos líneas, y mientras se prepara la frase ya no dice que no tiene palabras.

## 0.25.0 · 2026-11-09

- **Gramática que ya sabes.** Cada punto de gramática se marca como **Nuevo**, **Aprendiendo** o **Sabido**, en el globo del video, la ficha, la pantalla **JLPT** y el diccionario. Lo sabido deja de señalarse bajo los subtítulos. Cada punto recuerda en qué videos salió (**Dónde lo has visto**), se convierte en una **Tarjeta de opción múltiple** con opciones falsas elegidas por Claude, y se importa desde Anki (**Ajustes, Anki**), contra los 501 puntos de las listas del JLPT.

## 0.24.0 · 2026-11-09

- **Un diccionario para explorar.** El diccionario busca también por significado: «perro» da 犬, 愛犬 o 番犬, con la glosa que encaja. Lo buscado se compara con la gramática del JLPT, por su forma o por lo que significa. Debajo de cada palabra están sus kanji con su nivel, lecturas y significado, las palabras que se leen igual y **Palabras parecidas y en qué se diferencian**, con Claude. Y en la portada, **Explorar el diccionario**: onomatopeyas, expresiones de cuatro kanji, refranes, expresiones idiomáticas, palabras literarias y arcaicas, coloquiales y lenguaje respetuoso.

## 0.23.0 · 2026-11-09

- **El JLPT, nivel a nivel.** Una pantalla nueva, **JLPT**, reúne el vocabulario (8354 palabras), los kanji (2211) y la gramática (501 puntos) de cada nivel, de N5 a N1, con lo que ya se conoce de cada uno. Las palabras se marcan en su fila o todas a la vez; cada kanji enseña sus lecturas, sus trazos y las palabras del nivel que lo llevan; cada punto de gramática, las frases vistas en que aparece, y Claude lo explica cuando se pide. El vocabulario y los kanji son las listas de Jonathan Waller (CC BY); la gramática, una lista propia.
- La barrita de **Escuchar** y **Practicar** del Cuaderno vuelve a salir justo encima del trozo seleccionado: compartía estilos con la barra de selección de **Palabras**, que también se descolocaba. Una prueba nueva avisa si dos piezas vuelven a usar la misma clase.

## 0.22.0 · 2026-11-09

- **Compartir como imagen.** La ficha tiene un botón **Compartir como imagen**, junto a la frecuencia, que dibuja una tarjeta con la palabra, su furigana y su acento, lo que significa en esa frase (o lo que dice el diccionario), la frase donde apareció con la palabra resaltada y el título del video o del libro, y la copia al portapapeles al momento, lista para pegarla en un chat con Ctrl+V. Cada punto de **Gramática en esta frase** tiene el mismo botón. La tarjeta sale en **Tinta** o en **Papel** y se puede guardar como PNG.

## 0.21.0 · 2026-11-09

- **El Cuaderno.** El Portapapeles pasa a ser un cuaderno: una página a todo lo ancho, sin la hoja que lo encogía, con **Editar** y **Leer** en la misma página. Al editar se escribe con formato, como en un procesador de notas: títulos, subtítulos, listas con subpuntos, citas, código y negritas, con botones y con los atajos de costumbre (`# `, `- `, `・`, `1. `, `> `, Tab, Ctrl+B). **Organizar** le pide a Claude que estructure un texto pegado de corrido sin cambiar sus palabras, y Ctrl+Z lo deshace. Lo escrito se guarda solo; **Guardar en la biblioteca** lo lleva a la biblioteca, donde se sigue guardando, y **Editar en el Cuaderno** vuelve a abrir un texto de la biblioteca.
- **Leer en voz alta**, con velocidad (0,6× a 1,2×) y modo: seguido, frase a frase o repitiendo la misma frase para decirla a la vez.
- **Practicar cualquier trozo.** Al seleccionar con el ratón una palabra, media frase o varias, aparecen **Escuchar** y **Practicar**, que abre la práctica del acento con ese trozo.
- **Más rápido.** Los modelos de voz se cargan mientras se graba y siguen cargados mientras la práctica está abierta: el dictado se transcribe un segundo después de terminar, y desde la segunda grabación la práctica se analiza en menos de un segundo.

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

## 0.30.1 · 2026-11-10

- **From one word to another, with no ghosts.** Opening another word in the dictionary (another result in the list, one of the words that mean the same, a word from “Where you've seen it” or a kanji) showed the previous one, then the empty page with skeletons, then the new one arriving in pieces, with the page changing height at each step. The new word is now prepared while the previous one stays in view, and it comes in all at once with a short fade. If it takes a while, the previous one dims and a thin bar shows that something is on its way. The sentences in “Where you've seen it” arrive with their readings, instead of appearing without them and growing a moment later, and a word opened from the bottom of the page is shown from its top.
- **Claude no longer says “the sentence arrived empty”.** When explaining a word looked up on its own in the dictionary, or asking about similar words, the request carried an empty sentence, 「」, and the answer began by pointing it out. Claude is now told that the word is being looked up on its own. Answers saved that way are requested again once.
- **No more stray scrollbars.** The tooltip of the “In common use” star, even while invisible, stuck out to the right of its card and brought up a scrollbar under the results list; other tooltips did the same near the edge of a page. Tooltips no longer exist while they are not shown, and those of a card’s marks open inwards.
- The **Search** button no longer flickers with “Searching…” on every search, and the recent searches on the start page no longer move ahead of time.

## 0.30.0 · 2026-11-10

A polish release, with no new features. Every screen was measured under many combinations of options (sizes, readings, glosses, themes, interface languages, window widths and dictionary typefaces), looking for anything cut off, stuck to an edge or on top of something else, and what turned up was fixed.

- **Subtitles with room to breathe.** The reading sat a few pixels from the top edge of the box, and the text almost touched the bottom. There is now space around it at any size, from 40 to 250%, with and without readings, with and without the translation, and without the background. With very large text, the block shrinks just enough to stay inside the video. In a narrow window, where the line wraps, the reading of the second row no longer overlaps the first.
- **Each word's translation, under the word.** With **Word translation** set to unknown words, the glosses floated above and overlapped each other and the readings. Each one now sits under its word, which makes room for it.
- **The reading no longer touches the word.** The browser sets the reading flush against the word, and with the dictionary's gothic typeface the two actually touched. There is now a gap between them with all four typefaces, the reading never goes below 10 pixels (it was 8 in the small cards and in the subtitle navigator) and it keeps clear of the edge of its card.
- **The same options when reading as over the video.** In the Notebook, the Library and the viewer, readings appeared on every word even when they were set to unknown words only or to hover, and neither the status underline nor the accent color followed the setting. They now apply everywhere, and the text toolbar has a **Furigana** selector to change it without opening a video.
- **No full stop alone at the start of a line.** When reading, a 「。」 or a comma could end up at the start of the next line, away from its word. Not any more, in wrapped subtitles either. And lines are the same height whether or not they carry readings.
- **In a narrow window, the word card goes below.** In the Notebook, the Library and the viewer's text view, at half a screen's width, the word card covered the text and hid the sentence. It now opens below, full width, and the word being looked up scrolls into view.
- **Proverbs and long phrases.** In the dictionary cards, a long phrase was broken anywhere, leaving a single syllable on the second line. Lists of phrases now use wider cards and, if a phrase still has to wrap, it wraps between words.
- **Deleting asks first.** Deleting a book, with its file, its progress and its notes, took one click on a small icon, with no way back: it now asks first. Dictionaries, saved models, a Memory card, a written note and the API key take a second press on the same button.
- **Missing feedback.** **Copy** confirms that it copied; **Add known words**, in Words, says how many went in; **Paste**, in the Notebook, says when the clipboard is empty or the browser will not let it be read; **Export**, for the backup, and **Save image** say that the file was downloaded, because the Kotonoha window does not show the browser’s downloads, and when an image or a recording cannot be downloaded for the card, it says so. The backup carries the local date in its name, not the Greenwich one.
- **The Settings index** kept a section marked that was no longer in view after jumping with Page Down or the scrollbar.
- **Details.** The tabs of the word card no longer touch each other or get cut off with an ellipsis (in the viewer's panel they take two rows); the title of “What does it mean here?” no longer breaks in two; the tick for each level on the home path, which did not show, is back; the Library's formats split into two even rows, and images that fail to load in the card are removed instead of leaving a gap.

## 0.29.0 · 2026-11-09

- **The kanji dictionary.** A new dictionary, **Kanji (Kanjium and KANJIDIC)**, with 6,812 kanji, installed from a kanji's own page or in Settings (about 3 MB). With it, each kanji shows the official list it belongs to (Jōyō with its school grade, Jinmeiyō or outside the lists), its Kanken level and its rank among the most used; with the interface in Spanish, about 2,500 kanji have their meaning in Spanish.
- **All the readings.** Those on the official list first and, separately, the ones that are not on it and the ones used only in names. Each on reading says which period it comes from (Go-on, Kan-on, Tō-on), and the official ones that are hardly used are marked.
- **Radical, origin and old forms.** The radical with the name it is given in class (さんずい) and its number, how the kanji was formed (pictograph, simple ideograph, compound ideograph or phono-semantic compound) and its old forms and variants: 國 for 国. The page of an old form tells you how it is written today.
- **The kanji around it.** Its sound family (晴, 清 and 精 with 青), the kanji that contain it, the ones that look like it and are easy to confuse, its opposites, the ones with a similar meaning and the ones read the same way (神, 紙 and 髪 for かみ), with whether their accent tells them apart.
- **Special readings.** The common words that are not read like their kanji, such as 今日, 大人 or 寿司 (jukujikun and ateji from JMdict), on each kanji's page and as a new category in **Explore the dictionary**.
- **Writing practice.** On a kanji's page, **Practice** lets you write it with the mouse, a pen or your finger, **Tracing** or **From memory**. Each stroke is checked when you release it: if it goes the other way, if it is another of the remaining strokes or if it does not match, it says so. After the second mistake, or with **Hint**, the stroke draws itself, and at the end it tells you which strokes to review.
- **Dictionary lists appear at once.** The index used by the words with a kanji, the synonyms, the search by meaning and the categories was rebuilt every time the browser started and took about 16 seconds. It is now built more than three times faster, saved, and made ready at startup: the first list appears in under half a second.
- **Strokes for less common kanji.** The stroke server did not return the kanji it had not cached, such as 國, and they showed “no stroke data”. They are now requested from the KanjiVG repository.
- **The reading, away from the edge.** On the dictionary cards, the reading sat 3 pixels from the top edge; it now has room. Long words are written smaller instead of breaking into two lines, and a kanji's repeated components (the three 一 in 三) appear once.

## 0.28.0 · 2026-11-09

- **A complete dictionary, across the whole window.** The dictionary page uses the full width: the results list on the left, the word in the center and, on the right, its kanji, its opposites, the words with the same meaning and the words read the same way. With less width it switches to two columns and, in a narrow window, to one. Words are much easier to read: larger, in an easy-to-read sans typeface, with the reading always above. Each sense groups its glosses and shows its part of speech above them (godan verb, transitive, colloquial), separately for each dictionary, and the page opens with no tab open: no audio and no Claude until you ask.
- **Lists as cards.** Results, synonyms, homophones, opposites, onomatopoeia and the other categories are large cards, with the reading above, the meaning below, a star if the word is common and a dot if you already know it or are learning it. Written in kana, a search separates the words read that way (のむ gives 飲む and 呑む); with kanji, it also gives the words that start with it (日本 gives 日本語 and 日本人).
- **Opposites and “see also”.** The references in JMdict in English no longer mix with the definitions: they appear separately, as words you can open, with their meaning in your first dictionary. 上手 has 下手 as its opposite.
- **Where you've seen it, with the minute.** Below the word, the sentences from your videos and texts where it appeared, with the reading above and the word highlighted even when conjugated. Those from a video show the minute and **Back to 12:34**: it brings up the video's tab if it is still open, or opens it, and jumps to that moment. Also in the **Examples** tab of the word panel over the video.
- **A kanji's own page.** Looking up a single kanji, such as 愛, opens its page: its strokes in large size, what it means, its level and readings, its KanjiVG components with the radical and the part that gives the sound, the words you already know with it, the common words that contain it, where you have seen it, how it looks in print, book and handwritten type, and **Origin and how to remember it**, with Claude. If it is also a word, **Word** opens it as such.
- **Size, width and typeface.** Next to the search box you change the size of the words and the width; in **Settings, Dictionaries, Dictionary page**, the typeface too: sans, rounded, book, or the handwritten type of textbooks.
- The word panel no longer shows JMdict's spellings row as a definition (日本にほん★にっぽん★).

## 0.27.7 · 2026-11-09

- **The Reading assistant is now called Library.** It is the name the Notebook (“Save to the library”) and backups already used. It changes in the sidebar, the extension menu, the viewer and the messages, in all six interface languages, in the documentation and in its images.
- **A word's states fit in the viewer panel.** In the narrow panel of a line, “Ignored” spilled over the button next to it.

## 0.27.6 · 2026-11-09

- **〜ので, only when it means “because”.** どうしたのですか, 〜のでしょう, 〜のである or 〜のではないか carry the explanatory の, not 〜ので, and were being flagged: in the review's novel they were 185 of 311 detections. Nor is のには 〜のに.

## 0.27.5 · 2026-11-09

- **More reliable grammar under subtitles.** The rules were checked against a whole novel (8,622 sentences): なくては and なくちゃ (“must”) came out as 〜てはいけない (“must not”), the exact opposite, and are now 〜なければならない; the interjection なるほど is no longer 〜ほど; 過ぎる meaning “to pass” (三十分過ぎた, 昼過ぎ) is no longer 〜すぎる; the adjective うまい is no longer 〜まい; and ようになる and ようにする are no longer taken for 〜ようだ.

## 0.27.4 · 2026-11-09

- **Less extra grammar under subtitles.** The 〜ておく rule took できます (“can”) and 〜てくる (持ってきます) for 〜ておく, putting a false chip under a great many lines. It now requires the actual お.
- The README shows grammar with states and Dictation, with their images in every interface language that presents Japanese.

## 0.27.3 · 2026-11-09

- **The Notebook's word panel, in full.** In the Notebook, the word panel starts below the header and, at the window's height, its bottom with **Send to creator** was cut off until the page was scrolled. It now fits.
- The Japanese README, which presents English, shows the **How it sounds** tab (音声変化) with an image.

## 0.27.2 · 2026-11-09

- **The dictionary says what it can do.** Its start page explains that, besides typing the word in Japanese, you can type what it means, such as “dog” or “although”, to look it up by meaning or find the grammar: until now it said so nowhere.
- In Japanese, the **How it sounds** tab on the word panel is called 音声変化, the usual term in English-learning materials, and fits on one line.

## 0.27.1 · 2026-11-09

- **Synonyms in the dictionary.** Below each word, **Same meaning** gathers the common words with the same meaning, such as 食う, 召し上がる or 頂く for 食べる, taken from the dictionary itself, instantly and at no cost. To learn how they differ, **Similar words and how they differ** is still there, with Claude.
- **Backups include grammar.** What has been marked on each grammar point (known or learning) and where it has been seen was left out of the backup and the full backup since 0.25.0. It now goes in both and comes back on restore.

## 0.27.0 · 2026-11-09

- **How English really sounds.** The word panel for an English word has a new tab, **How it sounds**, that shows the sentence as it is said in connected speech, with the spoken form above each part: reductions (*going to* → *gonna*), weak forms (*to* → *tə*), linking (*turn off* → *tur‿noff*), t or d with *you* (*meet you* → *meechu*) and the American soft t (*get it* → *ge‿dit*), with a legend. It is worked out with rules, at no cost.

## 0.26.0 · 2026-11-09

- **Dictation.** A new playback mode: it hides the line, pauses at the end and, in its place, you type what you heard. When you check, each word shows in green, yellow or underlined, with the score. In Japanese the reading is compared, with the other dictionary readings: 後 typed as “あと” counts even if the analyser read “ご”.
- **Repeat in your voice.** From the dictation result, or with `P` over any subtitle, pitch accent practice opens with that line in the Kotonoha window.
- In practice, two-letter morae (じゅ, ぎょ) are no longer split over two lines, and while the line is being prepared it no longer says it has no words.

## 0.25.0 · 2026-11-09

- **Grammar you already know.** Each grammar point is marked as **New**, **Learning** or **Known**, in the video bubble, the word panel, the **JLPT** screen and the dictionary. Known points are no longer flagged under subtitles. Each point remembers the videos it appeared in (**Where you’ve seen it**), turns into a **Multiple-choice card** with wrong options chosen by Claude, and can be imported from Anki (**Settings, Anki**), against the 501 points of the JLPT lists.

## 0.24.0 · 2026-11-09

- **A dictionary to explore.** The dictionary also searches by meaning: “dog” gives 犬, 愛犬 or 番犬, with the matching gloss. What you search is compared with the JLPT grammar, by form or by meaning. Below each word are its kanji with their level, readings and meaning, the words read the same way and **Similar words and how they differ**, with Claude. And on the start page, **Explore the dictionary**: onomatopoeia, four-kanji expressions, proverbs, idioms, literary and archaic words, colloquial words and respectful language.

## 0.23.0 · 2026-11-09

- **The JLPT, level by level.** A new **JLPT** screen brings together the vocabulary (8,354 words), kanji (2,211) and grammar (501 points) of each level, from N5 to N1, with what you already know of each. Words are marked on their row or all at once; each kanji shows its readings, its strokes and the words of the level that use it; each grammar point, the sentences you have seen it in, and Claude explains it when asked. The vocabulary and kanji are Jonathan Waller’s lists (CC BY); the grammar is the project’s own list.
- The Notebook’s **Listen** and **Practice** bar appears right above the selected text again: it shared styles with the selection bar of **Words**, which was also out of place. A new test warns if two pieces use the same class again.

## 0.22.0 · 2026-11-09

- **Share as image.** The word panel has a **Share as image** button, next to the frequency, that draws a card with the word, its furigana and pitch accent, what it means in that sentence (or what the dictionary says), the sentence it appeared in with the word highlighted and the title of the video or book, and copies it to the clipboard at once, ready to paste into a chat with Ctrl+V. Each point under **Grammar in this sentence** has the same button. The card comes in **Ink** or **Paper** and can be saved as a PNG.

## 0.21.0 · 2026-11-09

- **The Notebook.** The Clipboard becomes a notebook: a full-width page, without the sheet that made it narrow, with **Edit** and **Read** on the same page. While editing you write with formatting, as in a note-taking app: headings, subheadings, lists with sub-items, quotes, code and bold, with buttons and the usual shortcuts (`# `, `- `, `・`, `1. `, `> `, Tab, Ctrl+B). **Organize** asks Claude to structure text pasted as one block without changing its words, and Ctrl+Z undoes it. What you write saves itself; **Save to the library** takes it to the library, where it keeps being saved, and **Edit in the Notebook** reopens a library text.
- **Read aloud**, with speed (0.6× to 1.2×) and mode: continuous, sentence by sentence or repeating the same sentence so you can say it along.
- **Practise any part.** Selecting a word, half a sentence or several with the mouse shows **Listen** and **Practice**, which opens pitch accent practice with that part.
- **Faster.** Speech models load while you record and stay loaded while practice is open: dictation is transcribed a second after you finish, and from the second recording on, practice is analysed in under a second.

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
