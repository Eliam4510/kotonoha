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
| [ProseMirror](https://prosemirror.net) | Der Editor des Notizbuchs | MIT |
| [Kuromoji](https://github.com/takuyaa/kuromoji.js) | Morphologische Analyse, mit dem IPADIC-Wörterbuch | Apache-2.0 und die eigene Lizenz von IPADIC |
| [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) | Client der Claude-API | Apache-2.0 |
| [Transformers.js](https://github.com/huggingface/transformers.js) und [ONNX Runtime](https://onnxruntime.ai) | Ausführung von Whisper | Apache-2.0 und MIT |
| [Whisper large-v3-turbo](https://huggingface.co/onnx-community/whisper-large-v3-turbo) | Transkriptionsmodell, bei Nutzung heruntergeladen | MIT |
| [Haas-ja-v1.0](https://huggingface.co/third-intelligence/Haas-ja-v1.0), von Third Intelligence, in der [ONNX-Umwandlung von Sanami](https://huggingface.co/Sanami/haas-ja-onnx) | Transkriptionsmodell für Japanisch, bei Nutzung heruntergeladen | Apache-2.0 |
| [Parakeet TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), von NVIDIA, in der ONNX-Umwandlung von [istupakov](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) und [ysdede](https://huggingface.co/ysdede/parakeet-tdt-0.6b-v3-onnx) | Transkriptionsmodell für Englisch und Deutsch, bei Nutzung heruntergeladen | CC-BY-4.0 |
| [PP-OCRv5](https://github.com/PaddlePaddle/PaddleOCR), von PaddlePaddle, in der [ONNX-Umwandlung von nakamura196](https://huggingface.co/nakamura196/ppocrv5-mobile-web-onnx) | Erkennung der Textzeilen in Büchern, bei Gebrauch heruntergeladen | Apache-2.0 |
| [PP-OCRv6 small](https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx), von PaddlePaddle | Texterkennung für Bücher, bei Gebrauch heruntergeladen; das Wörterbuch liegt in der Erweiterung (`modelos/`) | Apache-2.0 |
| [manga-ocr](https://github.com/kha-white/manga-ocr), von kha-white, in der [ONNX-Umwandlung von onnx-community](https://huggingface.co/onnx-community/manga-ocr-base-ONNX), und der [Sprechblasen-Detektor von ogkalu](https://huggingface.co/ogkalu/comic-text-and-bubble-detector) | Texterkennung für Manga, bei Gebrauch heruntergeladen | Apache-2.0 |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), von hexgrad, in der [ONNX-Umwandlung von onnx-community](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX), und [Piper](https://github.com/rhasspy/piper) mit der [Stimme von Thorsten](https://huggingface.co/rhasspy/piper-voices) | Neuronale Stimmen für Englisch und Deutsch, bei Gebrauch heruntergeladen | Apache-2.0 und MIT; Thorstens Stimme wurde mit einem CC0-Datensatz trainiert |
| [narabas](https://github.com/darashi/narabas), von darashi, mit seinem [Modell](https://github.com/darashi/narabas-models/releases/tag/v0), trainiert mit dem ReazonSpeech-Korpus | Phonemmodell für Japanisch, das die Moren in der Akzentübung prüft, bei Gebrauch aus der Veröffentlichung seines Autors heruntergeladen, wie es das Werkzeug selbst tut; Kotonoha verbreitet es nicht weiter | MIT, das Werkzeug; das Modell wird ohne eigene Lizenz veröffentlicht |
| Die [Stimmen von AivisHub](https://hub.aivis-project.com) (Style-Bert-VITS2 JP-Extra), mit dem BERT [DeBERTa-v2-large-japanese-char-wwm](https://huggingface.co/ku-nlp/deberta-v2-large-japanese-char-wwm) von ku-nlp, in der [ONNX-Umwandlung von tsukumijima](https://huggingface.co/tsukumijima/deberta-v2-large-japanese-char-wwm-onnx), und dem Wörterbuch [naist-jdic](https://github.com/jpreprocess/naist-jdic) im [Format von yomi](https://huggingface.co/datasets/hdae/yomi-dict) | Neuronale Stimmen des Japanischen, heruntergeladen beim Installieren unter Einstellungen, Stimmen; Kotonoha verbreitet sie nicht weiter | Jede Stimme ihre eigene, die vor dem Installieren angezeigt wird (ACML 1.0, ACML-NC 1.0, CC0 oder eine eigene); CC BY-SA 4.0 für das BERT und BSD-3-Clause für das Wörterbuch |
| [yomi](https://jsr.io/@hdae/yomi) 0.4.2 | Lesungen, Akzent und Akzentphrasen für die Stimmen von AivisHub, in den Code übernommen unter src/lenguas/japones/voz/yomi, mit seiner LICENSE und NOTICE | MIT |
| [pinyin-pro](https://github.com/zh-lx/pinyin-pro) | Pinyin des Chinesischen im Kontext: von den Lesungen eines Zeichens (长, cháng oder zhǎng) die seines Satzes | MIT |
| [opencc-js](https://github.com/nk2028/opencc-js), mit den Tabellen von [OpenCC](https://github.com/BYVoid/OpenCC) (`opencc-data`) | Wandelt Spuren in traditionellen Schriftzeichen und das von Whisper Transkribierte in vereinfachte Schriftzeichen um; sein Hinweis steht in `licencias/AVISO-opencc.txt` | MIT der Code, Apache-2.0 die Tabellen |
| HSK-Listen von [krmanik/HSK-3.0](https://github.com/krmanik/HSK-3.0) (Mani), aus dem HSK-Lehrplan von 2025, mit Pinyin und Glossen aus [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) | Wortschatz, Hanzi und Grammatik jeder Stufe auf dem HSK-Bildschirm (`datos/hsk`), erzeugt mit `herramientas/hsk.mjs`; die Grammatikerklärungen stammen vom Projekt | CC BY-SA 4.0, auch die abgeleiteten Listen |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/ffmpeg` | Lesen eigener Dateien | MIT |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm), `@ffmpeg/core` | FFmpeg-Kern, beim Kompilieren kopiert | GPL-2.0-or-later |
| [piper-phonemize](https://github.com/rhasspy/piper-phonemize) mit [eSpeak NG](https://github.com/espeak-ng/espeak-ng), `@diffusionstudio/piper-wasm` | Phoneme der neuronalen Stimmen, beim Kompilieren nur mit den Wörterbüchern für Englisch und Deutsch kopiert | MIT und GPL-3.0-or-later |
| [lamejs](https://github.com/gideonstele/lamejs), `@breezystack/lamejs` | MP3-Kodierung | LGPL-3.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Planung der Wiederholung | MIT |
| [fflate](https://github.com/101arrowz/fflate) | Lesen von ZIP-Dateien | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js), `pdfjs-dist` | Lesen von PDFs im Betrachter, mit dem JBIG2-Decoder von PDFium (BSD-3-Clause), OpenJPEG (BSD-2-Clause) und qcms (MIT) | Apache-2.0 |
| [wink-nlp](https://github.com/winkjs/wink-nlp) | Morphologische Analyse des Englischen | MIT |
| [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model) | Englisches Modell für wink-nlp | MIT |
| [Phosphor Icons](https://phosphoricons.com) | Symbole | MIT |
| [Nunito](https://fonts.google.com/specimen/Nunito) und [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) | Schrift | OFL-1.1 |

Der Code dieses Repositorys enthält keine Binärdateien von Dritten: Sie stammen bei der Installation von npm. Der Ordner `dist` und die kompilierten Pakete jeder Version enthalten `@ffmpeg/core`, `lamejs` und eSpeak NG und führen in ihrem Ordner `licencias` die Texte und Hinweise aller Komponenten.

Der zugehörige Quellcode befindet sich unter [ffmpeg.wasm v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10), das [FFmpeg n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4) mit seinen Bibliotheken kompiliert, und unter [lamejs](https://github.com/gideonstele/lamejs). Wer diese Pakete weiterverbreitet, muss GPL und LGPL einhalten, einschließlich des Angebots dieses Quellcodes.

## Bei der Nutzung heruntergeladene Daten

Keine dieser Daten gehört zum Repository. Die Erweiterung lädt sie bei Bedarf herunter.

| Daten | Herkunft | Bedingungen |
|---|---|---|
| JMdict, JMnedict und KANJIDIC | [EDRDG](https://www.edrdg.org/edrdg/licence.html), im Format von [jmdict-yomitan](https://github.com/yomidevs/jmdict-yomitan) | CC BY-SA 4.0 |
| Tonhöhenakzent und Kanji-Wörterbuch | [Kanjium](https://github.com/mifunetoshiro/kanjium) von Uros O.: Die Akzentnotation, die lautgebenden Bestandteile, die Homonyme und die übrigen Ergänzungen und Änderungen an EDICT, KANJIDIC und KRADFILE stammen aus seiner freien Datenbank; der Rest gehört dem EDRDG. Die chinesische Lesung stammt aus CC-CEDICT, die koreanische aus libhangul (Choe Hwanjin, BSD mit 3 Klauseln) | CC BY-SA 4.0 |
| Häufigkeiten | [JPDB](https://jpdb.io), im Format von [yomitan-dictionaries](https://github.com/Kuuuube/yomitan-dictionaries) | Wie vom Projekt angegeben |
| Strichfolge | [KanjiVG](https://kanjivg.tagaini.net) von Ulrich Apel, mit den Originaldateien über jsDelivr oder, wenn es sie nicht hat, aus dem GitHub-Repository des Projekts | CC BY-SA 3.0 |
| Strichfolge des Chinesischen | [Hanzi Writer](https://github.com/chanind/hanzi-writer-data) von David Chanin, auf Grundlage von [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) von Shaunak Kishore, mit den Strichen der Arphic-Schriften; über jsDelivr oder, wenn es nicht antwortet, über unpkg | Arphic Public License |
| Hanzi-Wörterbuch | [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) von Shaunak Kishore, auf Grundlage von Unihan und CJKlib, von GitHub heruntergeladen | LGPL-3.0 |
| Audio von Wörtern | JapanesePod101 und [Lingua Libre](https://lingualibre.org) | Die jeder Quelle |
| Bilder | [Openverse](https://openverse.org) | Die Lizenz jedes Bildes |
| Wörterbücher und Aussprache des Englischen und Deutschen, und kurze Übersetzungen des Chinesischen | [Wiktionary](https://www.wiktionary.org), aufbereitet von [wiktionary-to-yomitan](https://github.com/yomidevs/wiktionary-to-yomitan) aus [kaikki.org](https://kaikki.org) und über Hugging Face bereitgestellt | CC BY-SA 4.0 |
| CC-CEDICT | [MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict), im Format von [cc-cedict-yomitan](https://github.com/MarvNC/cc-cedict-yomitan), das es täglich auf GitHub veröffentlicht | CC BY-SA 4.0 |
| Häufigkeiten des Englischen, Deutschen und Chinesischen | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) von Hermit Dave, auf Basis von OpenSubtitles | CC BY-SA 4.0 |
| Wort-Audio auf Englisch, Deutsch und Chinesisch | Wikimedia Commons und [Lingua Libre](https://lingualibre.org) | Die der jeweiligen Aufnahme |

## Externe Programme

Der lokale Helfer verwendet [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense) und [QuickJS-NG](https://github.com/quickjs-ng/quickjs) (MIT), die sein Installationsprogramm von ihren offiziellen GitHub-Seiten herunterlädt und anhand ihrer SHA-256 prüft, sowie [FFmpeg](https://ffmpeg.org) (LGPL oder GPL, je nach Kompilierung), falls es auf dem Computer installiert ist. Keines davon ist in diesem Repository oder seinen Paketen enthalten.

## Verantwortungsvolle Nutzung

Kotonoha ist ein Lernwerkzeug für den persönlichen Gebrauch.

- Es umgeht keine Kopierschutzsysteme. Es liest die Untertitel, die der Player der Sitzung des Benutzers bereits anbietet.
- Der lokale Helfer darf nur mit Inhalten verwendet werden, die der Benutzer herunterladen darf, und unter Beachtung der Bedingungen jeder Website.
- Die Nutzungsbedingungen jedes Videodienstes liegen in der Verantwortung des Benutzers.
- Untertitel und andere Werke können urheberrechtlich geschützt sein und dürfen nicht ohne Erlaubnis weiterverbreitet werden.

## Marken

YouTube, Netflix, Bilibili, Anki, Claude und Anthropic sind Marken ihrer jeweiligen Inhaber. Dieses Projekt ist unabhängig und weder mit ihnen verbunden noch von ihnen gesponsert oder unterstützt.
