# Permisos de Kotonoha · Kotonoha's permissions

[Español](#español) · [English](#english)

Las tiendas piden justificar cada permiso. Estos textos sirven para el formulario de Chrome Web Store y de Edge Add-ons.

## Español

**Propósito único.** Aprender idiomas con video y texto real: subtítulos interactivos, diccionario, tarjetas de repaso y ayuda de lectura, con explicaciones de una IA cuando el usuario las pide.

| Permiso | Para qué |
|---|---|
| `storage` y `unlimitedStorage` | Guardar en el navegador las palabras, las tarjetas, la biblioteca, los ajustes y los diccionarios, que ocupan cientos de MB. |
| `offscreen` | El motor (diccionarios, análisis de frases, transcripción de voz y OCR) corre en un documento offscreen para no cargar las páginas. |
| `tabCapture` y `activeTab` | Grabar el audio de la frase del video para una tarjeta y transcribir un video mientras se reproduce. Solo se activa con el icono o un atajo de teclado. |
| `scripting` y `tabs` | Mostrar los subtítulos y el lector sobre la página que se está viendo, y abrir las páginas de la extensión. |
| `contextMenus` | «Buscar en Kotonoha» y «Abrir selección en el Portapapeles» en el menú del texto seleccionado. |
| `idle` | Saber si el usuario está usando el equipo: la transcripción de un video va más suave mientras lo usa. |
| `alarms` | En una copia instalada desde GitHub, ver cada medio minuto si su carpeta se actualizó y recargarse. |
| `nativeMessaging` | Hablar con el ayudante local, si el usuario lo instala: descarga el audio de un video para transcribirlo entero y actualiza la extensión. |
| `clipboardRead` y `clipboardWrite` | El Portapapeles: leer el texto copiado para analizarlo, y copiar frases y notas. |
| Acceso a todos los sitios (`<all_urls>`) | Los subtítulos interactivos y el lector funcionan en cualquier sitio con video o texto; la captura de la imagen de la frase para las tarjetas; la descarga de diccionarios y modelos; Anki y los motores locales en 127.0.0.1; y la API del proveedor de IA que elija el usuario. |

**Código remoto.** La extensión no ejecuta código descargado. Descarga datos: modelos de reconocimiento de voz y de texto (pesos en formato ONNX) y diccionarios, que lee su propio código empaquetado.

**Datos.** Nada se recoge ni se vende. Lo que se envía a terceros, solo al usar cada función, está en la [política de privacidad](../privacidad.md).

## English

**Single purpose.** Learning languages from real video and text: interactive subtitles, a dictionary, review flashcards and reading help, with AI explanations when the user asks for them.

| Permission | Why |
|---|---|
| `storage` and `unlimitedStorage` | To keep words, flashcards, the library, settings and dictionaries in the browser; the dictionaries take hundreds of MB. |
| `offscreen` | The engine (dictionaries, sentence analysis, speech transcription and OCR) runs in an offscreen document so that pages stay light. |
| `tabCapture` and `activeTab` | To record the audio of a video's sentence for a flashcard and to transcribe a video while it plays. Only activated by the toolbar icon or a keyboard shortcut. |
| `scripting` and `tabs` | To show the subtitles and the reader over the page being viewed, and to open the extension's pages. |
| `contextMenus` | "Look up in Kotonoha" and "Open selection in the Clipboard" in the selected text menu. |
| `idle` | To know whether the user is using the computer: transcribing a video runs more gently while they are. |
| `alarms` | In a copy installed from GitHub, to check every half minute whether its folder was updated and reload. |
| `nativeMessaging` | To talk to the local helper, if the user installs it: it downloads a video's audio to transcribe it in full, and updates the extension. |
| `clipboardRead` and `clipboardWrite` | The Clipboard feature: reading copied text to analyze it, and copying sentences and notes. |
| Access to all sites (`<all_urls>`) | Interactive subtitles and the reader work on any site with video or text; capturing the sentence's image for flashcards; downloading dictionaries and models; Anki and local engines on 127.0.0.1; and the API of the AI provider the user chooses. |

**Remote code.** The extension does not run downloaded code. It downloads data: speech and text recognition models (ONNX weights) and dictionaries, which its own packaged code reads.

**Data.** Nothing is collected or sold. What is sent to third parties, only when each feature is used, is in the [privacy policy](../privacidad.md).
