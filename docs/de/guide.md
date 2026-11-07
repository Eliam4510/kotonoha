<p align="right"><a href="../guia.md">Español</a> · <a href="../guide.md">English</a> · <b>Deutsch</b> · <a href="../zh/guide.md">简体中文</a> · <a href="../ko/guide.md">한국어</a> · <a href="../ja/guide.md">日本語</a></p>

# Anleitung

Diese Anleitung beschreibt die tägliche Nutzung von Kotonoha. Die Installation steht in der [README](../../README.de.md#installation), die vollständige Funktionsliste in [features.md](features.md).

## Inhalt

- [Erste Einrichtung](#erste-einrichtung)
- [Über dem Video](#über-dem-video)
- [Untertitel](#untertitel)
- [Transkription mit Whisper](#transkription-mit-whisper)
- [Karten](#karten)
- [Audio, Bilder und Beispiele](#audio-bilder-und-beispiele)
- [Webseiten, Reader und Bibliothek](#webseiten-reader-und-bibliothek)
- [Englisch lernen](#englisch-lernen)
- [Deutsch lernen](#deutsch-lernen)
- [Kosten für Claude](#kosten-für-claude)
- [Daten und Sicherung](#daten-und-sicherung)
- [Tastenkürzel](#tastenkürzel)
- [Häufige Probleme](#häufige-probleme)

## Erste Einrichtung

Beim ersten Mal öffnet sich eine Begrüßung, die nach Sprache, Lernsprache und Niveau fragt und vorschlägt, die Wörterbücher zu installieren, den Claude-Schlüssel hinzuzufügen und festzulegen, wohin die Karten gehen. Sie lässt sich überspringen und unter **Einstellungen, Darstellung** erneut aufrufen. Alles Weitere wird unter **Einstellungen** im Fenster der Erweiterung festgelegt, das sich mit `Alt+Shift+K` öffnet.

| Schritt | Wo | Wofür |
|---|---|---|
| Wörterbücher | Einstellungen, Wörterbücher | JMdict auf Spanisch, Englisch oder Deutsch, Tonhöhenakzent von Kanjium und Häufigkeit von JPDB. Sie werden einmal heruntergeladen und bleiben im Browser |
| Claude-API-Schlüssel | Einstellungen, Claude | Erklärungen, Prüfung der Lesungen, Übersetzung und Korrektur. Er wird nur im Browser gespeichert |
| Sprache und Niveau | Einstellungen, Sprache und Niveau | Sprache der Oberfläche und, getrennt davon, die der Erklärungen und Übersetzungen. Das Niveau passt die Erklärungen an und bestimmt, wie viele Furigana anfangs sichtbar sind |
| Sprache, die du lernst | Einstellungen, Sprache und Niveau, das Menü der Erweiterung oder **Videoeinstellungen, Untertitel** direkt im Video | Japanisch, Englisch oder Deutsch. Jede behält ihre eigenen Wörter, Wörterbücher, Karten und Einstellungen |
| Anki | Einstellungen, Karten und Anki | Optional. Erfordert ein geöffnetes Anki mit dem Add-on AnkiConnect |

Die Erweiterung funktioniert ohne Claude-Schlüssel: Untertitel, Wörterbuch, Furigana, Farben, Karten und Whisper benötigen ihn nicht.

### Anpassen

| Option | Wo | Wofür |
|---|---|---|
| Lesungen in Rōmaji | Einstellungen, Sprache und Niveau | Für alle, die noch kein Kana lesen. Gilt für Untertitel, Wortfenster und Seiten |
| Wortfarben | Einstellungen, Darstellung | Drei Paletten: die übliche, eine für Farbenblindheit, die ohne Rot und Grün unterscheidbar ist, und eine mit hohem Kontrast |
| Tastenkürzel | Einstellungen, Tastenkürzel | Die Kürzel über dem Video werden dort geändert. Die des Browsers, etwa für die Audioaufnahme, auf dessen Kürzel-Seite |
| Kostenlimit | Einstellungen, Claude | Ist es erreicht, wird Claude bis zum nächsten Monat nicht mehr verwendet |
| Websites ohne Reader | Einstellungen, Seiten-Reader, oder die Schaltfläche am Seitenrand | Schaltet ihn nur dort ab, wo er stört |

## Über dem Video

Beim Öffnen eines Videos mit japanischen Untertiteln erscheint oben eine schwebende Leiste. Sie zeigt den geschätzten Verständnisgrad, die empfohlenen Sätze, die bekannten Wörter und den Wiedergabemodus. Sie blendet sich selbst aus, erscheint wieder, wenn die Maus am oberen Rand verweilt, und bleibt, solange die Maus in der Nähe ist.

**Untertitel.** Jedes Wort trägt Furigana, eine Farbe nach seinem Tonhöhenakzent und eine Unterstreichung nach seinem Status: unbekannt, verfolgt, bekannt oder ignoriert. Erkannte Grammatikpunkte erscheinen als Etiketten.

**Untertitel verschieben.** Sie lassen sich von jedem Punkt aus, auch von einem Wort, in die gewünschte Höhe und auf die gewünschte Seite ziehen. Die Position gilt für alle Videos und bleibt proportional zur Videogröße erhalten, auch im Theatermodus. Ein Doppelklick auf den Hintergrund oder **An ihren Platz zurück** in den Anzeigeeinstellungen setzt sie zurück.

**Wortfenster.** Beim Überfahren eines Wortes mit der Maus öffnet sich sein Wortfenster, ohne Anfrage an Claude, mit Definitionen, Häufigkeit, Audio, Bildern, Beispielen, Strichfolge und Links zu Jisho, JapanDict, Weblio, Goo, Kotobank, Wiktionary, Forvo und Massif. Der Link zu JapanDict öffnet den genauen JMdict-Eintrag, nicht die Liste der Homographen.

**In diesem Satz.** Mit einem Claude-Schlüssel gibt die Schaltfläche **Was bedeutet es in diesem Satz?** den Sinn des Wortes in diesem Kontext an und weist auf übertragenen oder poetischen Gebrauch hin. Claude erhält 40 Zeilen rund um den Satz und die Übersetzung. Die Tabs **Erklären**, **Analyse** und **Übersetzen** funktionieren genauso: Sie fragen erst beim Anklicken. Jede Antwort wird gespeichert, sodass die Rückkehr zu diesem Wort in diesem Satz nichts kostet; das Wortfenster zeigt dann **Gespeichert, ohne Kosten** an. Die Schaltfläche **Vertiefen** wiederholt die Anfrage mit Opus 5.5.

**Striche.** Der Tab **Striche** im Wortfenster zeigt, wie jedes Kanji des Wortes geschrieben wird: Die Striche werden einzeln gezeichnet, in einer Schleife und mit ihrer Nummer. Die Animation lässt sich anhalten, Strich für Strich durchgehen und in der Geschwindigkeit ändern. Die Daten stammen von [KanjiVG](https://kanjivg.tagaini.net): Jedes Kanji wird beim ersten Mal heruntergeladen und bleibt im Browser gespeichert.

**Untertitel-Navigator.** `G` öffnet eine Seitenleiste mit allen Zeilen, Filtern, Markierungen und Mehrfachauswahl. Dort lassen sich auch Zeilen zusammenführen, mehrere Karten erstellen und Untertitel synchronisieren.

**Wiedergabemodi.**

| Modus | Verhalten |
|---|---|
| Normal | Spielt ab, ohne anzuhalten oder Untertitel auszublenden |
| Vorbereitetes Hören | Hält vor jedem Satz an und zeigt die Übersetzung |
| Intensives Lesen | Hält vor jedem Satz an, um ihn zu lesen und danach zu hören |
| Intensives Hören | Blendet die Untertitel aus, bis der Satz gesprochen ist, hält dann an und zeigt sie |
| Intensiver Hybrid | Hält nach jedem Satz an, mit sichtbaren Untertiteln |
| Beim Pausieren anzeigen | Zeigt Untertitel nur bei angehaltenem Video |
| 1T-Fokus | Hält bei Sätzen mit genau einem unbekannten Wort an |
| Benutzerdefiniert | Erlaubt, Pausen und Schleier anzupassen |

Szenen ohne Dialog lassen sich über den Videobereich beschleunigen oder überspringen.

## Untertitel

### Spuren wählen

Der Bereich **Video und Untertitel**, Tab **Untertitel**, erlaubt die Wahl der japanischen Spur und der Zweituntertitel. Standardmäßig werden von Hand erstellte Untertitel den automatischen vorgezogen, und importierte haben Vorrang vor allen anderen.

### Mit Claude übersetzen

Die Übersetzungsschaltfläche im Bereich **KI-Untertitel** oder **Mit Claude übersetzen** neben den Zweituntertiteln übersetzt die japanischen Untertitel in die Hilfssprache: Spanisch, Englisch, Portugiesisch, Französisch oder Deutsch.

- Die Arbeit beginnt bei dem Abschnitt, der gerade läuft, sodass dieser Teil in Sekunden fertig ist.
- Das Ergebnis erscheint nach und nach.
- Wird abgebrochen, bleibt das Übersetzte erhalten, und ein erneuter Klick fragt nur die fehlenden Zeilen an.

### Automatische Untertitel korrigieren

Automatische Untertitel verwechseln oft Homophone. Claude korrigiert sie mit dem Titel und dem Gesamttext als Kontext, ohne Rückfragen.

- Für automatische Spuren ist dies standardmäßig aktiviert und lässt sich im Bereich abschalten.
- Geändert wird nur, was einen klaren Fehler enthält. Eine Zeile, die Claude für eine Erfindung der Spracherkennung hält, wird entfernt.
- Korrekturen werden gespeichert und nicht erneut angefragt.
- Der Navigator markiert korrigierte Zeilen und zeigt auf Wunsch den Originaltext.

### Japanisch aus einer anderen Sprache erstellen

Gibt es nur Untertitel in einer anderen Sprache, kann Claude sie ins Japanische übertragen. Das ist die Übersetzung einer Übersetzung und stimmt daher nicht ganz mit dem Gehörten überein. Eine japanische Untertiteldatei ist, falls vorhanden, immer die bessere Wahl.

### Importieren und exportieren

Jede Spur hat die Schaltflächen **Importieren** und **SRT exportieren**. Eine Datei lässt sich auch auf das Video ziehen. Unterstützt werden SRT, VTT, ASS, SSA, TTML und DFXP.

- Importiertes bleibt für diesen Titel gespeichert und hat Vorrang vor den Spuren der Website.
- Der Export berücksichtigt die Synchronisierung.

### Netflix-Regionen

Die japanischen Untertitel eines Netflix-Titels werden beim Ansehen zusammen mit seiner Kennung gespeichert. Bietet der Katalog einer anderen Region denselben Titel ohne diese Spur an, zeigt Kotonoha sie als „Japanisch (gespeichert)“ an und als Zweituntertitel, was diese Region anbietet. Ein Export als SRT und ein Import der Datei decken denselben Fall von Hand ab.

### Synchronisieren

Der Tab **Synchronisieren** passt den Versatz jeder Spur an. Alternativ lässt sich im Navigator **Synchronisieren: Diese Zeile ist gerade zu hören** wählen: Eine Markierung korrigiert den Versatz, zwei auch die Geschwindigkeit. Der Versatz lässt sich mit `Alt+I` und `Alt+O` ändern.

## Transkription mit Whisper

Whisper erzeugt japanische Untertitel, wenn ein Video keine mitbringt. Es läuft über WebGPU auf der Grafikkarte, und das Audio verlässt den Computer nicht. Beim ersten Mal wird das Modell heruntergeladen und im Browser gespeichert. Bei Netflix wird es nicht angeboten, da dessen Titel fast immer Untertitel haben.

| Quelle | Voraussetzung | Geschwindigkeit |
|---|---|---|
| Eigene Datei im Player der Anwendung | Keine | Etwa 5 Minuten pro 30 Minuten Video |
| Internetvideo mit dem lokalen Helfer | Helfer installieren | Etwa 5 Minuten pro 30 Minuten Video, zuzüglich Download |
| Internetvideo ohne Helfer | Audioaufnahme mit `Alt+Shift+M` oder dem Schalter im Erweiterungsmenü aktivieren | Echtzeit, mit einigen Sekunden Verzögerung |

**Modelle.**

| Modell | Download | Einsatz |
|---|---|---|
| Automatisch | | Standard. Haas-ja für gesprochenes Japanisch, Parakeet für gesprochenes Englisch und Deutsch und Whisper Turbo für Lieder |
| Haas-ja | 1,3 GB | Nur Japanisch. Am genauesten und schnellsten bei gesprochener Sprache, auch mit Hintergrundmusik, und mit Satzzeichen |
| Parakeet | 1,3 GB | Englisch und Deutsch. Am genauesten und schnellsten bei gesprochener Sprache, auch mit Hintergrundmusik, mit Satzzeichen und den genauesten Zeiten |
| Whisper Turbo | 1,5 GB | Am besten für Lieder |
| Whisper Turbo leicht | 564 MB | Etwas ungenauer, mit weniger Grafikspeicher |
| Whisper Base | 165 MB | Für Computer ohne leistungsstarke GPU |

Im automatischen Modus gilt ein Video als Lied, wenn sein Liedtext eingefügt wurde, wenn die Website es als Musik einstuft oder wenn der Titel es sagt, etwa „MV“ oder „歌ってみた“. Bei gesprochenem Japanisch macht Haas-ja 3 % Fehler gegenüber 9 % bei Whisper Turbo und transkribiert 30 Minuten in etwa einer Minute statt in etwa 5. Bei Liedern schreibt es nur einen Teil des Gesungenen, und dort ist Whisper Turbo besser. Im Englischen gilt dasselbe für Parakeet: 6,8 % Fehler gegenüber 9,6 % bei Whisper Turbo und dreimal genauere Zeiten. Während der Transkription zeigt das Panel, welches Modell arbeitet.

Die Modelle werden im Browser gespeichert und nicht erneut heruntergeladen: Sie werden jedes Mal von der Festplatte gelesen, was einige Sekunden dauern kann. Unter **Einstellungen, Sprachtranskription, Gespeicherte Modelle** ist zu sehen, wie viel Platz jedes belegt, und es lässt sich dort löschen. Beim Deinstallieren der Erweiterung werden sie ebenfalls gelöscht.

**Intensität.** Sie bestimmt, welchen Anteil der Zeit die Grafikkarte arbeitet. In der restlichen Zeit ruht sie, und die Ruhezeit wächst von selbst, wenn eine andere Anwendung die Karte belegt.

| Intensität | Auslastung | 30 Minuten Video |
|---|---|---|
| Automatisch | 75 % bei Benutzung des Computers, 90 % nach zwei Minuten ohne Benutzung | Etwa 5 Minuten |
| Sanft | 30 % | Etwa 12 Minuten |
| Schnell | 90 % | Etwa 4 Minuten |

Während der Transkription lässt sich anhalten, um die Karte sofort freizugeben, und an derselben Stelle fortsetzen. Startet der Grafiktreiber neu, wartet Whisper 20 Sekunden, lädt das Modell neu und arbeitet mit der niedrigsten Intensität weiter. Beim zweiten Ausfall hält es an, und das bereits Transkribierte bleibt gespeichert.

### Liedtexte

Whisper trifft die Zeiten, verfehlt in einem Lied aber viele Wörter. Wenn jemand den Text veröffentlicht hat, zum Beispiel in einem Kommentar zum Video, lässt er sich im Fenster **KI-Untertitel** unter **Liedtext** einfügen, und Claude legt ihn auf diese Zeiten.

- Claude gibt nur an, welcher Vers über welchen Zeilen der Transkription erklingt. Die Wörter stammen genau aus dem Liedtext, die Zeiten von Whisper.
- Wird der Text vor oder während der Transkription eingefügt, wird er am Ende automatisch abgeglichen, und es fallen keine Kosten für das Korrigieren oder Prüfen des von Whisper Gehörten an. Hat das Video bereits eine Spur, kann auch sie mit **Liedtext an diese Zeiten anpassen** als Zeitreferenz dienen.
- Ein nur einmal geschriebener Refrain wird überall dort platziert, wo er erklingt. Was nicht gesungen wird, etwa Abschnittsmarken, Rōmaji oder Übersetzungen, wird ignoriert.
- Ein Vers, den Whisper nicht erfasst hat, erhält eine geschätzte Zeit, und der abschließende Hinweis nennt deren Anzahl. Mit **Synchronisieren: Diese Zeile ist gerade zu hören** im Navigator lässt sich dann nachjustieren.
- Das Ergebnis ist eine weitere Spur, „Japanisch (Liedtext)“, die für dieses Video gespeichert wird. Die ursprüngliche Transkription bleibt verfügbar. Pro Lied fällt eine einzige Anfrage an Claude an, und ein erneuter Abgleich mit demselben Text kostet nichts.
- Bei einem Internetvideo ohne lokalen Helfer muss Whisper das ganze Lied hören: Wenn das Video endet, stoppt die Transkription von selbst, und der Text wird abgeglichen.

### Lokaler Helfer

Eine Erweiterung kann das Audio eines Videos nicht selbst herunterladen. Der Helfer ist ein kleines lokales Programm, das dies mit [yt-dlp](https://github.com/yt-dlp/yt-dlp) und FFmpeg erledigt. Er benötigt Python, und sein Installationsprogramm ergänzt yt-dlp, falls es fehlt. Er wird einmal aus dem Projektordner installiert:

```bash
powershell -ExecutionPolicy Bypass -File herramientas\ayudante\instalar.ps1
```

Danach muss die Erweiterung unter `edge://extensions` oder `chrome://extensions` neu geladen werden. Der Status lässt sich unter **Einstellungen, Transkription** prüfen.

| Aspekt | Verhalten |
|---|---|
| Reichweite | Nur die Erweiterung kann ihn aufrufen, und er akzeptiert nur http- oder https-Adressen |
| Registrierung | Fügt einen Benutzerschlüssel in `HKCU` hinzu, ohne Administratorrechte |
| Dateien | Verwendet einen temporären Ordner, der am Ende oder beim Abbruch gelöscht wird |
| Kennung | Wird die Erweiterung aus einem anderen Ordner geladen, ändert sich ihre Kennung: Sie wird mit `-Extension` angegeben und steht auf der Erweiterungsseite |
| Deinstallation | Derselbe Befehl mit `-Quitar` |

Lässt sich ein Video nicht herunterladen, etwa weil es privat oder altersbeschränkt ist, bietet der Hinweis an, es während der Wiedergabe zu transkribieren.

## Karten

| Kürzel | Aktion |
|---|---|
| `Q`, `Alt+Q` | Erstellt eine Karte mit dem aktuellen Wort und Satz |
| `E` | Sendet das Wort, die Auswahl oder das Bild unter der Maus an den Karten-Ersteller |

Karten lassen sich über AnkiConnect an Anki senden, mit einem eigenen Notiztyp oder dem der Erweiterung, oder im **Gedächtnis** speichern, der eingebauten Wiederholung mit FSRS. Die Felder umfassen Satz, Furigana, Übersetzung, Definitionen, Audio, Bild und Notizen. Die Audioaufnahme wird mit `Alt+Shift+M` oder dem Schalter im Erweiterungsmenü aktiviert.

**Audio und Bild des Videos.** Um das Audio eines Satzes aufzunehmen, muss die Aufnahme im Tab des Videos aktiviert werden, mit `Alt+Shift+M` oder dem Schalter im Erweiterungsmenü. Die Aufnahme gilt nur für diesen Tab: Ist sie in einem anderen aktiv, erscheint das Mikrofonsymbol ausgeschaltet und die Karte wird ohne Audio erstellt. Beim Erstellen der Karte wird die Zeile in normaler Geschwindigkeit erneut abgespielt und aufgenommen, danach steht das Video wieder an seiner Stelle. Das Bild enthält nichts von der Oberfläche. Auf Websites mit DRM wie Netflix liefert der Browser das Einzelbild schwarz: Die Karte erhält dann das offizielle Bild der Folge oder gar keines, wenn die Website keines anbietet. Eine geschützte Website kann auch ihren Ton vorenthalten: Die Karte wird ohne Audio erstellt, und nach zwei stummen Sätzen in Folge in einem Video wird die Zeile nicht mehr zur Aufnahme erneut abgespielt.

## Audio, Bilder und Beispiele

| Element | Quelle | Schlüssel nötig? |
|---|---|---|
| Audio des Wortes | JapanesePod101 und Lingua Libre über Wikimedia Commons | Nein |
| Audio des Satzes | Mit `tabCapture` aus dem Tab aufgenommen, auf dem eigenen Computer, und in MP3 umgewandelt | Nein |
| Synthetische Stimmen | Azure Speech, falls eingerichtet. Sonst die Systemstimmen, nur zum Anhören | Nur für Azure |
| Bilder | Openverse, mit der ersten englischen Glosse von JMdict als Suchbegriff | Nein |
| Einzelbild | Aufnahme aus dem Video, auf dem eigenen Computer | Nein |
| Beispiele | Bereits gesehene Sätze, im Browser gespeichert | Nein |
| Beispielsatz für eine Karte | Claude, nur wenn die Karte keinen Satz hat | Claude |

## Webseiten, Reader und Bibliothek

**Webseiten.** Auf jeder Seite mit japanischem Text unterstreicht der Reader die Wörter nach ihrem Lernstand und ergänzt Furigana. Ein Klick auf ein Wort öffnet sein Wortfenster. Bei Links und Schaltflächen bleibt der Klick bei der Website; das Wortfenster öffnet sich, wenn die Maus darauf ruht, oder sofort mit `Shift`. Ziehen wählt weiterhin Text aus, und bei geöffnetem Wortfenster funktionieren `1` bis `4` und `Q`.

Die Schaltfläche am rechten Rand passt Farben und Furigana an, ohne die Seite zu verlassen, und das Erweiterungsmenü schaltet den Reader ein und aus. Furigana haben vier Modi: bei allen Wörtern, nur bei neuen, beim Überfahren mit der Maus oder nie. Unter **Einstellungen, Seiten-Reader** lässt sich festlegen, dass sich das Wortfenster immer beim Überfahren öffnet oder dass auch der Klick auf Links nachschlägt.

Nichts davon fügt dem Inhalt der Seite etwas hinzu. Die Farben verwenden die CSS Custom Highlight API, und die Lesungen liegen auf einer eigenen Ebene. So funktionieren Auswählen, Kopieren und Suchen wie zuvor, und Anwendungen etwa mit React werden nicht gestört. Es funktioniert auch bei dem, was in einer Box scrollt, etwa dem Gespräch in einem Chat: Die Furigana bewegen sich mit dem Text und laufen unter dem Eingabefeld hindurch. Der Reader wirkt nicht auf Textfelder oder Text auf Chinesisch oder Koreanisch.

**Zeilen auseinanderziehen.** Viele Seiten lassen wenig Platz zwischen den Zeilen, und die Furigana würden die Zeile darüber berühren. Dort wird der Zeilenabstand dieses Textes so weit wie nötig geöffnet; das ist das Einzige, was der Reader auf einer Seite bewegen kann. Bei Schaltflächen und Menüs geschieht das nicht, ebenso wenig, wo der Text aus einer Box mit fester Höhe ragen würde: Gibt es dort gar keinen Platz, erscheinen die Furigana erst beim Überfahren. Der Schalter **Zeilen auseinanderziehen** in der Schaltfläche am Rand schaltet es ab, und dann bewegt sich das Layout gar nicht.

`Alt+K`, `Alt+U` und `Alt+I` markieren den ausgewählten Text gesammelt als bekannt, unbekannt oder ignoriert.

**Zwischenablage.** Zeigt beliebigen eingefügten oder kopierten Text mit denselben Hilfen wie die Untertitel und bewahrt seine Struktur: Absätze, Zeilenumbrüche, Überschriften, Listen, Zitate, Code, Tabellen und Fettdruck. Von einer Seite Kopiertes kommt ohne die Furigana dieser Seite, und aus dem Claude-Chat kopiertes Markdown behält seine Formatierung.

**Web-Modus.** Das Anwendungsfenster hat keine Tabs und kann daher nicht in die geteilte Ansicht des Browsers. Die Schaltfläche **Web-Modus** der Zwischenablage öffnet sie in einem normalen Tab ohne Seitenleiste, und **Zwischenablage neben diesem Tab öffnen** im Erweiterungsmenü setzt sie direkt neben die gerade angezeigte Seite (Chrome 155 oder neuer). In diesem Tab fügt **Zwischenablage folgen** unten das Japanische an, das irgendwo kopiert wird, solange der Tab sichtbar ist. Es ist eine Seite der Erweiterung selbst: Sie braucht keinen Server, funktioniert ohne Verbindung, und der Text verlässt den Computer nicht.

**Lesehilfe.** Speichert EPUB-Bücher, Texte und SRT-Untertitel samt Leseposition und der Struktur jedes Kapitels. Sie kann auch mit Claude Geschichten erzeugen, die zum eingestellten Niveau passen.

**Lokaler Player.** Spielt eigene Dateien ab, mit den eingebetteten Untertiteln einer MKV-Datei und der Wahl der Audiospur, über ffmpeg.wasm.

**Wörter und Bewertung.** Die Übersicht listet den Wortschatz nach Status, und die Niveaubewertung schätzt die anfangs bekannten Wörter.

## Englisch lernen

Die Sprache wird in der Begrüßung, unter **Einstellungen, Sprache und Niveau** oder im Menü der Erweiterung gewählt. Jede hat ihre eigenen Wörter, Wörterbücher, Karten, ihre Bibliothek und ihre Leseeinstellungen, und beim Zurückwechseln ist alles noch da. Oberfläche, Claude-Schlüssel und Kosten sind gemeinsam.

Alles, was diese Anleitung erklärt, funktioniert genauso, mit diesen Unterschieden:

| Element | Auf Englisch |
|---|---|
| Wörterbücher | Wiktionary in der Sprache der Oberfläche, in zwei Teilen: Definitionen und kurze Übersetzungen. Mit englischer Oberfläche wird das Englisch-Englisch-Wörterbuch vorgeschlagen, mit etwa 110 MB Download und etwa 220 MB Speicherplatz |
| Aussprache | Amerikanische und britische IPA im Wortfenster. Über den Wörtern ist sie anfangs ausgeschaltet und wird im Fenster **Anzeige** eingeschaltet. Welche der beiden geschrieben wird, legt **Einstellungen, Sprache und Niveau** fest |
| Akzentfarbe | Zeigt die betonte Silbe: die erste, eine mittlere oder die letzte. Auch sie ist anfangs ausgeschaltet |
| Formen | Das Wortfenster nennt das Wort, von dem jede stammt: *went* öffnet *go*, und *didn't* öffnet *do* |
| Partikelverben | Das Wortfenster sucht sie auch dann, wenn sie getrennt stehen: Bei *picked it up* erscheint *pick up*. Dasselbe gilt für feste Wendungen |
| Grammatik | Punkte von A1 bis C2, mit derselben Bestätigung durch Claude |
| Seiten-Reader | Anfangs ausgeschaltet, weil Englisch auf fast jeder Seite vorkommt. Er wird im Menü der Erweiterung oder unter **Einstellungen, Seiten-Reader** eingeschaltet |
| Striche und Korrektur der Lesungen | Nicht verfügbar |

## Deutsch lernen

Es wird wie Englisch gewählt, und alles funktioniert gleich, mit diesen Unterschieden:

| Element | Auf Deutsch |
|---|---|
| Wörterbücher | Wiktionary in der Sprache der Oberfläche, mit Definitionen und kurzen Übersetzungen, dazu Deutsch–Englisch, das immer vorgeschlagen wird, weil es die konjugierten und deklinierten Formen jedes Wortes enthält: etwa 17 MB Download. Mit deutscher Oberfläche wird auch Deutsch–Deutsch vorgeschlagen, etwa 55 MB |
| Formen | Das Wortfenster öffnet das Wort, von dem jede Form stammt, und nennt die Form: *ging* öffnet *gehen*, im Präteritum, und *Häuser* *Haus*, im Plural. Kann eine Form von zwei Wörtern stammen, wie *schönen*, gewinnt das häufigere. Artikel gehen zu *der* und *ein*, die Formen von *sein* zu *sein* |
| Trennbare Verben | Das Wortfenster sucht sie auch dann, wenn die Partikel am Satzende steht: Bei *fängt morgen an* erscheint *anfangen*. Ebenso feste Wendungen |
| Aussprache | IPA im Wortfenster, ohne regionale Varianten. Über den Wörtern ist sie anfangs aus, ebenso die Akzentfarbe, die die betonte Silbe zeigt |
| Grammatik | Punkte von A1 bis C2, etwa Perfekt, Konjunktiv, Passiv oder Nebensätze mit dem Verb am Ende, mit derselben Bestätigung durch Claude |
| Transkription | Parakeet für Sprache und Whisper Turbo für Lieder. Bei einer echten Aufnahme schrieb Parakeet mit Großschreibung und Satzzeichen, in weniger als der Hälfte der Zeit von Whisper |
| Seiten-Reader | Er ist anfangs aus. Er wird im Menü der Erweiterung oder unter **Einstellungen, Seiten-Reader** eingeschaltet |
| Strichfolge und Lesungskorrektur | Nicht verfügbar |

## Kosten für Claude

Die Startseite enthält die Karte **Kosten für Claude** mit den Ausgaben des Monats im Vergleich zum in den Einstellungen angegebenen Guthaben, einem Diagramm nach Tagen und Modellen, der Verteilung nach Aufgaben und einem Protokoll jeder Anfrage mit ihren Tokens. Die Kosten werden aus den von der API gemeldeten Tokens und ihren öffentlichen Preisen berechnet und umfassen nur das, was von dieser Erweiterung in diesem Browser angefragt wurde.

Am meisten kostet pro Video die Korrektur automatischer Untertitel, gefolgt von der Übersetzung und der Prüfung von Lesungen, Bedeutungen und Grammatik. Die Prüfung deckt einige Minuten vor der Abspielposition ab und läuft mit ihr weiter; Geprüftes bleibt gespeichert. Sie lässt sich unter **Untertitel erstellen** abschalten oder mit **Ganzes Video prüfen** für das ganze Video anfordern. Die [Kostenstudie](costs.md) nennt die gemessenen Zahlen pro Video und pro Monat.

Drei Einstellungen bestimmen, wie viel Wortanfragen genutzt werden:

| Einstellung | Wo | Standard | Wirkung |
|---|---|---|---|
| Beim Öffnen eines Wortes nach der Bedeutung fragen | Einstellungen, Claude | Aus | Jedes neu geöffnete Wort wäre eine Anfrage |
| Vollständiges Skript als Kontext | Einstellungen, Claude | Aus | Mehr Kontext für Namen und Bezüge, bei höheren Kosten pro Anfrage |
| Starttab | Einstellungen, Wörterbücher | Nur das Wörterbuch | Ein Claude-Tab würde beim Öffnen jedes Wortes fragen |

## Daten und Sicherung

Alle Daten werden im Browser in IndexedDB gespeichert. **Einstellungen, Deine Daten** erlaubt den Export und Import einer einzigen Datei mit den Wörtern, Karten, der Bibliothek, den erzeugten Untertiteln und Korrekturen jeder verwendeten Sprache sowie den Einstellungen und dem Kostenprotokoll. Der Claude-Schlüssel und die Wörterbücher sind nicht enthalten. Eine Sicherung aus der Zeit vor Version 0.4.0 wird als Japanisch wiederhergestellt.

## Tastenkürzel

Die vollständige Übersicht steht im Kürzelbereich über dem Video. Die Kürzel lassen sich unter **Einstellungen, Tastenkürzel** ändern und funktionieren auch mit koreanischer oder russischer Tastatur oder aktivierter japanischer Eingabe, da sie sich an der Position der Taste orientieren.

| Gruppe | Kürzel | Aktion |
|---|---|---|
| Leiste | `Alt+X` | Leiste fixieren oder lösen |
| | `Alt+V` | Anzeigen, solange gedrückt |
| | `Alt+T` | Übersetzer öffnen |
| Wort | `1` oder `U` | Als unbekannt markieren |
| | `2` oder `T` | Verfolgen |
| | `3` oder `K` | Als bekannt markieren |
| | `4` oder `I` | Ignorieren |
| | `N` | Zum nächsten unbekannten Wort gehen |
| | `Alt+S` | Im Wörterbuch nachschlagen |
| Karten | `Q`, `Alt+Q` | Karte erstellen |
| | `E` | An den Karten-Ersteller senden |
| | `Alt+Shift+M` | Audioaufnahme erlauben |
| Auswahl | `B` | Untertitel markieren |
| | `L` | Untertitel auswählen |
| | `J` | Ausgewählte zusammenführen |
| Video | `A` oder `←` | Vorheriger Untertitel |
| | `D` oder `→` | Nächster Untertitel |
| | `S` oder `↓` | Untertitel wiederholen |
| | `Alt+→`, `Alt+←` | 5 Sekunden vor oder zurück |
| Untertitel | `R` | Alles ein- oder ausblenden |
| | `W` oder `↑` | Japanisch ein- oder ausblenden |
| | `G` | Untertitel-Navigator |
| | `C` | Untertitel kopieren |
| | `Alt+Shift+G` | Zweituntertitel erstellen |
| Anwendung | `Alt+Shift+K` | Kotonoha-Fenster öffnen |

## Häufige Probleme

| Symptom | Ursache und Lösung |
|---|---|
| Nach dem Kompilieren ändert sich nichts | Der Browser behält den vorherigen Service Worker. Auf der Erweiterungsseite muss **Neu laden** gedrückt werden |
| „Um das Video zu hören, muss die Audioaufnahme aktiviert sein“ | Chrome verlangt eine Benutzeraktion, um einen Tab aufzunehmen. Abhilfe schafft `Alt+Shift+M` oder der Schalter im Erweiterungsmenü, im Tab des Videos |
| Ein Kürzel wie `Alt+Shift+M`, `Alt+Shift+K` oder `Alt+Q` reagiert nicht | Chrome vergibt einer Erweiterung keine Taste, die eine andere bereits hat, auch wenn diese deaktiviert ist, und weist nicht darauf hin. Das Erweiterungsmenü und der Kürzelbereich zeigen die tatsächliche Taste, die sich unter `chrome://extensions/shortcuts` ändern lässt |
| `Alt+R` oder `Alt+Z` öffnen Radeon Software | Das sind Kürzel dieser Anwendung auf Computern mit AMD-Grafik. Kotonoha verwendet `Alt+Shift+M` und `Alt+V` |
| Die Oberfläche erscheint ohne Unschärfe | Bei ausgeschalteter Hardwarebeschleunigung verliert die Unschärfe über dem Video Bilder, daher ersetzt die Erweiterung sie durch einen dichteren Hintergrund |
| Whisper läuft sehr langsam | Der Browser bietet keinen Zugriff auf die GPU. Die Hardwarebeschleunigung in seinen Einstellungen sollte geprüft werden |
| Der Helfer erscheint nicht als installiert | Nach dem Installationsprogramm muss die Erweiterung neu geladen werden. Wurde sie aus einem anderen Ordner geladen, ist ihre Kennung mit `-Extension` anzugeben |
| Ein Video lässt sich nicht herunterladen | Bei Altersbeschränkung, privaten oder kostenpflichtigen Videos kann yt-dlp es nicht abrufen. Es lässt sich während der Wiedergabe transkribieren |
| YouTube liefert leere Untertitel | Seine Anfragen werden vom Player signiert. Es genügt, das Video einige Sekunden abzuspielen |
| Anki verbindet sich nicht | Anki muss mit AnkiConnect geöffnet sein, und dessen Konfiguration muss den Ursprung der Erweiterung zulassen. Die Erweiterung fragt beim ersten Mal um Erlaubnis |
