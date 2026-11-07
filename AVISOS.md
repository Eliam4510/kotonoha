# Avisos · Notices

[Español](#español) · [English](#english) · [Deutsch](docs/de/notices.md) · [简体中文](docs/zh/notices.md) · [한국어](docs/ko/notices.md) · [日本語](docs/ja/notices.md)

## Español

### Licencia del proyecto

El código de Kotonoha se publica bajo la [licencia MIT](LICENSE). Los componentes de terceros conservan sus propias licencias.

### Componentes de terceros

| Componente | Uso | Licencia |
|---|---|---|
| [Preact](https://preactjs.com) y Preact Signals | Interfaz | MIT |
| [Dexie](https://dexie.org) | Base de datos local | Apache-2.0 |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | Análisis morfológico, con el diccionario IPADIC | Apache-2.0, y la licencia propia de IPADIC |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Cliente de la API de Claude | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) y [ONNX Runtime](https://onnxruntime.ai) | Ejecución de Whisper | Apache-2.0 y MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | Modelo de transcripción, descargado al usarlo | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/ffmpeg` | Lectura de archivos propios | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/core` | Núcleo de FFmpeg, copiado al compilar | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs), `@breezystack/lamejs` | Codificación MP3 | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Planificación del repaso | MIT |
| [fflate](https://github.com/101arrowz/fflate) | Lectura de archivos ZIP | MIT |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | Análisis morfológico del inglés | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | Modelo de inglés para wink-nlp | MIT |
| [Phosphor Icons](https://phosphoricons.com) | Iconos | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) y [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | Tipografía | OFL-1.1 |

El código de este repositorio no incluye binarios de terceros: se obtienen de npm al instalar. La carpeta `dist` y los paquetes compilados de cada versión sí contienen `@ffmpeg/core` y `lamejs`, y llevan en su carpeta `licencias` los textos y avisos de todos los componentes.

El código fuente correspondiente está en [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10), que compila [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) con sus bibliotecas, y en [lamejs](https://github.com/gideonstele/lamejs). Quien redistribuya estos paquetes debe respetar la GPL y la LGPL, lo que incluye ofrecer ese código fuente.

### Datos descargados al usar la extensión

Ninguno de estos datos forma parte del repositorio. La extensión los descarga bajo demanda.

| Datos | Procedencia | Condiciones |
|---|---|---|
| JMdict y JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html), en el formato de [jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) | CC BY-SA 4.0 |
| Acento tonal | [Kanjium](https://github.com/mifunetoshiro/kanjium) | Las indicadas por el proyecto |
| Frecuencias | [JPDB](https://jpdb.io), en el formato de [yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) | Las indicadas por el proyecto |
| Orden de los trazos | [KanjiVG](https://kanjivg.tagaini.net), de Ulrich Apel, con los archivos originales servidos por jsDelivr | CC BY-SA 3.0 |
| Audio de palabras | JapanesePod101 y [Lingua Libre](https://lingualibre.org) | Las de cada fuente |
| Imágenes | [Openverse](https://openverse.org) | La licencia de cada imagen |
| Diccionarios y pronunciación del inglés | [Wiktionary](https://www.wiktionary.org), preparados por [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) a partir de [kaikki.org](https://kaikki.org), y servidos desde Hugging Face | CC BY-SA 4.0 |
| Frecuencias del inglés | [FrequencyWords](https://github.com/hermitdave/FrequencyWords), de Hermit Dave, a partir de OpenSubtitles | CC BY-SA 4.0 |
| Audio de palabras en inglés | Wikimedia Commons y [Lingua Libre](https://lingualibre.org) | Las de cada grabación |

### Programas externos

El ayudante local utiliza [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense) y [FFmpeg](https://ffmpeg.org) (LGPL o GPL, según la compilación). No se incluyen ni en este repositorio ni en sus paquetes: se usan los instalados en el equipo.

### Uso responsable

Kotonoha es una herramienta de estudio para uso personal.

- No elude sistemas anticopia. Lee los subtítulos que el reproductor ya ofrece a la sesión del usuario.
- El ayudante local solo debe usarse con contenido que el usuario tenga derecho a descargar, y respetando las condiciones de cada sitio.
- Las condiciones de uso de cada servicio de video son responsabilidad del usuario.
- Los subtítulos y demás obras pueden estar protegidos por derechos de autor, y no deben redistribuirse sin permiso.

### Marcas

YouTube, Netflix, Disney+, Crunchyroll, Viki, Bilibili, iQIYI, Prime Video, Anki, Claude y Anthropic son marcas de sus respectivos titulares. Este proyecto es independiente y no está afiliado, patrocinado ni respaldado por ninguno de ellos.

## English

### Project license

Kotonoha's code is released under the [MIT license](LICENSE). Third-party components keep their own licenses.

### Third-party components

| Component | Use | License |
|---|---|---|
| [Preact](https://preactjs.com) and Preact Signals | Interface | MIT |
| [Dexie](https://dexie.org) | Local database | Apache-2.0 |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | Morphological analysis, with the IPADIC dictionary | Apache-2.0, and IPADIC's own license |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Claude API client | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) and [ONNX Runtime](https://onnxruntime.ai) | Running Whisper | Apache-2.0 and MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | Transcription model, downloaded on use | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/ffmpeg` | Reading local files | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/core` | FFmpeg core, copied at build time | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs), `@breezystack/lamejs` | MP3 encoding | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Review scheduling | MIT |
| [fflate](https://github.com/101arrowz/fflate) | Reading ZIP files | MIT |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | Morphological analysis of English | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | English model for wink-nlp | MIT |
| [Phosphor Icons](https://phosphoricons.com) | Icons | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) and [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | Typography | OFL-1.1 |

The code in this repository contains no third-party binaries: they come from npm on install. The `dist` folder and the compiled packages of each version do contain `@ffmpeg/core` and `lamejs`, and carry the texts and notices of every component in their `licencias` folder.

The corresponding source code is at [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10), which builds [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) with its libraries, and at [lamejs](https://github.com/gideonstele/lamejs). Anyone redistributing these packages must comply with the GPL and LGPL, which includes offering that source code.

### Data downloaded while using the extension

None of this data is part of the repository. The extension downloads it on demand.

| Data | Source | Terms |
|---|---|---|
| JMdict and JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html), in the format of [jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) | CC BY-SA 4.0 |
| Pitch accent | [Kanjium](https://github.com/mifunetoshiro/kanjium) | As stated by the project |
| Frequencies | [JPDB](https://jpdb.io), in the format of [yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) | As stated by the project |
| Stroke order | [KanjiVG](https://kanjivg.tagaini.net), by Ulrich Apel, with the original files served by jsDelivr | CC BY-SA 3.0 |
| Word audio | JapanesePod101 and [Lingua Libre](https://lingualibre.org) | Those of each source |
| Images | [Openverse](https://openverse.org) | The license of each image |
| English dictionaries and pronunciation | [Wiktionary](https://www.wiktionary.org), prepared by [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) from [kaikki.org](https://kaikki.org), and served from Hugging Face | CC BY-SA 4.0 |
| English frequencies | [FrequencyWords](https://github.com/hermitdave/FrequencyWords), by Hermit Dave, from OpenSubtitles | CC BY-SA 4.0 |
| English word audio | Wikimedia Commons and [Lingua Libre](https://lingualibre.org) | Those of each recording |

### External programs

The local helper uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense) and [FFmpeg](https://ffmpeg.org) (LGPL or GPL, depending on the build). They are included neither in this repository nor in its packages: the ones installed on the computer are used.

### Responsible use

Kotonoha is a study tool for personal use.

- It does not circumvent copy protection. It reads the subtitles the player already offers to the user's session.
- The local helper should only be used with content the user has the right to download, and in accordance with each site's terms.
- Complying with each video service's terms of use is the user's responsibility.
- Subtitles and other works may be protected by copyright, and should not be redistributed without permission.

### Trademarks

YouTube, Netflix, Disney+, Crunchyroll, Viki, Bilibili, iQIYI, Prime Video, Anki, Claude and Anthropic are trademarks of their respective owners. This project is independent and is not affiliated with, sponsored by or endorsed by any of them.
