<p align="right"><a href="../funciones.md">Español</a> · <a href="../features.md">English</a> · <b>Deutsch</b> · <a href="../zh/features.md">简体中文</a> · <a href="../ko/features.md">한국어</a> · <a href="../ja/features.md">日本語</a></p>

# Funktionen

Stand jeder Funktion in Version 0.4.0 und die Art ihrer Überprüfung.

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
| Lokaler Helfer mit yt-dlp und FFmpeg | Automatisch, mit lokalem Download. Es fehlen die echte Registrierung im Browser und ein echter YouTube-Download |
| Korrektur des Ergebnisses mit Claude | Simulator |

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
| Reader für eingefügten Text | Automatisch |
| Reader in einem normalen Tab, auch in geteilter Ansicht neben der angezeigten Seite | Automatisch, in Edge und Chrome |
| Zwischenablage folgen, ohne dass der Tab den Fokus hat | Automatisch |
| Bibliothek: EPUB, TXT und SRT | Automatisch |
| Nach Niveau erzeugte Geschichten | Simulator |
| Player für eigene Dateien | Automatisch |
| In MKV eingebettete Untertitel und Wahl der Audiospur, mit ffmpeg.wasm | Automatisch |
| Wortübersicht nach Status | Automatisch |
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
| Die Lernsprache wählen: in der Begrüßung, in den Einstellungen oder im Menü der Erweiterung | Automatisch |
| Wörter, Wörterbücher, Karten und Einstellungen je Sprache getrennt | Automatisch |
| Oberfläche auf Spanisch, Englisch, Deutsch, vereinfachtem Chinesisch, Koreanisch und Japanisch | Automatisch: vollständige Tabellen und Screenshots jeder Sprache |
| Begrüßung mit Sprache, Niveau, Wörterbüchern, Schlüssel und Ziel der Karten | Automatisch |
| Erklärungen und Übersetzungen in einer anderen Sprache als die Oberfläche, auch Portugiesisch und Französisch | Automatisch |
| JMdict auf Deutsch, zusätzlich zu Spanisch und Englisch | Automatisch |
| Lesungen in Kana oder Rōmaji | Automatisch |
| Farbpaletten: üblich, für Farbenblindheit und mit hohem Kontrast | Automatisch |
| Frei wählbare Tastenkürzel, die mit jeder Tastaturbelegung funktionieren | Automatisch |
| Monatliches Kostenlimit für Claude | Simulator |

## Englisch

| Funktion | Überprüfung |
|---|---|
| Englische Untertitel, mit jedem analysierten Wort und der Zweitspur in der Hilfssprache | Nachgeahmte Seite. Eine echte Sitzung steht noch aus |
| Korrektur automatischer Untertitel und Erstellen von Englisch aus einer anderen Sprache | Nachgeahmte Seite |
| Amerikanische und britische Aussprache in IPA, im Wortfenster und auf Wunsch über jedem Wort | Automatisch, mit echten Daten aus Wiktionary |
| Farbe nach betonter Silbe: die erste, eine mittlere oder die letzte | Automatisch |
| Definitionen und Übersetzungen aus Wiktionary auf Spanisch, Deutsch, Chinesisch, Koreanisch und Japanisch, dazu Definitionen auf Englisch | Automatisch, mit echten Daten |
| Häufigkeit nach Untertiteln von Filmen und Serien | Automatisch, mit echten Daten |
| Von welchem Wort jede Form stammt: *went* ist *go*, *didn't* ist *do* | Automatisch |
| Partikelverben und feste Wendungen, auch getrennt: *picked it up* findet *pick up* | Automatisch |
| Grammatik von A1 bis C2: 51 Regeln, von Claude bestätigt | Simulator |
| Seiten-Reader, anfangs ausgeschaltet, der Seiten in anderen Sprachen in Ruhe lässt | Automatisch und auf 16 echten öffentlichen Websites |
| Whisper auf Englisch, mit lesbar getrennten Zeilen | Automatisch, mit einer synthetischen Stimme |
| Eigene Anweisungen an Claude für Englisch | Simulator |
| Wort-Audio von Wikimedia Commons und Lingua Libre | Automatisch |
| Neuronale Azure-Stimmen auf Englisch | Ausstehend |
| Niveautest und Weg von A1 bis C2 | Automatisch |

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
| Lernsprache | Japanisch und Englisch. Jede neue Sprache braucht ihr eigenes Paket in `src/lenguas` |
| Analyse des Englischen | Sie erfolgt mit einem kleinen Modell, das in die Erweiterung passt. In mehrdeutigen Sätzen kann es die Wortart falsch bestimmen und damit auch die Übersetzung unter dem Wort. Das Wortfenster zeigt weiterhin alle Definitionen |
| Englisch-Englisch-Wörterbuch | Es ist groß: etwa 110 MB Download und etwa 220 MB Speicherplatz. Installieren und Entfernen dauern einige Minuten. Es wird nur bei englischer Oberfläche vorgeschlagen |
| Übersetzungen der Oberfläche | Mit KI-Unterstützung geschrieben, noch ohne Prüfung durch Muttersprachler. Fehler werden in `idiomas/` korrigiert |
| Seiten-Reader | Wirkt nur im Hauptframe: Text in einem iframe erreicht er nicht. Was eine Seite auf eine Leinwand oder in ein Bild zeichnet, ist kein Text |
| Claude-Prompts | Die Anweisungen bleiben auf Spanisch, auch wenn die Antwort in einer anderen Sprache angefordert wird |
| Plattformen | Chrome und Edge auf dem Desktop. Der lokale Helfer ist für Windows vorbereitet |
| Bild mit DRM | Bei Netflix und anderen geschützten Websites liefert der Browser das Einzelbild schwarz. Die Karte erhält das offizielle Bild der Folge, falls die Website eines anbietet |
| Audio mit DRM | Eine geschützte Website kann ihren Ton der Aufnahme vorenthalten. Nach zwei stummen Sätzen in Folge in einem Video wird die Zeile nicht mehr zur Aufnahme erneut abgespielt |
| Synchronisierung | Ohne Server: Die Übertragung zwischen Computern erfolgt über die Sicherung |
| Hintergrundmusik | Whisper kann leise Gespräche unter lauter Musik verlieren |
