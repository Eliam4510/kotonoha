<p align="right"><a href="../funciones.md">Español</a> · <a href="../features.md">English</a> · <b>Deutsch</b> · <a href="../zh/features.md">简体中文</a> · <a href="../ko/features.md">한국어</a> · <a href="../ja/features.md">日本語</a></p>

# Funktionen

Stand jeder Funktion in Version 0.27.3 und die Art ihrer Überprüfung.

| Überprüfung | Bedeutung |
|---|---|
| Automatisch | Von Anfang bis Ende mit Edge und geladener Erweiterung getestet |
| Simulator | Der echte Code läuft vollständig, gegen einen nachgebildeten Server der Claude-API oder von AnkiConnect |
| Nachgebildete Seite | Zusätzlich auf einer Seite mit derselben Player-Struktur wie Netflix oder YouTube |
| Echte Sitzung | Von Hand auf YouTube geprüft, mit Chrome, einer echten Sitzung und der Claude-API |
| Ausstehend | Erfordert eine echte Sitzung der Website oder eigene Zugangsdaten |

## Über dem Video

| Funktion | Überprüfung |
|---|---|
| Schwebende Leiste mit bekannten Wörtern, Verständnisgrad und empfohlenen Sätzen | Automatisch |
| Die Leiste erscheint, wenn die Maus oben verweilt, bleibt, solange sie in der Nähe ist, und reagiert nicht auf bloßes Vorbeifahren | Automatisch und echte Sitzung |
| Untertitel, die sich an jede Stelle des Videos ziehen lassen, mit Magneten und ohne es zu verlassen | Automatisch und echte Sitzung |
| Zeilenwechsel ohne Flackern und etwas kleinere Schrift bei langen Absätzen | Automatisch und echte Sitzung |
| Die Untertitel folgen dem Video beim Scrollen der Seite, ohne zu zittern | Nachgebildete Seite und echte Sitzung |
| Eine Zeile, die unter einer ruhenden Maus erscheint, öffnet kein Wortfenster und hält das Video nicht an | Automatisch |
| Untertitel mit Furigana, Farbe nach Tonhöhenakzent und Unterstreichung nach Status | Automatisch |
| Modi für Furigana, Glossen und Farbe: immer, beim Überfahren, unbekannte, nie | Automatisch |
| Wortfenster: Definitionen, Status, Häufigkeit, Audio, Bilder, Beispiele und Links | Automatisch |
| Strichfolge jedes Kanji, animiert und in einer Schleife, mit Pause und Einzelschritten | Automatisch, mit echten KanjiVG-Daten |
| Kanji, die du schon kennst: neben den Strichen die bekannten oder gerade gelernten Wörter mit jedem Kanji des Worts, die bekannten zuerst | Automatisch, mit in die Datenbank gesetzten Wörtern |
| Als Bild teilen: eine Karte des Wortes (Furigana, Akzent, Bedeutung im Satz oder das Wörterbuch, der Satz mit dem hervorgehobenen Wort) oder eines Grammatikpunkts, beim Klicken in die Zwischenablage kopiert; Tinte oder Papier; Bild speichern | Automatisch, mit einem simulierten Claude, über die Zwischenablage |
| JLPT: Wortschatz (8354 Wörter), Kanji (2211) und Grammatik (501 Punkte) von N5 bis N1 mit dem, was du von jeder Stufe kennst; Status einzeln oder für alle ausgewählten ändern; Kanji-Karte mit Strichen und Wörtern der Stufe; Beispiele jedes Grammatikpunkts aus gesehenen Sätzen und seine Erklärung durch Claude | Automatisch, mit einem simulierten Claude |
| Wörterbuch: Suche nach Bedeutung unter gebräuchlichen Wörtern mit passender Glosse; JLPT-Grammatik nach Form oder Bedeutung; unter jedem Wort seine Kanji mit Stufe, gebräuchliche Wörter gleicher Bedeutung, Homophone und ähnliche Wörter (Claude); sieben Kategorien zum Erkunden nach den JMdict-Kennzeichnungen | Automatisch, mit den Wörterbüchern des Testprofils und einem simulierten Claude |
| Grammatik mit Status: neu, im Lernen oder gelernt in der Videoblase, im Wortfenster, in der JLPT-Ansicht und im Wörterbuch; Gelerntes wird unter Untertiteln nicht markiert; wo jeder Punkt gesehen wurde; Multiple-Choice-Karte mit Ablenkern von Claude; Import aus Anki gegen die 501 Listenpunkte | Automatisch (Status, Filter, Speichern und Zurücksetzen in der JLPT-Ansicht); der Import mit Unit-Tests |
| Diktat-Modus: Zeile ausgeblendet, Pause am Ende, Gehörtes schreiben und vergleichen (im Japanischen nach der Lesung, mit den anderen Wörterbuchlesungen); Noch einmal hören, Weiter mit Enter; Mit deiner Stimme nachsprechen (Schaltfläche und Taste P) öffnet die Akzentübung mit der Zeile | Automatisch, auf der Testvideoseite |
| Wie es wirklich klingt (Englisch): der Satz mit der gesprochenen Form darüber, mit Verkürzungen, schwachen Formen, Bindungen, t oder d mit you und dem weichen amerikanischen t, samt Legende; nach Regeln, ohne Claude | Automatisch, mit Unit-Tests der Regeln |
| Das Wortfenster öffnet sich mit dem Wörterbuch, ohne Anfrage an Claude | Simulator und echte Sitzung |
| Bedeutung in diesem Satz, Erklären, Analysieren und Übersetzen mit Claude, auf Wunsch | Simulator, und echte Sitzung für die Bedeutung im Satz |
| Jede Antwort wird gespeichert: Dasselbe Wort im selben Satz wird nicht erneut angefragt | Simulator und echte Sitzung |
| Freie Fragen zu einem Wort oder Satz | Simulator |
| JLPT-Grammatik: rund 100 von Claude bestätigte Regeln, mit einer Übersicht pro Video | Simulator |
| Vorrangige Wörter: die unbekannten, die sich im Video am häufigsten wiederholen | Automatisch |
| Wiedergabemodi: intensives Hören und Lesen, Hybrid, Fokus auf ein Wort und benutzerdefiniert | Automatisch |
| Schleier über den Untertiteln | Automatisch |
| Beschleunigen oder Überspringen von Szenen ohne Dialog | Automatisch |
| Untertitel-Navigator: Filter, Markierungen, Auswahl und Zusammenführen von Zeilen | Automatisch |
| Schwebender Übersetzer | Simulator |
| Tastenkürzel | Automatisch |

## Untertitel

| Funktion | Überprüfung |
|---|---|
| YouTube: vom Player signierte Spuren | Echte Sitzung. Die automatischen Tests nutzen eine nachgebildete Seite, weil die Website einem automatisierten Browser keine Untertitel liefert |
| Netflix: Spuren des Players, TTML | Nachgebildete Seite. Eine echte Sitzung steht aus |
| Disney+, Crunchyroll, Viki, Bilibili, iQIYI und Prime Video über die generische Erkennung | Ausstehend |
| Zweite Spur in der Hilfssprache | Automatisch |
| Übersetzung mit Claude in Abschnitten, beginnend an der Abspielposition, mit Fortsetzung nach einem Abbruch | Nachgebildete Seite |
| Korrektur automatischer Untertitel, mit einsehbarem Originaltext | Nachgebildete Seite |
| Erstellen von Japanisch aus einer anderen Sprache | Nachgebildete Seite |
| Import von SRT, VTT, ASS, SSA, TTML und DFXP, gespeichert pro Titel | Nachgebildete Seite |
| Export als SRT, mit angewendeter Synchronisierung | Nachgebildete Seite |
| Gemerkte japanische Spuren über Netflix-Regionen hinweg | Nachgebildete Seite. Mit echten Sitzungen ist noch zu bestätigen, dass die Titelkennung übereinstimmt |
| Synchronisierung über Versatz oder mit einer oder zwei Markierungen | Automatisch |

## Transkription

| Funktion | Überprüfung |
|---|---|
| Whisper auf der GPU mit WebGPU, für eigene Dateien | Automatisch, mit echten Videos |
| Whisper in Echtzeit aus der Tab-Aufnahme | Automatisch, mit echtem Audio |
| Wiederherstellung von Sprache, die unter Musik ausgelassen wurde | Automatisch, mit echten Videos |
| Laststeuerung: Pausen, automatische Intensität und Anhalten | Automatisch, mit Messungen der Flüssigkeit |
| Wiederherstellung bei Verlust der GPU | Automatisch, durch Zerstören des WebGPU-Geräts |
| Lokaler Helfer in PowerShell mit yt-dlp, ohne Python, mit oder ohne FFmpeg | Automatisch: Installation ohne Registrierung, beide Umwandlungen, Abbrechen und Fehler, mit lokalem Download; echte Registrierung mit Edge und ein echter YouTube-Download mit QuickJS |
| Der Installationsbefehl des Helfers in den Einstellungen, mit der ID der Kopie und einem Link zum Download | Automatisch |
| `Instalar.cmd` per Doppelklick: findet Kotonoha in den Browsern, lädt yt-dlp und QuickJS mit geprüfter SHA-256 herunter und installiert ohne Kopie die Erweiterung mit fester Kennung | Automatisch, ohne die Registrierung zu berühren |
| **Jetzt aktualisieren**: Der Helfer legt die neue Version mit ihrer SHA-256 und demselben Schlüssel in den Ordner der Kopie, und die Erweiterung lädt sich neu | Automatisch, durchgehend mit Edge |
| Vollständige Kopie in einem Ordner: Bücher, OCR-Text und Diktate, ohne API-Schlüssel | Automatisch, hin und zurück |
| Korrektur des Ergebnisses mit Claude | Simulator |
| Liedtext auf die Zeiten der Transkription gelegt: der Text aus dem Liedtext, die Zeiten von Whisper | Simulator, mit echtem Whisper, und echte Sitzung mit einem Lied |
| Haas-ja für gesprochenes Japanisch, Parakeet für gesprochenes Englisch und Whisper Turbo für Lieder, je nach Video gewählt | Automatisch, mit den drei echten Modellen auf der GPU, und echte Sitzung auf YouTube |
| Liste der gespeicherten Modelle mit dem Platzbedarf jedes Modells und Löschen pro Modell. Das Laden von der Festplatte wird nicht mehr als Download angezeigt | Automatisch und mit echtem Whisper |

## Karten

| Funktion | Überprüfung |
|---|---|
| Erstellen mit einem Klick | Simulator |
| Karten-Ersteller mit allen Feldern | Simulator |
| Senden an Anki über AnkiConnect, mit eigenem Notiztyp oder dem der Erweiterung | Simulator |
| Aus dem Video aufgenommenes Satz-Audio als MP3, im genauen Abschnitt und in normaler Geschwindigkeit | Automatisch, mit echter Tab-Aufnahme |
| Die Aufnahme gilt pro Tab: Aus einem anderen wird keine Stille aufgenommen, und eine stumme Aufnahme wird nicht gespeichert | Automatisch, mit echter Tab-Aufnahme |
| Aufnahme des Einzelbilds, mit dem Video als einzigem sichtbaren Inhalt | Automatisch, mit echter Tab-Aufnahme |
| Alle Tastenkürzel und die tatsächliche Aufnahme-Taste in Hinweisen und Menüs | Automatisch |
| Ohne Hardwarebeschleunigung verzichtet die Oberfläche auf Unschärfe, um keine Bilder zu verlieren | Automatisch |
| Audio des Wortes: JapanesePod101 und Lingua Libre | Automatisch |
| Neuronale Azure-Stimmen mit eigenem Schlüssel | Ausstehend |
| Stimme des Browsers ohne Azure-Schlüssel: die beste, die er anbietet („Natural“ in Edge, Google in Chrome), oder eine andere aus den Einstellungen, je Sprache | Automatisch |
| Lokale japanische Stimme mit AivisSpeech oder VOICEVOX: wird automatisch gefunden, Stimme und Stil wählbar, liest mit dem Akzent aus dem Wörterbuch und speichert die Audios zwischen; für Vorlesen, Übung, Wortkarte und Karten | Automatisch, mit einer simulierten Engine und mit AivisSpeech 1.2.0 auf dem Rechner: stimmt in 37 von 37 Akzentphrasen mit dem Wörterbuch überein und liest einen Satz in 0,6 s auf der CPU |
| Bilder von Openverse | Automatisch |
| Erstellen mehrerer Karten aus ausgewählten Zeilen | Simulator |
| Bekannte Wörter aus Anki-Stapeln | Simulator |
| Eingebaute Wiederholung mit FSRS | Automatisch |

## Anwendungsfenster

| Funktion | Überprüfung |
|---|---|
| Startseite mit Übersicht über Wortschatz und Wiederholung | Automatisch |
| Kosten für Claude: Monatssumme, Diagramm nach Tagen und Modellen, Aufgaben und Anfrageprotokoll | Simulator |
| Wörterbuch mit freier Suche und konjugierten Formen | Automatisch |
| Notizbuch: Eingefügter oder kopierter Text behält Absätze, Zeilenumbrüche, Überschriften, Listen, Zitate, Code, Tabellen und Fettdruck, ohne die Furigana der Ursprungsseite | Automatisch |
| Notizbuch in einem normalen Tab, auch in geteilter Ansicht neben der angezeigten Seite | Automatisch, in Edge und Chrome |
| Zwischenablage folgen, ohne dass der Tab den Fokus hat | Automatisch |
| Diktieren ins Notizbuch: das Mikrofon, Zeit und Pegel während der Aufnahme und der Text am Ende, schon analysiert, auf dem Rechner mit dem Sprachmodell aus den Einstellungen transkribiert | Automatisch, mit synthetischen Stimmen auf Japanisch und Englisch |
| Notizbuch: ein Editor über die ganze Breite mit Überschriften, Listen mit Unterpunkten, Zitaten, Code und Fettdruck, mit Schaltflächen und Kürzeln (# , - , ・ , 1. , > , Tab, Strg+B); Bearbeiten und Lesen auf derselben Seite; Eingefügtes behält seine Struktur; speichert von selbst und auf Wunsch in der Bibliothek, und ein Text der Bibliothek lässt sich wieder bearbeiten | Automatisch: Schreiben mit Kürzeln und Schaltflächen, Lesen, Speichern in der Bibliothek und erneutes Öffnen von dort |
| Ordnen: Claude gibt einem am Stück eingefügten Text Titel, Zwischenüberschriften, Absätze und Listen; es warnt, wenn sich ein Wort geändert hat, und Strg+Z macht es rückgängig | Automatisch, mit einem simulierten Claude |
| Vorlesen mit Geschwindigkeit (0,6× bis 1,2×) und Modus (am Stück, Satz für Satz oder den Satz wiederholend); jeden markierten Teil anhören oder üben, ohne seine Furigana | Automatisch |
| Die Sprachmodelle laden während der Aufnahme (Diktat und Übung): Die zweite Aufnahme der Übung wird in 0,2 s analysiert, und das Diktat eine Sekunde nach dem Ende transkribiert | Automatisch, auf der GPU des Entwicklungsrechners |
| Die Aufnahme jedes Diktats über ihrem Absatz, zum erneuten Anhören; sie geht mit dem Text in die Bibliothek, und eine, die kein Text nutzt, wird nach einer Woche gelöscht | Automatisch |
| Tonhöhenakzent üben im Notizbuch, den Texten der Lesehilfe und der Textansicht: der Akzent jedes Worts gezeichnet, die Aufnahme, die Tonhöhenkurve über dem erwarteten Akzent, eine Bewertung pro Wort und lange Pausen | Automatisch, mit einer synthetischen Stimme |
| Die Tonhöhe der Stimme im Browser gemessen (YIN), die Moren anhand der Stimme und der Transkription verortet und wo die Tonhöhe in jedem Wort fällt, auch bei verzögertem Gipfel und entstimmten Moren | Automatisch; abgestimmt mit Minimalpaaren (箸, 橋 und 端; 雨 und 飴), gelesen von einer synthetischen Stimme, und mit einer echten Aufnahme |
| Besondere Moren in der Übung, mit narabas: ein fehlendes oder überzähliges っ, ん oder langer Vokal, mit markierter Mora; der Download des Modells mit seiner SHA-256 geprüft, die GPU nur, wenn sie wie der Prozessor rechnet, und keine Bewertung für ein っ vor einem Reibelaut, für anders gesprochene Phrasen oder für Zögerer am Wortende | Automatisch, mit einer synthetischen Stimme; gemessen mit Minimalpaaren (おばあさん und おばさん, きって und きて…), gesprochen von zwei synthetischen Stimmen: 17 von 22 fehlenden Moren und 10 von 10 überzähligen, ohne Hinweise bei 22 von 24 richtig gesprochenen Sätzen |
| Lesehilfe: TXT, HTML und SRT, mit den Überschriften, Absätzen und Listen jedes Kapitels | Automatisch |
| Betrachter für Seitenbücher: EPUB aus Bildern, CBZ und PDF in einem eigenen Tab, mit Zoom, Anpassung an Breite oder Seite, Einzelseite, Doppelseite und fortlaufendem Bildlauf | Automatisch |
| Bilderordner als Bücher: Jeder Ordner, oder jeder Band darin, wird ein Buch, mit der Titelseite vorn, einem Inhaltsverzeichnis nach Kapiteln und querformatigen Doppelseiten für sich | Automatisch, und mit 40 echten Manga-Bänden |
| Sammlungen im Regal: eine Reihe mit ihren Bänden oder ein Thema, mit Art, Beschreibung und Titelbild; ein Ordner mit mehreren Bänden kommt als Sammlung herein, und ein neuer Band kommt in seine | Automatisch |
| Lesefortschritt: wie viel von jedem Buch und jeder Sammlung gelesen ist, „Gelesen“ am Ende oder von Hand, „Weiterlesen“ und Filter nach Stand | Automatisch |
| Titelbilder: PDFs haben ihres schon beim Import; das jedes Buchs wird aus einer Seite im Betrachter oder einem Bild gewählt, das jeder Sammlung aus den Titelbildern ihrer Bücher oder einem Bild | Automatisch |
| Leserichtung von rechts nach links aus dem Buch selbst, mit allein stehender Titelseite in der Doppelseite | Automatisch |
| Miniaturansichten, Inhaltsverzeichnis des Buchs, Sprung zu einer Seite, Vollbild und umgekehrte Farben | Automatisch |
| Bücher werden getrennt gespeichert und stückweise gelesen: Ein PDF mit Hunderten MB wird nie ganz geladen. Der Betrachter merkt sich Seite, Ansicht und Zoom jedes Buchs | Automatisch, und mit einem echten PDF von 347 MB |
| Texterkennung (OCR) auf dem eigenen Computer mit der GPU: Modus Buch mit dem Detektor von PP-OCRv5 und der Erkennung von PP-OCRv6, der gedruckte Furigana weglässt und Spalte für Spalte liest, und Modus Manga mit einem Sprechblasen-Detektor und manga-ocr, in der Reihenfolge der Panels und ohne Wasserzeichen | Automatisch, und von Hand an echten Seiten gemessen: 2,8 % Zeichenfehler auf 18 Mangaseiten aus fünf Reihen und 0,5 % in einem Band als EPUB, 2,2 % in einem Lehrbuch und in gescannten Chemie-PDFs mit Formeln und Tabellen 0,2 % bei 180 ppi und 1,2 % bei 144 ppi, wobei das gescannte Bild unverändert gelesen wird |
| PDF-Text: In einem PDF mit der Textebene eines anderen Texterkennungsprogramms zwischen diesem Text und der Texterkennung von Kotonoha wählen, für jedes Buch gespeichert | Automatisch, und mit einem echten Scan |
| Die Texterkennung liest voraus: die nächsten Seiten (acht bei einem Manga, vier bei einem Buch), bevor man sie erreicht, und lässt übersprungene liegen | Automatisch |
| Verarbeiten: ein ganzes Buch von seiner Karte aus mit der Texterkennung lesen, mit Fortschritt, Pause und „Text bereit“ am Ende | Automatisch, und mit einem echten Band |
| Den Text einer Zeile von Hand bearbeiten, getrennt vom Gelesenen gespeichert und mit „Wiederherstellen“ | Automatisch |
| Notizen und Lesezeichen wie in einem PDF-Reader: Seiten markieren, eine Zeile, ein Wort oder einen Abschnitt in vier Farben hervorheben oder unterstreichen, mit Kommentar, und Notizen auf der Seite; im Fenster „Notizen und Lesezeichen“ alles nach Seiten, zum Hinspringen, Bearbeiten, Entfernen oder Kopieren als Text | Automatisch |
| Im Buch suchen: im PDF-Text und im Text der Texterkennung, mit Bearbeitungen, ohne Unterschied bei Zeichenbreite sowie zwischen Hiragana und Katakana, auch ein über zwei Zeilen geteiltes Wort; Ergebnisse nach Seiten und auf der Seite markiert | Automatisch |
| Textansicht: die Seite als Text, in Absätzen und mit abgesetzten Überschriften, mit der Lesehilfe des Notizbuchs (Furigana, Verständnis, Vorlesen, Wortfenster und Karten); jedes Buch merkt sie sich | Automatisch, und die Absätze mit 16 echten Seiten |
| Den Text einer Seite mit Claude prüfen, anhand ihres Bildes: nur die Änderungen, die nicht übereinstimmen, Buchstabe für Buchstabe, zur Auswahl, gespeichert als bearbeitete Zeilen | Simulator |
| Ein Tippen auf eine Zeile der Seite öffnet ihren Text mit Furigana und nachschlagbaren Wörtern, samt Wortfenster und Kartenerstellung | Automatisch |
| Jede Seite wird nur einmal gelesen und gespeichert; ihr Text erreicht auch Bildschirmleser | Automatisch |
| Text-EPUBs im Betrachter in ihrem eigenen Format: Kapitel, CSS, Ruby, Illustrationen und vertikale Schrift, mit dem Seiten-Reader darüber, mit Farben, Furigana und Wortfenstern | Automatisch, mit einem vertikalen EPUB mit Ruby, CSS und Illustration |
| Was ein EPUB enthält, wird nicht ausgeführt und lädt nichts von außen: keine Skripte, Frames, Formulare oder on*-Attribute | Automatisch, mit einem EPUB voller Fallen |
| Inhaltsverzeichnis, Zoom, Links zwischen Kapiteln, wahlweise vertikaler oder horizontaler Text und die genaue Stelle, an der jedes Buch verlassen wurde | Automatisch |
| PDFs mit Text: Der eigene Text der Datei wird sofort gelesen, ohne OCR, auch in vertikalen Spalten, und Kangxi-Radikale werden zu den Kanji, für die sie stehen | Automatisch, mit einem vom Browser erzeugten japanischen PDF |
| Ein Tippen auf ein Wort der Seite öffnet sein Wortfenster direkt und markiert es auf der Seite, in PDFs mit Text und im Modus Buch der Texterkennung | Automatisch |
| Nach Niveau erzeugte Geschichten | Simulator |
| Player für eigene Dateien | Automatisch |
| In MKV eingebettete Untertitel und Wahl der Audiospur, mit ffmpeg.wasm | Automatisch |
| Wortübersicht nach Status | Automatisch |
| Immersionsstunden: die Zeit mit einem laufenden Video und Untertiteln in der Lernsprache, mit einem Buch im Viewer und beim Lesen im Notizbuch oder in der Bibliothek; auf Start heute, die letzten sieben Tage, insgesamt, die Serie, ein Balken pro Tag und das am meisten Gesehene und Gelesene | Automatisch: ein eigenes Video, das wirklich läuft, und frühere Tage in der Datenbank |
| Niveaubewertung | Automatisch |
| Vollständige Einstellungen und bearbeitbare Prompts | Automatisch |
| Sicherung aller Sprachen und der Einstellungen in einer einzigen Datei | Automatisch |

## Webseiten

| Funktion | Überprüfung |
|---|---|
| Nachschlagen eines Wortes mit einem Klick; bei Links und Schaltflächen durch Verweilen mit der Maus | Automatisch, und auf 31 echten öffentlichen Websites |
| Unterstreichung nach Status und Furigana, ohne dem Inhalt der Seite etwas hinzuzufügen | Automatisch, und auf 31 echten öffentlichen Websites |
| Ohne Auseinanderziehen der Zeilen bewegt sich das Layout nicht: weder Elemente noch die Maße des Dokuments | Automatisch, und auf 31 echten öffentlichen Websites |
| Passen Furigana nicht zwischen zwei Zeilen, wird der Zeilenabstand dieses Textes geöffnet; das lässt sich abschalten | Automatisch, und im Chat von Claude mit einer echten Sitzung |
| In einer Box mit eigenem Scrollen bewegen sich die Furigana mit dem Text, ohne Nachzieheffekt, und werden unter dem abgeschnitten, was die Box verdeckt | Automatisch, und im Chat von Claude mit einer echten Sitzung |
| Codeblöcke mit Japanisch | Automatisch, und im Chat von Claude mit einer echten Sitzung |
| Links und Schaltflächen funktionieren weiterhin mit ihrem eigenen Klick | Automatisch |
| Furigana bei allen Wörtern, bei neuen, beim Überfahren oder nie, in Kana oder Rōmaji | Automatisch |
| Sich ändernder Text: live eintreffender Text, Karussells, Akkordeons und scrollbare Boxen | Automatisch |
| Shadow Trees | Automatisch |
| Schaltfläche am Seitenrand zum Anpassen von Farben und Furigana | Automatisch |
| Senden der Auswahl oder eines Bildes an den Karten-Ersteller mit `E` | Automatisch |
| Gesammeltes Markieren des ausgewählten Textes mit `Alt+K`, `Alt+U` und `Alt+I` | Automatisch |

## Sprachen und Anpassung

| Funktion | Überprüfung |
|---|---|
| Die Lernsprache wählen: auf der Startseite und in der Seitenleiste, mit ihrer Flagge, in der Begrüßung, in den Einstellungen oder im Menü der Erweiterung | Automatisch |
| Wörter, Wörterbücher, Karten und Einstellungen je Sprache getrennt | Automatisch |
| Hinweis auf eine neue Version von GitHub, einmal am Tag, auf der Startseite und im Menü der Erweiterung; je Version schließbar und unter Einstellungen, Version abschaltbar | Automatisch, mit simuliertem GitHub |
| Oberfläche auf Spanisch, Englisch, Deutsch, vereinfachtem Chinesisch, Koreanisch und Japanisch | Automatisch: vollständige Tabellen und Screenshots jeder Sprache |
| Begrüßung mit Sprache, Niveau, Wörterbüchern, Schlüssel und Ziel der Karten | Automatisch |
| Erklärungen und Übersetzungen in einer anderen Sprache als die Oberfläche, auch Portugiesisch und Französisch | Automatisch |
| JMdict auf Deutsch, zusätzlich zu Spanisch und Englisch | Automatisch |
| Lesungen in Kana oder Rōmaji | Automatisch |
| Farbpaletten: üblich, für Farbenblindheit und mit hohem Kontrast | Automatisch |
| Frei wählbare Tastenkürzel, die mit jeder Tastaturbelegung funktionieren | Automatisch |
| Monatliches Kostenlimit für Claude | Simulator |
| Andere KI-Anbieter mit der OpenAI-API (OpenRouter, DeepSeek, OpenAI, LM Studio, Ollama): ihre Modelle pro Aufgabe, der Schlüssel getrennt gespeichert, gestreamte Antworten, JSON-Schema oder JSON-Modus, weniger Tokens, wenn sie nicht so viele erlauben, und Ausgaben mit den gemeldeten Kosten | Simulierter Anbieter, der sich wie DeepSeek verhält |

## Englisch

| Funktion | Überprüfung |
|---|---|
| Englische Untertitel, mit jedem analysierten Wort und der Zweitspur in der Hilfssprache | Nachgeahmte Seite und echte Sitzung auf YouTube |
| Korrektur automatischer Untertitel mit den fehlenden Großbuchstaben und Satzzeichen, und Erstellen von Englisch aus einer anderen Sprache | Nachgeahmte Seite und echte Sitzung auf YouTube |
| Amerikanische und britische Aussprache in IPA, im Wortfenster und auf Wunsch über jedem Wort | Automatisch, mit echten Daten aus Wiktionary |
| Farbe nach betonter Silbe: die erste, eine mittlere oder die letzte | Automatisch |
| Definitionen und Übersetzungen aus Wiktionary auf Spanisch, Deutsch, Chinesisch, Koreanisch und Japanisch, dazu Definitionen auf Englisch | Automatisch, mit echten Daten |
| Häufigkeit nach Untertiteln von Filmen und Serien | Automatisch, mit echten Daten |
| Von welchem Wort jede Form stammt: *went* ist *go*, *didn't* ist *do* | Automatisch |
| Partikelverben und feste Wendungen, auch getrennt: *picked it up* findet *pick up* | Automatisch |
| Grammatik von A1 bis C2: 51 Regeln, von Claude bestätigt | Simulator |
| Seiten-Reader, anfangs ausgeschaltet, der Seiten in anderen Sprachen in Ruhe lässt | Automatisch und auf 16 echten öffentlichen Websites |
| Parakeet und Whisper auf Englisch, mit lesbar getrennten Zeilen | Automatisch, mit einer synthetischen Stimme, und in einer echten Sitzung |
| Comics im **Comic**-Modus des Betrachters: jede Sprechblase mit der Bucherkennung, nach Panels von links nach rechts | Automatisch: 0,4 % Zeichenfehler auf Testseiten und 12 % auf einer echten, handgeletterten Seite von 1922 |
| Buch-OCR auf Englisch | Gemessen: 1,5 % Zeichenfehler bei einem echten Scan aus dem 19. Jahrhundert, fast alles in der Kopfzeile |
| Neuronale Stimme im Browser: Kokoro, mit sechs Stimmen | Automatisch; Whisper Turbo versteht ihre Sätze fehlerfrei |
| Eigene Anweisungen an Claude für Englisch | Simulator |
| Wort-Audio von Wikimedia Commons und Lingua Libre | Automatisch |
| Neuronale Azure-Stimmen auf Englisch | Ausstehend |
| Niveautest und Weg von A1 bis C2 | Automatisch |

## Deutsch

| Funktion | Überprüfung |
|---|---|
| Deutsche Untertitel, mit jedem analysierten Wort und der Zweitspur in der Hilfssprache | Nachgeahmte Seite und echte Sitzung auf YouTube |
| Korrektur automatischer Untertitel mit den Anweisungen für Deutsch, die auch fehlende Satzzeichen ergänzen | Nachgeahmte Seite und echte Sitzung auf YouTube |
| Von welchem Wort jede Form stammt, mit den Formen aus Wiktionary: *ging* ist *gehen*, *Häuser* ist *Haus*. Bei zwei Möglichkeiten das häufigere | Automatisch, mit echten Daten |
| Trennbare Verben mit der Partikel am Ende: *fängt morgen an* findet *anfangen* | Automatisch, mit echten Daten |
| Aussprache in IPA, ohne regionale Varianten, und Farbe nach betonter Silbe | Automatisch, mit echten Daten aus Wiktionary |
| Definitionen und Übersetzungen aus Wiktionary auf Spanisch, Englisch, Chinesisch, Koreanisch und Japanisch, und Definitionen auf Deutsch | Automatisch, mit echten Daten |
| Häufigkeit nach Film- und Serienuntertiteln | Automatisch, mit echten Daten |
| Grammatik von A1 bis C2: 24 Regeln, von Claude bestätigt | Automatisch |
| Seiten-Reader, anfangs ausgeschaltet | Automatisch |
| Parakeet für Sprache und Whisper Turbo für Lieder | Automatisch, mit einer echten Aufnahme |
| Comics im **Comic**-Modus, mit ä, ö, ü und ß | Automatisch: 0,4 % Fehler auf Testseiten |
| Buch-OCR auf Deutsch, in moderner Schrift; Fraktur wird nicht gelesen | Gemessen: 0,03 % Fehler auf Testseiten in vier Schriften und 75 % auf einer Fraktur-Seite von 1919 |
| Neuronale Stimme im Browser: Piper, mit der Stimme von Thorsten | Automatisch; Whisper Turbo versteht ihre Sätze fehlerfrei |
| Wort-Audio von Wikimedia Commons und Lingua Libre | Automatisch |

## Gestaltungsgrundsätze

| Grundsatz | Umsetzung |
|---|---|
| Der Sinn hängt vom Satz ab | Der Block „In diesem Satz“ gibt den Sinn im Kontext an, weist auf übertragenen oder poetischen Gebrauch hin und steht auf der Karte an erster Stelle |
| Richtige Lesungen | Claude prüft die Lesungen jeder Zeile, und eine Lesung lässt sich von Hand korrigieren |
| Großer Kontext | Claude erhält 40 Zeilen rund um den Satz und die Übersetzung. Das vollständige Skript wird beim Korrigieren gesendet und ist bei Anfragen optional |
| Nichts wird zweimal bezahlt | Jede Antwort wird pro Wort und Satz gespeichert, Geprüftes pro Zeilentext. Eine unterbrochene Antwort wird zu Ende geführt und gespeichert, und zwei gleiche Anfragen zur selben Zeit teilen sich eine Anfrage |
| Claude nur, wenn nötig | Das Wortfenster öffnet sich mit dem Wörterbuch, und die Prüfung deckt den kommenden Abschnitt ab statt des ganzen Videos |
| Zuerst das, was läuft | Übersetzung, Korrektur und Prüfung ordnen die Abschnitte nach der Abspielposition |
| Der Computer bleibt benutzbar | Die Transkription legt Pausen ein, passt sich der Nutzung an und hält bei wiederholten Ausfällen an |
| Seiten werden nicht umgeschrieben | Die Unterstreichung im Web verwendet die CSS Custom Highlight API, ohne dem Inhalt etwas hinzuzufügen. Nur der Zeilenabstand wird geöffnet, wo Furigana nicht passen |
| Lokale Daten | Alles bleibt im Browser, und das Audio der Transkription verlässt den Computer nicht |

## Bekannte Einschränkungen

| Einschränkung | Einzelheit |
|---|---|
| Lernsprache | Japanisch, Englisch und Deutsch. Jede neue Sprache braucht ihr eigenes Paket in `src/lenguas` |
| Analyse des Englischen | Sie erfolgt mit einem kleinen Modell, das in die Erweiterung passt. In mehrdeutigen Sätzen kann es die Wortart falsch bestimmen und damit auch die Übersetzung unter dem Wort. Das Wortfenster zeigt weiterhin alle Definitionen |
| Analyse des Deutschen | Sie stammt aus den Formen der Wörterbücher: Ohne Deutsch–Englisch ist jedes Wort seine eigene Form. Zwischen zwei möglichen Wörtern entscheidet die Häufigkeit, ohne auf den Satz zu achten; Claude korrigiert Fehler, wenn es die Zeile prüft |
| Deutsche Komposita | Ein zusammengesetztes Nomen, das nicht in den Wörterbüchern steht, wird nicht in seine Teile zerlegt |
| Englisch-Englisch-Wörterbuch | Es ist groß: etwa 110 MB Download und etwa 220 MB Speicherplatz. Installieren und Entfernen dauern einige Minuten. Es wird nur bei englischer Oberfläche vorgeschlagen |
| Übersetzungen der Oberfläche | Mit KI-Unterstützung geschrieben, noch ohne Prüfung durch Muttersprachler. Fehler werden in `idiomas/` korrigiert |
| Seiten-Reader | Wirkt nur im Hauptframe: Text in einem iframe erreicht er nicht. Was eine Seite auf eine Leinwand oder in ein Bild zeichnet, ist kein Text |
| Claude-Prompts | Die Anweisungen bleiben auf Spanisch, auch wenn die Antwort in einer anderen Sprache angefordert wird |
| Plattformen | Chrome und Edge auf dem Desktop. Der lokale Helfer ist für Windows vorbereitet |
| Bild mit DRM | Bei Netflix und anderen geschützten Websites liefert der Browser das Einzelbild schwarz. Die Karte erhält das offizielle Bild der Folge, falls die Website eines anbietet |
| Audio mit DRM | Eine geschützte Website kann ihren Ton der Aufnahme vorenthalten. Nach zwei stummen Sätzen in Folge in einem Video wird die Zeile nicht mehr zur Aufnahme erneut abgespielt |
| Betrachter | Die Texterkennung kann ähnliche Zeichen verwechseln (エ und 工, ー und 一), gelegentlich eines auslassen und die Indizes von Formeln verlieren; das Originalbild bleibt immer sichtbar. Der Modus Buch ist mit horizontalem Text gemessen. Ein Buch mit DRM öffnet sich nicht. Die Buchdateien sind nicht Teil der Sicherung in einer Datei, wohl aber der vollständigen Kopie. Ein Text-EPUB wird kapitelweise mit Scrollen gelesen, nicht seitenweise; im Modus Manga wird die ganze Sprechblase angetippt, nicht jedes Wort. |
| Synchronisierung | Ohne Server: Die Übertragung zwischen Computern erfolgt über die vollständige Kopie |
| Hintergrundmusik | Whisper kann leise Gespräche unter lauter Musik verlieren |
| Liedtexte | Die Zeiten gelten je Whisper-Zeile, nicht je Wort. Bei sehr lauter Musik hört Whisper womöglich wenig, und dann erhalten mehr Verse eine geschätzte Zeit |
