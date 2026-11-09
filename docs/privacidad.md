# Política de privacidad · Privacy policy

[Español](#español) · [English](#english)

## Español

Última actualización: 9 de noviembre de 2026.

Kotonoha es una extensión de navegador de código abierto para aprender idiomas con video y texto real. No tiene servidores propios, no tiene cuentas de usuario y no recoge estadísticas de uso.

### Lo que se guarda y dónde

Todo lo que Kotonoha guarda queda en el navegador de quien la usa, en su almacenamiento local (IndexedDB, el almacenamiento privado de archivos y `chrome.storage`): palabras, tarjetas, biblioteca, libros importados, lo leído por el OCR, notas, subtítulos generados, grabaciones del dictado, ajustes y claves de API. Nada de eso sale del equipo salvo en los casos que se describen abajo. Se borra al desinstalar la extensión.

La copia de seguridad y la copia completa son archivos que el usuario guarda donde decide; no incluyen las claves de API.

### Lo que se envía a terceros, y cuándo

Solo cuando el usuario usa la función correspondiente, y solo a los servicios indicados:

| Servicio | Qué se envía | Cuándo |
|---|---|---|
| Anthropic (API de Claude) u otro proveedor de IA que el usuario configure, como OpenRouter, DeepSeek u OpenAI | El texto de la frase, la página o los subtítulos que se piden explicar, traducir, corregir o revisar; en la revisión del OCR, la imagen de la página | Al pedir una explicación, una traducción, una corrección o una revisión, con la clave del propio usuario |
| Microsoft Azure Speech | El texto de la frase que se va a leer | Al escuchar una frase, con la clave del propio usuario |
| Hugging Face, GitHub y jsDelivr | Solo la petición del archivo | Al descargar modelos y diccionarios |
| JapanesePod101, Lingua Libre, Wikimedia Commons y Openverse | La palabra buscada | Al buscar el audio o la imagen de una palabra |
| API de GitHub | Solo la consulta de la última versión publicada | Una vez al día, si los avisos de versión están activados |
| Sitios de video | Las peticiones normales del sitio, como las de sus subtítulos | Al ver un video en ese sitio |

Las claves de API las escribe el usuario, se guardan en su navegador y solo se envían al servicio al que pertenecen. Cada servicio trata los datos según su propia política de privacidad.

La transcripción de voz (Whisper, Haas-ja, Parakeet), el OCR, el análisis de las frases y la práctica de pronunciación se hacen en el propio equipo, sin enviar el audio ni las imágenes a ningún servidor.

### Programas del propio equipo

Si el usuario los configura, Kotonoha se comunica con programas que corren en su equipo: Anki (AnkiConnect), un motor de voz local (AivisSpeech o VOICEVOX), servidores de IA locales (LM Studio u Ollama) y el ayudante local, que descarga el audio de los videos que el usuario pide transcribir y actualiza la extensión desde GitHub.

### Permisos

Cada permiso se explica en [docs/tienda/permisos.md](tienda/permisos.md).

### Contacto

Las dudas sobre privacidad se plantean en [GitHub Issues](https://github.com/Eliam4510/kotonoha/issues).

## English

Last updated: November 9, 2026.

Kotonoha is an open-source browser extension for learning languages from real video and text. It has no servers of its own, no user accounts, and it collects no usage statistics.

### What is stored, and where

Everything Kotonoha stores stays in the user's browser, in its local storage (IndexedDB, the origin private file system and `chrome.storage`): words, flashcards, the library, imported books, OCR results, notes, generated subtitles, dictation recordings, settings and API keys. None of it leaves the computer except in the cases described below. It is deleted when the extension is uninstalled.

The backup and the full copy are files the user saves wherever they choose; they do not include API keys.

### What is sent to third parties, and when

Only when the user uses the corresponding feature, and only to the services listed:

| Service | What is sent | When |
|---|---|---|
| Anthropic (Claude API), or another AI provider the user sets up, such as OpenRouter, DeepSeek or OpenAI | The text of the sentence, page or subtitles to be explained, translated, corrected or reviewed; for OCR review, the page image | When the user asks for an explanation, translation, correction or review, with the user's own key |
| Microsoft Azure Speech | The text of the sentence to be read aloud | When the user plays a sentence, with the user's own key |
| Hugging Face, GitHub and jsDelivr | Only the request for the file | When downloading models and dictionaries |
| JapanesePod101, Lingua Libre, Wikimedia Commons and Openverse | The word being looked up | When looking up a word's audio or image |
| GitHub API | Only the query for the latest published version | Once a day, if version notices are on |
| Video sites | The site's own normal requests, such as those for its subtitles | When watching a video on that site |

API keys are entered by the user, stored in their browser and sent only to the service they belong to. Each service handles data under its own privacy policy.

Speech transcription (Whisper, Haas-ja, Parakeet), OCR, sentence analysis and pronunciation practice run on the user's own computer; audio and images are not sent to any server.

### Programs on the user's computer

If the user sets them up, Kotonoha talks to programs running on their computer: Anki (AnkiConnect), a local voice engine (AivisSpeech or VOICEVOX), local AI servers (LM Studio or Ollama) and the local helper, which downloads the audio of the videos the user asks to transcribe and updates the extension from GitHub.

### Permissions

Each permission is explained in [docs/tienda/permisos.md](tienda/permisos.md).

### Contact

Privacy questions can be raised in [GitHub Issues](https://github.com/Eliam4510/kotonoha/issues).
