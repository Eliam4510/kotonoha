<p align="right"><a href="funciones.md">Español</a> · <b>English</b> · <a href="de/features.md">Deutsch</a> · <a href="zh/features.md">简体中文</a> · <a href="ko/features.md">한국어</a> · <a href="ja/features.md">日本語</a></p>

# Features

Status of each feature in version 0.9.3, along with how it has been verified.

| Verification | Meaning |
|---|---|
| Automated | Tested end to end with Edge and the extension loaded |
| Simulator | The real code runs in full, against a fake Claude API or AnkiConnect server |
| Imitation page | Also on a page with the same player structure as Netflix or YouTube |
| Real session | Checked by hand on YouTube, with Chrome, a real session and the Claude API |
| Pending | Requires a real site session or personal credentials |

## On top of the video

| Feature | Verification |
|---|---|
| Floating bar with known words, comprehension and recommended sentences | Automated |
| The bar appears when the pointer rests at the top, stays while it is near and ignores passing movements | Automated and real session |
| Subtitles that can be dragged anywhere on the video, with magnets and without leaving it | Automated and real session |
| Line changes without flicker, and slightly smaller text for long paragraphs | Automated and real session |
| Subtitles stay with the video when the page scrolls, without jitter | Imitation page and real session |
| A line appearing under a resting pointer neither opens a card nor pauses the video | Automated |
| Subtitles with furigana, pitch accent colors and status underlines | Automated |
| Furigana, gloss and color modes: always, on hover, unknown only, never | Automated |
| Word panel: definitions, status, frequency, audio, images, examples and links | Automated |
| Stroke order of each kanji, animated and looping, with pause and step by step | Automated, with real KanjiVG data |
| The word panel opens with the dictionary, with no request to Claude | Simulator and real session |
| Meaning in this sentence, explain, break down and translate with Claude, on request | Simulator, and real session for the meaning in the sentence |
| Every answer is stored: the same word in the same sentence is never requested again | Simulator and real session |
| Free questions about a word or sentence | Simulator |
| JLPT grammar: about 100 rules confirmed by Claude, with a per-video summary | Simulator |
| Priority words: the unknown words repeated most in the video | Automated |
| Playback modes: intensive listening and reading, hybrid, single-word focus and custom | Automated |
| Veils over the subtitles | Automated |
| Speeding up or skipping scenes without dialogue | Automated |
| Subtitle navigator: filters, bookmarks, selection and line merging | Automated |
| Floating translator | Simulator |
| Keyboard shortcuts | Automated |

## Subtitles

| Feature | Verification |
|---|---|
| YouTube: tracks signed by the player | Real session. Automated tests use an imitation page, since the site does not serve subtitles to an automated browser |
| Netflix: player tracks, TTML | Imitation page. A real session is pending |
| Disney+, Crunchyroll, Viki, Bilibili, iQIYI and Prime Video, through generic detection | Pending |
| Second track in the support language | Automated |
| Translation with Claude, in batches, starting at the playback position, resumable after cancelling | Imitation page |
| Correction of automatic subtitles, with the original text available | Imitation page |
| Creating Japanese from another language | Imitation page |
| Importing SRT, VTT, ASS, SSA, TTML and DFXP, saved per title | Imitation page |
| Exporting to SRT, with synchronization applied | Imitation page |
| Japanese tracks remembered across Netflix regions | Imitation page. Real sessions must still confirm that the title identifier matches |
| Synchronization by offset or with one or two marks | Automated |

## Transcription

| Feature | Verification |
|---|---|
| Whisper on the GPU through WebGPU, for local files | Automated, with real videos |
| Real-time Whisper from tab capture | Automated, with real audio |
| Recovery of speech skipped under music | Automated, with real videos |
| Load control: rest periods, automatic intensity and pause | Automated, with smoothness measurements |
| Recovery from GPU loss | Automated, by destroying the WebGPU device |
| Local helper with yt-dlp and FFmpeg | Automated, with a local download. The real browser registration and a real YouTube download are still pending |
| Correction of the result with Claude | Simulator |
| Song lyrics placed on the transcription timing: the text comes from the lyrics and the timing from Whisper | Simulator, with real Whisper, and real session with a song |
| Haas-ja for Japanese speech, Parakeet for English speech and Whisper Turbo for songs, chosen according to the video | Automated, with the three real models on the GPU, and a real session on YouTube |
| Saved models list, with the space each one takes and per-model deletion. Loading from disk is no longer announced as a download | Automated, and with real Whisper |

## Flashcards

| Feature | Verification |
|---|---|
| One-click creation | Simulator |
| Creator with every field | Simulator |
| Sending to Anki through AnkiConnect, with a custom note type or the extension's own | Simulator |
| Sentence audio recorded from the video, to MP3, from the exact stretch and at normal speed | Automated, with real tab capture |
| Capture is per tab: no silence is recorded from another tab, and a silent recording is not stored | Automated, with real tab capture |
| Frame capture, with the video as the only thing in view | Automated, with real tab capture |
| All keyboard shortcuts, and the real capture key in notices and menus | Automated |
| Without hardware acceleration, the interface removes blur so as not to drop frames | Automated |
| Word audio: JapanesePod101 and Lingua Libre | Automated |
| Azure neural voices, with a personal key | Pending |
| Images from Openverse | Automated |
| Creating several cards from selected lines | Simulator |
| Known words from Anki decks | Simulator |
| Built-in review with FSRS | Automated |

## Application window

| Feature | Verification |
|---|---|
| Home with vocabulary and review summary | Automated |
| Claude spending: monthly total, chart by day and model, tasks and request log | Simulator |
| Dictionary with free search and conjugated forms | Automated |
| Clipboard: pasted or copied text keeps its paragraphs, line breaks, headings, lists, quotes, code, tables and bold, without the source page's furigana | Automated |
| Clipboard in a regular tab, also in split view next to the page being viewed | Automated, on Edge and Chrome |
| Following the clipboard, without the tab having focus | Automated |
| Reading assistant: TXT, HTML and SRT, with the headings, paragraphs and lists of each chapter | Automated |
| Page-based book viewer: image-based EPUB, CBZ and PDF in their own tab, with zoom, fit to width or to the page, single page, two-page spread and continuous scrolling | Automated |
| Image folders as books: each folder, or each volume inside it, comes in as a book, with the cover first, a table of contents by chapter and landscape two-page spreads on their own | Automated, and with 40 real manga volumes |
| Right-to-left reading order taken from the book itself, with the cover on its own in a two-page spread | Automated |
| Thumbnails, the book's contents, go to page, full screen and inverted colors | Automated |
| Books are stored separately and read piece by piece: a PDF of hundreds of MB is never loaded whole. The viewer remembers each book's page, view and zoom | Automated, and with a real 347 MB PDF |
| On-device text recognition (OCR) with the GPU: Book mode, with PP-OCRv5, which leaves printed furigana out and reads column by column, and Manga mode, with a bubble detector and manga-ocr, in panel order and without watermarks | Automated, and measured by hand on real pages: 2.8 % character error on 18 manga pages from five series and 0.5 % on a volume in EPUB, 1 % in a textbook and around 2 % in a scanned chemistry PDF with formulas and tables |
| PDF text: in a PDF with another OCR program's text layer, choose between that text and Kotonoha's OCR, remembered for each book | Automated, and with a real scan |
| Tapping a line on the page opens its text with furigana and words to look up, with their word panel and card creation | Automated |
| Each page is read only once and saved; its text also reaches screen readers | Automated |
| Text EPUBs in the viewer, in their own format: chapters, CSS, ruby, illustrations and vertical writing, with the page reader on top, with colours, furigana and word panels | Automated, with a vertical EPUB with ruby, CSS and an illustration |
| Nothing an EPUB contains runs or loads anything from outside: no scripts, frames, forms or on* attributes | Automated, with an EPUB full of traps |
| Contents, zoom, links between chapters, vertical or horizontal text by choice and the exact spot where each book was left | Automated |
| PDFs with text: the file’s own text is read at once, without OCR, vertical columns included, and Kangxi radicals become the kanji they stand for | Automated, with a Japanese PDF made by the browser |
| Tapping a word on the page opens its word panel directly and marks it on the page, in PDFs with text and in the OCR’s Book mode | Automated |
| Stories generated for the user's level | Simulator |
| Player for local files | Automated |
| Embedded MKV subtitles and audio track selection, with ffmpeg.wasm | Automated |
| Word explorer by status | Automated |
| Level assessment | Automated |
| Full settings and editable prompts | Automated |
| Backups of every language and the settings, in a single file | Automated |

## Web pages

| Feature | Verification |
|---|---|
| Word lookup with a click; on links and buttons, by resting the pointer on them | Automated, and on 31 real public sites |
| Status underlining and furigana, adding nothing to the page's content | Automated, and on 31 real public sites |
| Without spacing out lines, the layout does not move: neither elements nor document size | Automated, and on 31 real public sites |
| When furigana does not fit between two lines, the line spacing of that text is opened, and this can be turned off | Automated, and on Claude's chat with a real session |
| In a box with its own scroll, furigana moves with the text, with no trail, and is clipped under whatever covers the box | Automated, and on Claude's chat with a real session |
| Code boxes with Japanese | Automated, and on Claude's chat with a real session |
| Links and buttons keep working with their own click | Automated |
| Furigana on all words, on new ones, on hover or never, in kana or rōmaji | Automated |
| Changing text: live text, carousels, accordions and scrolling boxes | Automated |
| Shadow trees | Automated |
| Button at the edge of the page to adjust colors and furigana | Automated |
| Sending the selection or an image to the creator with `E` | Automated |
| Bulk marking of selected text with `Alt+K`, `Alt+U` and `Alt+I` | Automated |

## Languages and customization

| Feature | Verification |
|---|---|
| Choosing the language to study: in the welcome screen, in Settings or in the extension menu | Automated |
| Words, dictionaries, cards and settings kept apart per language | Automated |
| Interface in Spanish, English, German, Simplified Chinese, Korean and Japanese | Automated: complete tables and screenshots of each language |
| Welcome screen with language, level, dictionaries, key and card destination | Automated |
| Explanations and translations in a language other than the interface's, also Portuguese and French | Automated |
| JMdict in German, as well as Spanish and English | Automated |
| Readings in kana or rōmaji | Automated |
| Color palettes: usual, for color blindness and high contrast | Automated |
| Keyboard shortcuts of your choice, working with any keyboard layout | Automated |
| Monthly spending limit for Claude | Simulator |

## English

| Feature | Verification |
|---|---|
| English subtitles, with each word analyzed and the secondary track in the support language | Imitation page, and a real session on YouTube |
| Correction of automatic subtitles, with the missing capitals and punctuation, and creation of English from another language | Imitation page, and a real session on YouTube |
| American and British pronunciation in IPA, in the word panel and, on request, over each word | Automated, with real Wiktionary data |
| Color by stressed syllable: the first, a middle one or the last | Automated |
| Wiktionary definitions and translations in Spanish, German, Chinese, Korean and Japanese, and definitions in English | Automated, with real data |
| Frequency based on movie and series subtitles | Automated, with real data |
| Which word each form comes from: *went* is *go*, *didn't* is *do* | Automated |
| Phrasal verbs and set phrases, even when split: *picked it up* finds *pick up* | Automated |
| Grammar from A1 to C2: 51 rules, confirmed by Claude | Simulator |
| Page reader, off at the start, that leaves pages in other languages alone | Automated, and on 16 real public sites |
| Parakeet and Whisper in English, with lines split for reading | Automated, with a synthetic voice, and in a real session |
| Instructions to Claude specific to English | Simulator |
| Word audio from Wikimedia Commons and Lingua Libre | Automated |
| Azure neural voices in English | Pending |
| Level assessment and path from A1 to C2 | Automated |

## German

| Feature | Verification |
|---|---|
| German subtitles, with each word analyzed and the secondary track in the support language | Imitation page, and a real session on YouTube |
| Correction of automatic subtitles with the German instructions, which also add missing punctuation | Imitation page, and a real session on YouTube |
| Which word each form comes from, using Wiktionary's forms: *ging* is *gehen*, *Häuser* is *Haus*. Between two candidates, the more frequent one | Automated, with real data |
| Separable verbs with the particle at the end: *fängt morgen an* finds *anfangen* | Automated, with real data |
| Pronunciation in IPA, without regional variants, and color by stressed syllable | Automated, with real Wiktionary data |
| Wiktionary definitions and translations in Spanish, English, Chinese, Korean and Japanese, and definitions in German | Automated, with real data |
| Frequency from film and series subtitles | Automated, with real data |
| Grammar from A1 to C2: 24 rules, confirmed by Claude | Automated |
| Page reader, off at the start | Automated |
| Parakeet for speech and Whisper Turbo for songs | Automated, with a real recording |
| Word audio from Wikimedia Commons and Lingua Libre | Automated |

## Design principles

| Principle | How it applies |
|---|---|
| Meaning depends on the sentence | The "In this sentence" block gives the meaning in context, flags figurative or poetic use, and comes first on the card |
| Correct readings | Claude reviews the readings of each line, and any of them can be corrected by hand |
| Broad context | Claude receives 40 lines around the sentence and the translation. The full script is sent for correction, and is optional for queries |
| Nothing is paid for twice | Every answer is stored by word and sentence, and reviewed results by line text. An interrupted answer is finished and stored, and two identical queries at once share one request |
| Claude only when needed | The word panel opens with the dictionary, and the review covers the stretch about to be watched instead of the whole video |
| Start with what is on screen | Translation, correction and review order their batches by the playback position |
| The computer stays usable | Transcription rests, adapts to use and stops on repeated failures |
| Pages are not rewritten | Web underlining uses the CSS Custom Highlight API, adding nothing to the content. Only line spacing is opened where furigana does not fit |
| Local data | Everything stays in the browser, and transcription audio never leaves the computer |

## Known limitations

| Limitation | Detail |
|---|---|
| Study language | Japanese, English and German. Each new language needs its own package, in `src/lenguas` |
| English analysis | It is done by a small model that fits in the extension. In ambiguous sentences it can pick the wrong category, and with it the wrong translation under the word. The word panel still shows every definition |
| German analysis | It comes from the dictionaries' forms: without German–English, each word is its own form. Between two possible words, frequency decides, without looking at the sentence; Claude fixes what goes wrong when it reviews the line |
| German compounds | A compound noun that is not in the dictionaries is not split into its parts |
| English-English dictionary | It is large: about 110 MB to download and about 220 MB on disk. Installing and removing it takes a few minutes. It is only suggested with the interface in English |
| Interface translations | Written with AI assistance, with no native review yet. Mistakes are fixed in `idiomas/` |
| Page reader | Acts only on the main frame: it does not reach text inside an iframe. What a page draws on a canvas or in an image is not text |
| Claude prompts | The instructions remain in Spanish, also when asking for an answer in another language |
| Platforms | Desktop Chrome and Edge. The local helper is prepared for Windows |
| Images with DRM | On Netflix and other protected sites, the browser delivers the frame in black. The card carries the episode's official image, if the site offers one |
| Audio with DRM | A protected site may withhold its sound from capture. After two silent sentences in a row in a video, the line is no longer replayed to record it |
| Viewer | OCR can confuse similar characters (エ and 工, ー and 一), skip one now and then and lose the subscripts of formulas; the original image always stays in view. Book mode has been measured with horizontal text. A book with DRM does not open. Book files are not included in the backup: on another computer they have to be imported again A text EPUB is read chapter by chapter, by scrolling, not page by page; in Manga mode you tap the whole bubble, not each word. |
| Synchronization | No server: moving between computers is done with a backup |
| Background music | Whisper can miss quiet conversation under loud music |
| Song lyrics | Timing is per Whisper line, not per word. With very loud music Whisper may hear little, and then more verses get an estimated time |
