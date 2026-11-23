<p align="right"><a href="../funciones.md">Español</a> · <a href="../features.md">English</a> · <b>Deutsch</b> · <a href="../zh/features.md">简体中文</a> · <a href="../ko/features.md">한국어</a> · <a href="../ja/features.md">日本語</a></p>

# Funktionen

Stand jeder Funktion in Version 0.50.0 und die Art ihrer Überprüfung.

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
| In einem Fenster erscheint sie auch, wenn die Maus am oberen Rand des Videos verweilt, unter der Kopfzeile der Seite (wie der von YouTube), aber nicht mitten in dieser Kopfzeile, wo ihr Suchfeld ist | Automatisch |
| Wer Größe, Hintergrund oder Lesungen ändert, während ein Bereich über den Untertiteln offen ist, sieht die Änderung sofort: Der Bereich tritt kurz zur Seite, nur die benutzte Zeile bleibt sichtbar | Automatisch |
| Die Schrift der Sprache (Grotesk, abgerundet, Buchschrift oder Handschrift) gilt auch für die Untertitel und die Wortfenster über dem Video: Sie wird in den Einstellungen oder neben der Größe im Untertitelbereich gewählt und ändert sich sofort; bei allen berührt die Lesung das Wort von 70 bis 250 % nicht | Automatisch |
| Untertitel, die sich an jede Stelle des Videos ziehen lassen, mit Magneten und ohne es zu verlassen | Automatisch und echte Sitzung |
| Zeilenwechsel ohne Flackern und etwas kleinere Schrift bei langen Absätzen | Automatisch und echte Sitzung |
| Die Untertitel folgen dem Video beim Scrollen der Seite, ohne zu zittern | Nachgebildete Seite und echte Sitzung |
| Eine Zeile, die unter einer ruhenden Maus erscheint, öffnet kein Wortfenster und hält das Video nicht an | Automatisch |
| Untertitel mit Furigana, Farbe nach Tonhöhenakzent und Unterstreichung nach Status | Automatisch |
| Lesungen, die IPADIC falsch liefert, korrigiert: 環 allein (かん, nicht たまき) und Kanji, die als Suffix angehängt sind, wie in 官能基, 電子殻 oder 炭素鎖 | Automatisch |
| Modi für Furigana, Glossen und Farbe: immer, beim Überfahren, unbekannte, nie | Automatisch |
| Der Untertitelkasten lässt an allen vier Seiten Luft und nichts überlappt sich, bei jeder Kombination aus Größe (70 bis 250 %), Lesungen, Glossen, Übersetzung und Hintergrund, im breiten wie im schmalen Fenster; die Übersetzung jedes unbekannten Wortes steht darunter | Automatisch |
| Wortfenster: Definitionen, Status, Häufigkeit, Audio, Bilder, Beispiele und Links | Automatisch |
| Strichfolge jedes Kanji, animiert und in einer Schleife, mit Pause und Einzelschritten | Automatisch, mit echten KanjiVG-Daten |
| Kanji, die du schon kennst: neben den Strichen die bekannten oder gerade gelernten Wörter mit jedem Kanji des Worts, die bekannten zuerst | Automatisch, mit in die Datenbank gesetzten Wörtern |
| Als Bild teilen: eine Karte des Wortes (Furigana, Akzent, Bedeutung im Satz oder das Wörterbuch, der Satz mit dem hervorgehobenen Wort) oder eines Grammatikpunkts, beim Klicken in die Zwischenablage kopiert; Tinte oder Papier; Bild speichern | Automatisch, mit einem simulierten Claude, über die Zwischenablage |
| JLPT: Wortschatz (8354 Wörter), Kanji (2211) und Grammatik (501 Punkte) von N5 bis N1 mit dem, was du von jeder Stufe kennst; Status einzeln oder für alle ausgewählten ändern; Kanji-Karte mit Strichen und Wörtern der Stufe; Beispiele jedes Grammatikpunkts aus gesehenen Sätzen und seine Erklärung durch Claude | Automatisch, mit einem simulierten Claude |
| Wörterbuch: Suche nach Bedeutung unter gebräuchlichen Wörtern mit passender Glosse; JLPT-Grammatik nach Form oder Bedeutung; unter jedem Wort seine Kanji mit Stufe, gebräuchliche Wörter gleicher Bedeutung, Homophone und ähnliche Wörter (Claude); acht Kategorien zum Erkunden nach den JMdict-Kennzeichnungen | Automatisch, mit den Wörterbüchern des Testprofils und einem simulierten Claude |
| Wörterbuchseite in voller Breite: Ergebnisliste, Wort und verwandte Wörter je nach Breite in Spalten (oder eine zentrierte Spalte); Bedeutungen mit ihren Glossen zusammen und ihrer Wortart; Karten mit der Lesung darüber; Gegenteile und „Siehe auch“ aus JMdict; Größe und Schrift in den Einstellungen, mit einem Muster, das sich sofort ändert, und neben dem Suchfeld | Automatisch, mit den Wörterbüchern des Testprofils |
| Im Wörterbuch von einem Wort zum nächsten, ohne das vorige halb verschwunden oder das neue halb geladen zu sehen: Es wird vorbereitet, während das vorige sichtbar bleibt, und erscheint auf einmal, mit einem Balken, wenn es dauert | Automatisch, Bild für Bild |
| Die Sätze, in denen ein Wort vorkam, mit Lesung, dem Wort hervorgehoben auch konjugiert, der Minute im Video und „Zurück zu…“, das den Tab des Videos holt oder es öffnet und an diese Stelle springt (auch im Reiter Beispiele des Wortfensters) | Automatisch: die Adresse mit der Minute bei YouTube und der vorgemerkte Sprung auf anderen Seiten |
| Kanji-Seite: große Striche, Bedeutung, Stufe, Strichzahl, On- und Kun-Lesungen, Bestandteile aus KanjiVG mit Radikal und Lautteil, deine Wörter damit, gebräuchliche Wörter, die es enthalten, wo es vorkam, Druck-, Buch- und Handschrift und seine Herkunft mit Claude | Automatisch |
| Kanji-Wörterbuch (Kanjium und KANJIDIC, 6812 Kanji), direkt auf der Kanji-Seite installierbar: offizielle Liste, Kanken-Stufe und Rang; offizielle Lesungen, weitere Lesungen und Namenslesungen, mit der Epoche jeder On-Lesung; Radikal mit Namen, Entstehung, Lautfamilie, Kanji, die es enthalten, ähnlich aussehende, gegensätzliche, bedeutungsähnliche und gleich gelesene Kanji; alte Formen und Varianten; Bedeutungen auf Spanisch bei spanischer Oberfläche | Automatisch, mit Herunterladen des Wörterbuchs |
| Besondere Lesungen: die gebräuchlichen Wörter, die nicht wie ihre Kanji gelesen werden (Jukujikun und Ateji aus JMdict), auf jeder Kanji-Seite und als Kategorie zum Erkunden | Automatisch |
| Kanji schreiben üben mit Maus, Stift oder Finger, nachzeichnend oder aus dem Gedächtnis: Jeder Strich wird beim Loslassen geprüft (falsche Richtung, ein anderer der fehlenden Striche oder keine Ähnlichkeit), mit Tipp nach dem zweiten Fehler oder auf Wunsch und den Strichen, die man wiederholen sollte | Automatisch, mit der Maus geschrieben; die Prüfung, mit 1413 Strichen von 49 KanjiVG-Zeichen |
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
| Mit der automatischen Pause und **Nach einer Weile fortsetzen** hält ein offenes Wortfenster den Countdown an, der beim Schließen neu beginnt; mit **Beim Überfahren des Untertitels** auch die Maus darüber. Optionen, die nicht greifen, werden ausgeblendet, und die beiden Arten fortzusetzen schließen sich aus | Automatisch |
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
| Bilibili: die Untertitel des Uploaders und die seiner KI, über die API seines Players und mit Anmeldung; Videos mit ihren Teilen und Bangumi | Nachgebildete Seite, nach dem, was in einer echten Sitzung zu sehen war, weil die Website automatisierte Browser abweist. Mit installierter Erweiterung ausstehend |
| Zweite Spur in der Hilfssprache | Automatisch |
| Übersetzung mit Claude in Abschnitten, beginnend an der Abspielposition, mit Fortsetzung nach einem Abbruch | Nachgebildete Seite |
| Korrektur automatischer Untertitel, mit einsehbarem Originaltext | Nachgebildete Seite |
| Erstellen von Japanisch aus einer anderen Sprache | Nachgebildete Seite |
| Import von SRT, VTT, ASS, SSA, TTML, DFXP und LRC-Liedtexten, gespeichert pro Titel | Nachgebildete Seite |
| Export als SRT, mit angewendeter Synchronisierung | Nachgebildete Seite |
| Gemerkte japanische Spuren über Netflix-Regionen hinweg | Nachgebildete Seite. Mit echten Sitzungen ist noch zu bestätigen, dass die Titelkennung übereinstimmt |
| Synchronisierung über Versatz oder mit einer oder zwei Markierungen | Automatisch |
| Zeiten von Hand markieren: die Leertaste (oder eine Schaltfläche) gedrückt halten, solange jede Zeile erklingt, und mit der Rücktaste rückgängig machen; die übrigen Zeilen verschieben sich mit der zuletzt markierten, und alles wird für das Video gespeichert | Automatisch |
| Netflix-Uhr: Nach Werbung, wenn die nächste Folge von selbst startet, oder nach einem Sprung folgen die Untertitel dem Zeitpunkt der Folge, den der Netflix-Player angibt, ohne die Seite neu zu laden; zieht seine Uhr die Werbung nicht ab, wird um die Zeit angepasst, die das Video währenddessen lief, bis ihre Uhr einen Messwert liefert; diese Anpassung lässt sich entfernen. **Erneut synchronisieren**, **Anpassung entfernen** und `Alt+Shift+S` | Automatisch, mit einem simulierten Netflix |

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
| Liedtext dort platziert, wo gesungen wird: mit der Stimme (narabas, in dem Bereich, den das von Whisper Gehörte vorgibt), mit der von Demucs auf der GPU freigestellten Stimme oder Buchstabe für Buchstabe mit dem von Whisper Gehörten; Claude nur, wenn er kaum passt. Die Wörter aus dem Liedtext, ohne Abschnittsmarken und Urheberangaben | Simulator, mit echtem Whisper, narabas und Demucs; gemessen mit 51 japanischen Liedern und ihren synchronisierten Texten: mit freigestellter Stimme die Hälfte der Verse unter 0,16 s und neun von zehn unter 0,9 s (auf der Mischung 0,19 s und 1,59 s) |
| Beim Anlegen eines Liedtexts landen Verse, die Whisper nicht gehört hat, nicht in einer instrumentalen Passage: YAMNet hört beim Transkribieren des ganzen Lieds, wo gesungen wird. Gemessen mit 21 japanischen Liedern aus offiziellen Kanälen und ihren synchronisierten Texten: Von 164 nicht gehörten Versen liegen 21 mehr als eine Sekunde näher an ihrer Stelle und 3 weiter weg | Gemessen mit echten Liedern und dem echten Code; YAMNet in Kotonoha |
| Haas-ja für gesprochenes Japanisch, Parakeet für gesprochenes Englisch und Whisper Turbo für Lieder, je nach Video gewählt | Automatisch, mit den drei echten Modellen auf der GPU, und echte Sitzung auf YouTube |
| Liste der gespeicherten Modelle mit dem Platzbedarf jedes Modells und Löschen pro Modell. Das Laden von der Festplatte wird nicht mehr als Download angezeigt | Automatisch und mit echtem Whisper |

## Karten

| Funktion | Überprüfung |
|---|---|
| Erstellen mit einem Klick | Simulator |
| Karten-Ersteller mit allen Feldern | Simulator |
| Senden an Anki über AnkiConnect, mit eigenem Notiztyp oder dem der Erweiterung, mit eigenem Design: markiertes Wort, Szene, Furigana oder Pinyin, Nachtmodus, und von selbst aktualisiert, wenn unverändert | Simulator |
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
| Eingebaute Wiederholung mit FSRS: Rückgängig (`Z`), Bearbeiten (`E`), Ton wiederholen (`R`) und Aussetzen; ein Tageslimit für neue Karten, mit mehr nur für heute; alle Karten mit Status, Suche und Aktionen; der Fortschritt mit Serie, Behaltensquote und zwei Diagrammen mit Tabelle | Automatisch |

## Anwendungsfenster

| Funktion | Überprüfung |
|---|---|
| Wechsel zwischen Bereichen ohne leeren Hintergrund dazwischen: Der neue wird vorbereitet, während der vorige sichtbar bleibt, und erscheint auf einmal, mit einem Balken, wenn es dauert | Automatisch, Bild für Bild |
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
| Beim Lesen gelten dieselben Modi für Furigana, Status und Farbe wie über dem Video, mit einer Auswahl in der Textleiste; kein schließendes Satzzeichen beginnt eine Zeile; im schmalen Fenster öffnet sich die Wortkarte unter dem Text | Automatisch |
| Die Sprachmodelle laden während der Aufnahme (Diktat und Übung): Die zweite Aufnahme der Übung wird in 0,2 s analysiert, und das Diktat eine Sekunde nach dem Ende transkribiert | Automatisch, auf der GPU des Entwicklungsrechners |
| Die Aufnahme jedes Diktats über ihrem Absatz, zum erneuten Anhören; sie geht mit dem Text in die Bibliothek, und eine, die kein Text nutzt, wird nach einer Woche gelöscht | Automatisch |
| Tonhöhenakzent üben im Notizbuch, den Texten der Bibliothek und der Textansicht: der Akzent jedes Worts gezeichnet, die Aufnahme, die Tonhöhenkurve über dem erwarteten Akzent, eine Bewertung pro Wort und lange Pausen | Automatisch, mit einer synthetischen Stimme |
| Die Tonhöhe der Stimme im Browser gemessen (YIN), die Moren anhand der Stimme und der Transkription verortet und wo die Tonhöhe in jedem Wort fällt, auch bei verzögertem Gipfel und entstimmten Moren | Automatisch; abgestimmt mit Minimalpaaren (箸, 橋 und 端; 雨 und 飴), gelesen von einer synthetischen Stimme, und mit einer echten Aufnahme |
| Besondere Moren in der Übung, mit narabas: ein fehlendes oder überzähliges っ, ん oder langer Vokal, mit markierter Mora; der Download des Modells mit seiner SHA-256 geprüft, die GPU nur, wenn sie wie der Prozessor rechnet, und keine Bewertung für ein っ vor einem Reibelaut, für anders gesprochene Phrasen oder für Zögerer am Wortende | Automatisch, mit einer synthetischen Stimme; gemessen mit Minimalpaaren (おばあさん und おばさん, きって und きて…), gesprochen von zwei synthetischen Stimmen: 17 von 22 fehlenden Moren und 10 von 10 überzähligen, ohne Hinweise bei 22 von 24 richtig gesprochenen Sätzen |
| Bibliothek: TXT, HTML und SRT, mit den Überschriften, Absätzen und Listen jedes Kapitels | Automatisch |
| Löschen verlangt eine Bestätigung: ein Buch (mit Datei, Lesefortschritt und Anmerkungen), ein Wörterbuch, ein gespeichertes Modell, eine Karte im Gedächtnis, eine geschriebene Notiz oder der API-Schlüssel | Automatisch |
| Betrachter für Seitenbücher: EPUB aus Bildern, CBZ und PDF in einem eigenen Tab, mit Zoom, Anpassung an Breite oder Seite, Einzelseite, Doppelseite und fortlaufendem Bildlauf | Automatisch |
| Im Betrachter blättern, ohne zwischen den Seiten den Hintergrund zu sehen: Die neue Seite erscheint mit fertigem Bild, und wenn es dauert, bleibt die vorige mit einem Balken | Automatisch, Bild für Bild |
| Die Texterkennung gibt ihre Modelle nach zwei Minuten ohne Lesen frei, auch bei geöffnetem Buch: etwa 470 MB Arbeitsspeicher und 0,7 bis 1 GB auf der Grafikkarte | Gemessen, mit einem echten Manga |
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
| PDF mit Text exportieren: ein PDF mit denselben Seiten und dem Text der Texterkennung unsichtbar darüber, an seiner Stelle, zum Durchsuchen, Markieren und Kopieren in jedem Reader; ein PDF erhält den Text am Dateiende, ohne seine Seiten anzutasten, und ein CBZ oder ein Bild-EPUB wird zu einem neuen PDF mit jedem JPEG unverändert. Auch senkrechter Text und gedrehte Seiten, mit eigenen Korrekturen | Automatisch, und mit einem echten Manga-Band und einem echten Scan |
| Schärfe für Scans mit geringer Auflösung: drei Stufen und „Weißer Hintergrund“, je Buch gespeichert, auch mit umgekehrten Farben | Automatisch, und mit einem echten Scan mit 127 ppi |
| Wortschatz eines Buchs oder einer Sammlung: seine Wörter gezählt, die häufigsten zuerst, mit Lesung, Glosse, JLPT-Stufe und seinen besten Sätzen aus dem Buch mit der Seite; wie viel man versteht und wie viele Wörter für 90, 95 und 98 % fehlen; den Status eines oder aller ausgewählten Wörter ändern; Karten auf einmal im Gedächtnis oder in Anki mit dem Satz aus dem Buch, ohne Claude; Reihenfolge nach Häufigkeit, nach Auftreten oder danach, wie gebräuchlich sie sind; Eigennamen gesondert; die Grammatik des Buchs; in einer Sammlung jeder Band mit dem, was er neu bringt; das Fehlende vom selben Bildschirm aus mit der Texterkennung lesen | Automatisch, mit einem Text, einem Text-EPUB, einem PDF, einem CBZ mit von der Texterkennung gelesenen Seiten und einer Sammlung; gemessen mit einem ganzen Roman (etwa 135.000 Wörter in etwa vier Sekunden) und mit einem echten Manga-Band |
| Japanische Glossen nach Wortart gewählt: なる als 成る, もの und こと als Substantive, und ある, くる oder いう mit dem Eintrag, den das Wörterbuch mit Kanji führt; unter gleich gelesenen Wörtern das meistgebrauchte | Automatisch (Unit-Tests), und gegen 0.31.0 mit 1.900 Wörtern eines Romans gemessen: 110 bekommen eine Glosse, keines verliert sie, und die 6, die sich ändern, werden besser |
| Wörterbücher aus der neuesten yomidevs-Version, die leer ankommen: Stattdessen wird die jüngste frühere Version geladen, die sie vollständig enthält | Automatisch (Unit-Tests), und mit den echten defekten Versionen vom 12. und 14. November 2026 |
| Den Text einer Zeile von Hand bearbeiten, getrennt vom Gelesenen gespeichert und mit „Wiederherstellen“ | Automatisch |
| Notizen und Lesezeichen wie in einem PDF-Reader: Seiten markieren, einen Satz, eine Auswahl auch über mehrere Zeilen oder ein Wort in vier Farben hervorheben oder unterstreichen, mit Kommentar, und Notizen auf der Seite; im Fenster „Notizen und Lesezeichen“ alles nach Seiten, zum Hinspringen, Bearbeiten, Entfernen oder Kopieren als Text | Automatisch |
| Im Buch suchen: im PDF-Text und im Text der Texterkennung, mit Bearbeitungen, ohne Unterschied bei Zeichenbreite sowie zwischen Hiragana und Katakana, auch ein über zwei Zeilen geteiltes Wort; Ergebnisse nach Seiten und auf der Seite markiert | Automatisch |
| Textansicht: die Seite als Text, in Absätzen und mit abgesetzten Überschriften, mit der Lesehilfe des Notizbuchs (Furigana, Verständnis, Vorlesen, Wortfenster und Karten); jedes Buch merkt sie sich | Automatisch, und die Absätze mit 16 echten Seiten |
| Den Text einer Seite mit Claude prüfen, anhand ihres Bildes: nur die Änderungen, die nicht übereinstimmen, Buchstabe für Buchstabe, zur Auswahl, gespeichert als bearbeitete Zeilen | Simulator |
| Ein Tippen auf ein Wort der Seite öffnet seinen ganzen Satz, auch über mehrere Zeilen, in einem schwebenden Fenster wie bei den Untertiteln, mit Furigana, seinen Wörtern, dem Wortfenster und der Kartenerstellung; zwei Tipper den Satz, drei den Absatz. Ein Magnet führt ein Tippen zwischen zwei Zeilen zur nächsten | Automatisch, mit einem vom Browser erzeugten PDF, waagerecht und senkrecht |
| Benannte Menüs in einer einzigen Zeile (Buch, Ansicht, Gehe zu, Text, Lesehilfen, Anmerken und Hilfe), mit der Taste jedes Befehls und auch per Tastatur bedienbar; Aktion suchen (Strg+K), das jeden Befehl findet oder über die Seitenzahl zu einer Seite führt, und Tastenkürzel („?“) | Automatisch: Unit-Tests der Befehlsliste (keine doppelten Tasten, Menüs und Palette) und End-to-End |
| Werkzeuge des Betrachters: Auswählen, Hand (Ziehen verschiebt die Seite), Textmarker (das Überzogene wird hervorgehoben, ohne das Fenster zu öffnen) und Notiz hinzufügen, dazu ein Rechtsklickmenü auf der Seite | Automatisch |
| Bereiche links, die sich verbreitern und ihre Breite merken; eine Statusleiste mit Seite, Kapitel, Fortschritt im Buch und Herkunft des Texts; Zurück nach einem Sprung (Alt+←); Lesemodus; „Aa“ mit den Lesehilfen, die in ganz Kotonoha gelten, und dem, was nur für das Buch gilt; ein geöffnetes Buch öffnet keinen weiteren Tab | Automatisch |
| Die erweiterte Seite: Unterstreichung nach Status, Furigana (alle, unbekannte, beim Überfahren oder keine) und Grammatik auf der Seite, ohne gedrucktes Furigana zu überdecken; mit dem Text eines PDFs und mit der Texterkennung für Bücher, die jetzt aus den Schritten des Erkenners weiß, wo jeder Buchstabe steht | Automatisch: Unit-Tests der Lage jedes Worts und seiner Lesung, der CTC-Schnitte und des gedruckten Furigana; End-to-End mit einem PDF mit Ruby |
| Die Übersetzung des geöffneten Satzes als Untertitel darunter, ohne Kosten aus dem Gespeicherten gelesen; das Wortfenster beim Überfahren mit Umschalt, Strg oder Alt; wie viel man vom Sichtbaren versteht | Automatisch, mit einem falschen Claude |
| Vorlesen, das dem Satz folgt, Seite für Seite; Nachgeschlagen: die in einem Buch gewählten Wörter, auf einmal zu Karten mit ihrem Satz, Furigana, Definitionen und einem Ausschnitt der Seite | Automatisch |
| Einen Bereich lesen (O): Ein auf der Seite gezogenes Rechteck wird mit der Texterkennung gelesen, auch wenn sie für das Buch ausgeschaltet ist; das Gelesene kommt an seiner Stelle in den Text der Seite und öffnet sich im Fenster; in einem Manga als Sprechblase, gelesen mit manga-ocr. Es wird nicht gespeichert | Automatisch: Unit-Tests des Ausschnitts und dessen, wie das Gelesene in die Seite kommt; End-to-End in einem Buch und einem Manga, auch mit einem Bereich ohne Text |
| Text-EPUBs mit dem, was der Seitenbetrachter hat: die Menüs, Aktion suchen (Strg+K, auch mit dem Fokus im Buch), die Tastenkürzel, „Aa“, das Inhaltsverzeichnis links, Zurück (Alt+←), die Statusleiste und der Lesemodus | Automatisch |
| Die Texte der Bibliothek (Eingefügtes, Geschichten, Artikel) werden im Betrachter gelesen, in einem eigenen Tab, mit seinen Menüs, „Aa“, ihren Seiten und Im Notizbuch bearbeiten | Automatisch |
| Ordner importieren, auch aus einer Sammlung: alle PDF-, EPUB- und CBZ-Dateien darin, in allen Unterordnern und der Reihe nach, mit Titeln, die sich nicht wiederholen, und ohne zu verdoppeln, was schon da war | Automatisch |
| „Dein Computer“ in der Begrüßung und in den Einstellungen: wie gut lokale Spracherkennung, Liedtexte und Texterkennung hier laufen, nach den Angaben des Browsers zur Grafikkarte und einem Test, der eine Beispielseite mit der Texterkennung liest; jeder Teil mit seiner Zeit und einem Tipp. Nichts wird abgeschaltet | Automatisch: Unit-Tests der Stufen und Schätzungen; End-to-End mit echter Grafikkarte und ohne |
| Messen im echten Gebrauch: Wie lange Spracherkennung und Texterkennung brauchen, wird in „Dein Computer“ gespeichert und zählt mehr als der Test; wird ein Video schneller angesehen, als es transkribiert wird, gibt es einen Hinweis, und „Auf die Transkription warten“ hält es an, bis die Transkription wieder vorne liegt; bei „Automatisch“ ruht die Grafikkarte mehr, wenn das Video ruckelt; die Texterkennung liest auf einem langsamen Computer weniger Seiten voraus und schlägt „Einen Bereich lesen“ vor | Automatisch: Unit-Tests von Tempo, Rucklern und Messwerten; End-to-End mit einer echten Transkription, die langsamer als das Video ist, und mit der Texterkennung |
| Die Funktionen vorstellen: Die Begrüßung endet mit „Womit möchtest du anfangen?“ und vier Wegen; „Kotonoha entdecken“ auf Start, mit den Funktionen nach Bereichen und einer Schaltfläche zum Ausprobieren; ein gemeinfreier Beispieltext in jeder Sprache; Hinweise beim ersten Mal, nur für neue Installationen; und nach jedem Update einmal das Neue | Automatisch: Unit-Tests der Beispieltexte und der Neuerungen; End-to-End mit einem neuen Profil, auf Japanisch und Englisch |
| Stimmen von AivisHub direkt in Kotonoha: „Stimmen installieren“ lädt das BERT von AivisSpeech, ein Wörterbuch und die Stimme まお herunter (etwa 0,9 GB, geprüft mit ihrem SHA-256) und liest japanische Sätze vor, ohne dass AivisSpeech geöffnet ist, mit der Stimme auf der Grafikkarte; ein Katalog von AivisHub mit Suche, Filtern, Hörproben und Lizenzen; der Akzent mit yomi und den Verkettungsregeln von AivisSpeech (92 % der Moren wie dort); eine Frage in der Wortkarte und ein Hinweis auf Start, einmalig | Automatisch: Unit-Tests der Stimmeingabe, des AIVMX-Lesers und des Akzents mit einem Korpus von 210 Sätzen gegen AivisSpeech; End-to-End mit Installieren und Vorlesen mit der echten Stimme und mit dem Katalog von AivisHub |
| Das Fenster verdeckt nicht, was noch zu lesen ist: Es steht am Seitenrand, wenn es Platz hat, sonst über bereits Gelesenem (über der Zeile oder rechts der Spalte bei senkrechtem Text); es lässt sich verschieben, vergrößern und als Fenster am Rand anheften, das sich verbreitern lässt und seine Breite behält | Automatisch (Unit-Tests der Platzierung) |
| Durch Ziehen auswählen, Zeichen für Zeichen und über Zeilen hinweg, mit Übersetzen, Erklären, Aufschlüsseln, Anhören, Hervorheben, Notiz und Kopieren; Strg+C kopiert das Geöffnete | Automatisch |
| Umblättern mit sichtbaren Pfeilen an den Seiten, der Tastatur oder durch Wischen: Ein Tippen auf die Seite schließt nur das Geöffnete, und ein knapp verfehltes Wort blättert nicht mehr um | Automatisch |
| Jede Seite wird nur einmal gelesen und gespeichert; ihr Text erreicht auch Bildschirmleser | Automatisch |
| Text-EPUBs im Betrachter in ihrem eigenen Format: Kapitel, CSS, Ruby, Illustrationen und vertikale Schrift, mit dem Seiten-Reader darüber, mit Farben, Furigana und Wortfenstern | Automatisch, mit einem vertikalen EPUB mit Ruby, CSS und Illustration |
| Was ein EPUB enthält, wird nicht ausgeführt und lädt nichts von außen: keine Skripte, Frames, Formulare oder on*-Attribute | Automatisch, mit einem EPUB voller Fallen |
| Inhaltsverzeichnis, Zoom, Links zwischen Kapiteln, wahlweise vertikaler oder horizontaler Text und die genaue Stelle, an der jedes Buch verlassen wurde | Automatisch |
| PDFs mit Text: Der eigene Text der Datei wird sofort gelesen, ohne OCR, auch in vertikalen Spalten, und Kangxi-Radikale werden zu den Kanji, für die sie stehen | Automatisch, mit einem vom Browser erzeugten japanischen PDF |
| Ein Tippen auf ein Wort der Seite öffnet sein Wortfenster direkt und markiert es auf der Seite, in PDFs mit Text und im Modus Buch der Texterkennung | Automatisch |
| Nach Niveau erzeugte Geschichten | Simulator |
| Player für eigene Dateien | Automatisch |
| In MKV eingebettete Untertitel und Wahl der Audiospur, mit ffmpeg.wasm | Automatisch |
| Eigene Steuerelemente des Players: Geschwindigkeit, Lautstärke, Sprünge von Zeile zu Zeile, der Satz jedes Moments auf der Zeitleiste und Vollbild mit Untertiteln | Automatisch |
| Ganze Ordner als Wiedergabeliste, in natürlicher Reihenfolge, mit den Untertiteln jeder Folge nach Sprache verteilt | Automatisch |
| Weitermachen, wo jede Datei aufgehört hat, „Weiterschauen“ und erneutes Öffnen mit einem Klick | Automatisch |
| Audio im Player: MP3, M4A, OGG, WAV und FLAC | Automatisch |
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

## Chinesisch

| Funktion | Überprüfung |
|---|---|
| Chinesische Untertitel, mit jedem Wort analysiert, Pinyin über jedem Zeichen und den zweiten Untertiteln in der Hilfssprache | Nachgebaute Seite |
| Die vereinfachte Spur vor der traditionellen, und eine traditionelle in vereinfachte Schriftzeichen umgewandelt | Nachgebaute Seite |
| Wörter mit den Wörterbüchern und der Häufigkeit zerlegt, und das Pinyin des Wörterbuchs; bei mehreren das des Satzes | Gemessen mit 200 Sätzen gegen jieba und pypinyin: 91 % der Trennungen und 96 % der Silben gleich. Der Rest ist fast nur Konvention (der neutrale Ton von CC-CEDICT, der nicht angewandte Tonwechsel) oder ein Fehler der Referenz |
| Jede Silbe und ihr Pinyin in der Farbe ihres Tons, in Untertiteln, im Seitenleser, im Viewer und in der Wortkarte | Automatisch, mit einem nachgebildeten Video |
| Wie es klingt: das Pinyin, wie es im Satz gesprochen wird, mit dem Tonwechsel von 一, 不 und aufeinanderfolgenden dritten Tönen, dem neutralen Ton und 儿化 | Automatisch, mit Fällen wie 你好, 我很好, 展览馆, 一个, 第一, 看一看, 是不是 und 一点儿 |
| Tonübung mit dem Mikrofon, ohne Modelle: die Stimme in Silben geteilt und die Form jedes Tons im Stimmumfang des Sprechers beurteilt | Gemessen mit 364 Wörtern von Lingua Libre von 16 Muttersprachlern, einzeln und zu dritt verbunden: mit der Hälfte kalibriert und mit der anderen Hälfte von anderen Sprechern geprüft. In Sätzen werden 70 % der mit ihrem Ton gesprochenen Silben angenommen und 19 % der mit einem anderen gesprochenen. Eine synthetische Stimme mit den vier Tönen besteht den automatischen Test vollständig |
| CC-CEDICT, kurze Übersetzungen von Wiktionary in der Sprache der Oberfläche und Häufigkeit, mit vereinheitlichten Lesungen | Automatisch, mit echten Daten |
| Suche nach Pinyin, mit oder ohne Töne | Automatisch, mit echten Daten |
| Grammatik von HSK 1 bis 6: 105 Regeln, jede auf der Stufe des Lehrplans von 2025, von Claude bestätigt | Automatisch, jede Regel mit der Stufe des Lehrplans abgeglichen |
| HSK-Bildschirm: Wortschatz, Hanzi und Grammatik jeder Stufe des Lehrplans von 2025, mit Pinyin und Glossen aus CC-CEDICT | Automatisch, mit den erzeugten Listen und dem echten Bildschirm |
| Seite jedes Hanzi: Pinyin, Stufe, Radikal mit seinem Namen aus dem Unterricht, Bestandteile, Entstehung, Laut- und Bedeutungsbestandteil, Langzeichenform und gleich gelesene | Automatisch, mit dem tatsächlich heruntergeladenen Wörterbuch Make Me a Hanzi |
| Strichfolge von Hanzi Writer und Schreibübung | Automatisch, mit tatsächlich heruntergeladenen Strichen |
| Seiten-Reader, mit Pinyin über jedem Zeichen | Automatisch |
| Wort-Audio von Wikimedia Commons und Lingua Libre | Automatisch |
| Whisper Turbo für Sprache und Lieder | Ausstehend |
| Azure-Stimmen | Ausstehend |

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
| Kein Flackern | Was sich als Ganzes ändert (ein Bereich, eine Seite im Betrachter, ein Wort im Wörterbuch), wird vorbereitet, während das Vorige sichtbar bleibt, und erscheint auf einmal; dauert es, zeigt ein dünner Balken das an |
| Sparsamer Speicher | Die japanische Analyse lädt ihr Wörterbuch ohne Auffüllung, vom Browser entpackt; die Texterkennung gibt ihre Modelle frei, wenn sie nicht mehr liest, und Whisper drei Minuten nach dem Transkribieren |
| Seiten werden nicht umgeschrieben | Die Unterstreichung im Web verwendet die CSS Custom Highlight API, ohne dem Inhalt etwas hinzuzufügen. Nur der Zeilenabstand wird geöffnet, wo Furigana nicht passen |
| Lokale Daten | Alles bleibt im Browser, und das Audio der Transkription verlässt den Computer nicht |

## Bekannte Einschränkungen

| Einschränkung | Einzelheit |
|---|---|
| Sehr große PDFs | Solange es geöffnet ist, reserviert ein PDF so viel Speicher, wie die Datei groß ist (so arbeitet pdf.js): Eine Datei mit 550 MB zeigt im Task-Manager mehr als 1 GB, obwohl nur der gelesene Teil wirklich belegt ist. Beim Schließen wird er freigegeben |
| Eigennamen im Wortschatz | Nur die, die IPADIC als Namen erkennt, werden abgesondert; Figurennamen, die auch Wörter sind (アイ, ルビー), erscheinen als Wörter und lassen sich als ignoriert markieren. Gezählt wird nur bereits gelesener Text: in einem Bildbuch die mit der Texterkennung gelesenen Seiten |
| Lernsprache | Japanisch, Englisch, Deutsch und Chinesisch. Jede neue Sprache braucht ihr eigenes Paket in `src/lenguas` |
| Analyse des Englischen | Sie erfolgt mit einem kleinen Modell, das in die Erweiterung passt. In mehrdeutigen Sätzen kann es die Wortart falsch bestimmen und damit auch die Übersetzung unter dem Wort. Das Wortfenster zeigt weiterhin alle Definitionen |
| Analyse des Deutschen | Sie stammt aus den Formen der Wörterbücher: Ohne Deutsch–Englisch ist jedes Wort seine eigene Form. Zwischen zwei möglichen Wörtern entscheidet die Häufigkeit, ohne auf den Satz zu achten; Claude korrigiert Fehler, wenn es die Zeile prüft |
| Deutsche Komposita | Ein zusammengesetztes Nomen, das nicht in den Wörterbüchern steht, wird nicht in seine Teile zerlegt |
| Analyse des Chinesischen | Die Wörter stammen aus den Wörterbüchern und der Häufigkeit, ohne Modell: Ein Name oder ein neues Wort bleibt Zeichen für Zeichen. Das Pinyin über den Wörtern trägt den Ton des Wörterbuchs; wie er sich beim Sprechen ändert, zeigt Wie es klingt |
| Tonübung | Ohne Transkription werden die Silben über die Stimme verortet: eine Silbe zu viel oder zu wenig verschiebt die folgenden. Der dritte Ton ist am schwersten zu unterscheiden (62 % der richtig gesprochenen werden angenommen), weil die Stimme ganz unten knarrt und die Tonhöhe verloren geht |
| Englisch-Englisch-Wörterbuch | Es ist groß: etwa 110 MB Download und etwa 220 MB Speicherplatz. Installieren und Entfernen dauern einige Minuten. Es wird nur bei englischer Oberfläche vorgeschlagen |
| Übersetzungen der Oberfläche | Mit KI-Unterstützung geschrieben, noch ohne Prüfung durch Muttersprachler. Fehler werden in `idiomas/` korrigiert |
| Seiten-Reader | Wirkt nur im Hauptframe: Text in einem iframe erreicht er nicht. Was eine Seite auf eine Leinwand oder in ein Bild zeichnet, ist kein Text |
| Claude-Prompts | Die Anweisungen bleiben auf Spanisch, auch wenn die Antwort in einer anderen Sprache angefordert wird |
| Plattformen | Chrome und Edge auf dem Desktop. Der lokale Helfer ist für Windows vorbereitet |
| Bild mit DRM | Bei Netflix und anderen geschützten Websites liefert der Browser das Einzelbild schwarz. Die Karte erhält das offizielle Bild der Folge, falls die Website eines anbietet |
| Audio mit DRM | Eine geschützte Website kann ihren Ton der Aufnahme vorenthalten. Nach zwei stummen Sätzen in Folge in einem Video wird die Zeile nicht mehr zur Aufnahme erneut abgespielt |
| Betrachter | Die Texterkennung kann ähnliche Zeichen verwechseln (エ und 工, ー und 一), gelegentlich eines auslassen und die Indizes von Formeln verlieren; das Originalbild bleibt immer sichtbar. Der Modus Buch ist mit horizontalem Text gemessen. Ein Buch mit DRM öffnet sich nicht. Die Buchdateien sind nicht Teil der Sicherung in einer Datei, wohl aber der vollständigen Kopie. Ein Text-EPUB wird kapitelweise mit Scrollen gelesen, nicht seitenweise; im Modus Manga wird die ganze Sprechblase angetippt, nicht jedes Wort: Das Wort wählt man im Fenster, und in einer Sprechblase lässt sich nicht durch Ziehen auswählen. Die Hilfen auf der Seite gelten nicht für Sprechblasen eines Mangas, in denen die Lage der Buchstaben unbekannt ist, und Seiten, die die Texterkennung vor 0.37.0 gelesen hat, verteilen ihre Buchstaben über die Zeile. |
| Synchronisierung | Ohne Server: Die Übertragung zwischen Computern erfolgt über die vollständige Kopie |
| Hintergrundmusik | Whisper kann leise Gespräche unter lauter Musik verlieren |
| Liedtexte | Einer von zehn Versen landet mehr als 0,9 s von der Stelle entfernt, an der er gesungen wird, und einige wenige mehrere Sekunden, in Passagen, die Whisper nicht hört. Ohne Demucs, auf der Mischung, einer von zehn mehr als 1,59 s. Demucs braucht WebGPU, und narabas und Demucs werden eigens heruntergeladen (1,4 GB) |
