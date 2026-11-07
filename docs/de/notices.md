<p align="right"><a href="../../AVISOS.md">Español · English</a> · <b>Deutsch</b> · <a href="../zh/notices.md">简体中文</a> · <a href="../ko/notices.md">한국어</a> · <a href="../ja/notices.md">日本語</a></p>

# Hinweise

Übersetzung zur Orientierung. Maßgeblich sind die Originalfassungen in [AVISOS.md](../../AVISOS.md).

## Projektlizenz

Der Code von Kotonoha wird unter der [MIT-Lizenz](../../LICENSE) veröffentlicht. Komponenten von Dritten behalten ihre eigenen Lizenzen.

## Komponenten von Dritten

| Komponente | Verwendung | Lizenz |
|---|---|---|
| [Preact](https://preactjs.com) und Preact Signals | Oberfläche | MIT |
| [Dexie](https://dexie.org) | Lokale Datenbank | Apache-2.0 |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | Morphologische Analyse, mit dem IPADIC-Wörterbuch | Apache-2.0 und die eigene Lizenz von IPADIC |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Client der Claude-API | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) und [ONNX Runtime](https://onnxruntime.ai) | Ausführung von Whisper | Apache-2.0 und MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | Transkriptionsmodell, bei Nutzung heruntergeladen | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0), von Third Intelligence, in der [ONNX-Umwandlung von Sanami](https://huggingface.co/Sanami/haas-ja-onnx) | Transkriptionsmodell für Japanisch, bei Nutzung heruntergeladen | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), von NVIDIA, in der ONNX-Umwandlung von [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) und [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) | Transkriptionsmodell für Englisch und Deutsch, bei Nutzung heruntergeladen | CC-BY-4.0 |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/ffmpeg` | Lesen eigener Dateien | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/core` | FFmpeg-Kern, beim Kompilieren kopiert | GPL-2.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs), `@breezystack/lamejs` | MP3-Kodierung | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Planung der Wiederholung | MIT |
| [fflate](https://github.com/101arrowz/fflate) | Lesen von ZIP-Dateien | MIT |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | Morphologische Analyse des Englischen | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | Englisches Modell für wink-nlp | MIT |
| [Phosphor Icons](https://phosphoricons.com) | Symbole | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) und [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | Schrift | OFL-1.1 |

Der Code dieses Repositorys enthält keine Binärdateien von Dritten: Sie stammen bei der Installation von npm. Der Ordner `dist` und die kompilierten Pakete jeder Version enthalten `@ffmpeg/core` und `lamejs` und führen in ihrem Ordner `licencias` die Texte und Hinweise aller Komponenten.

Der zugehörige Quellcode befindet sich unter [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10), das [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) mit seinen Bibliotheken kompiliert, und unter [lamejs](https://github.com/gideonstele/lamejs). Wer diese Pakete weiterverbreitet, muss GPL und LGPL einhalten, einschließlich des Angebots dieses Quellcodes.

## Bei der Nutzung heruntergeladene Daten

Keine dieser Daten gehört zum Repository. Die Erweiterung lädt sie bei Bedarf herunter.

| Daten | Herkunft | Bedingungen |
|---|---|---|
| JMdict und JMnedict | [EDRDG](https://www.edrdg.org/edrdg/licence.html), im Format von [jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) | CC BY-SA 4.0 |
| Tonhöhenakzent | [Kanjium](https://github.com/mifunetoshiro/kanjium) | Wie vom Projekt angegeben |
| Häufigkeiten | [JPDB](https://jpdb.io), im Format von [yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) | Wie vom Projekt angegeben |
| Strichfolge | [KanjiVG](https://kanjivg.tagaini.net) von Ulrich Apel, mit den Originaldateien über jsDelivr | CC BY-SA 3.0 |
| Audio von Wörtern | JapanesePod101 und [Lingua Libre](https://lingualibre.org) | Die jeder Quelle |
| Bilder | [Openverse](https://openverse.org) | Die Lizenz jedes Bildes |
| Wörterbücher und Aussprache des Englischen und Deutschen | [Wiktionary](https://www.wiktionary.org), aufbereitet von [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) aus [kaikki.org](https://kaikki.org) und über Hugging Face bereitgestellt | CC BY-SA 4.0 |
| Häufigkeiten des Englischen und Deutschen | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) von Hermit Dave, auf Basis von OpenSubtitles | CC BY-SA 4.0 |
| Wort-Audio auf Englisch und Deutsch | Wikimedia Commons und [Lingua Libre](https://lingualibre.org) | Die der jeweiligen Aufnahme |

## Externe Programme

Der lokale Helfer verwendet [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense) und [FFmpeg](https://ffmpeg.org) (LGPL oder GPL, je nach Kompilierung). Sie sind weder in diesem Repository noch in seinen Paketen enthalten: Verwendet werden die auf dem Computer installierten.

## Verantwortungsvolle Nutzung

Kotonoha ist ein Lernwerkzeug für den persönlichen Gebrauch.

- Es umgeht keine Kopierschutzsysteme. Es liest die Untertitel, die der Player der Sitzung des Benutzers bereits anbietet.
- Der lokale Helfer darf nur mit Inhalten verwendet werden, die der Benutzer herunterladen darf, und unter Beachtung der Bedingungen jeder Website.
- Die Nutzungsbedingungen jedes Videodienstes liegen in der Verantwortung des Benutzers.
- Untertitel und andere Werke können urheberrechtlich geschützt sein und dürfen nicht ohne Erlaubnis weiterverbreitet werden.

## Marken

YouTube, Netflix, Disney+, Crunchyroll, Viki, Bilibili, iQIYI, Prime Video, Anki, Claude und Anthropic sind Marken ihrer jeweiligen Inhaber. Dieses Projekt ist unabhängig und weder mit ihnen verbunden noch von ihnen gesponsert oder unterstützt.
