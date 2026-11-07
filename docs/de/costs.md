<p align="right"><a href="../costos.md">Español</a> · <a href="../costs.md">English</a> · <b>Deutsch</b> · <a href="../zh/costs.md">简体中文</a> · <a href="../ko/costs.md">한국어</a> · <a href="../ja/costs.md">日本語</a></p>

# Kosten der Claude-API

Was die Nutzung von Kotonoha mit einem eigenen Claude-API-Schlüssel kostet, gemessen mit echten Videos am 5. November 2026. Die Karte **Kosten für Claude** auf der Startseite zeigt den genauen Verbrauch jeder Installation anhand der von der API gemeldeten Tokens.

Untertitel, Wörterbuch, Furigana, Karten, Wiederholung und die Transkription mit Whisper verwenden die API nicht und kosten nichts.

## Zusammenfassung

Mit dem Referenzguthaben von 100 USD im Monat:

| Videonutzung | Kosten pro Stunde | Stunden im Monat mit 100 USD |
|---|---|---|
| Automatische Untertitel, mit Korrektur, Prüfung und Übersetzung | 1,39 USD | 62 |
| Automatische Untertitel, mit Korrektur und Prüfung | 1,00 USD | 82 |
| Manuelle Untertitel, mit Prüfung und Übersetzung | 0,75 USD | 104 |
| Manuelle Untertitel, mit Prüfung | 0,36 USD | 175 |

Die Stunden in der letzten Spalte enthalten 30 Wortanfragen pro Videostunde. Ein Video erneut anzusehen kostet nichts, denn Geprüftes, Korrigiertes und Übersetztes bleibt gespeichert.

## Messungen

Jeder Wert wurde aus dem Guthaben der Claude Console vor und nach dem Vorgang ermittelt, mit den Standardmodellen und -aufwänden. Das Guthaben hat eine Auflösung von einem Cent, sodass jeder Wert eine Spanne von ±0,01 USD hat.

| Vorgang | Video | Gemessene Kosten |
|---|---|---|
| Prüfung von Lesungen, Bedeutungen und Grammatik | 6:41, manuelle Untertitel | 0,04 USD |
| Korrektur und Prüfung | 10:46, automatische Untertitel, 154 Zeilen | 0,18 USD |
| Übersetzung ins Spanische | Dasselbe Video, 150 Zeilen | 0,07 USD |
| Bedeutung im Satz, mit dem vollständigen Skript als Kontext | 5 Wörter | 0,03 USD |

Pro Videostunde ergeben sich diese Sätze. Die Korrektur ergibt sich, indem die Prüfung von der zweiten Messung abgezogen wird.

| Aufgabe | Pro Videostunde | Pro 10 Minuten |
|---|---|---|
| Korrektur automatischer Untertitel | 0,64 USD | 0,11 USD |
| Übersetzung | 0,39 USD | 0,07 USD |
| Prüfung von Lesungen, Bedeutungen und Grammatik | 0,36 USD | 0,06 USD |

Die Kosten hängen davon ab, wie viel gesprochen wird. Diese Videos haben rund 14 Zeilen pro Minute, und ein Video mit mehr Dialog kostet entsprechend mehr.

### Wortanfragen

| Anfrage | Ungefähre Kosten | Herkunft |
|---|---|---|
| Ein Wort öffnen: Wörterbuch | 0 USD | Keine Anfrage |
| Zu einem bereits angefragten Wort in diesem Satz zurückkehren | 0 USD | Kommt aus dem Gespeicherten |
| Was bedeutet es in diesem Satz? | 0,006 USD | Gemessen und als Höchstwert: Die Messung enthält das vollständige Skript |
| Erklären, Analyse | 0,01 USD | Aus den Tokens geschätzt |
| Einen Satz übersetzen | 0,002 USD | Aus den Tokens geschätzt |
| Vertiefen, mit Opus 5.5 | 0,06 USD | Aus den Tokens geschätzt |
| Eine Karte mit Übersetzung und Erklärung von Claude erstellen | 0,012 USD | Aus den Tokens geschätzt. Lässt sich unter Einstellungen, Karten und Anki abschalten |

## Pro Video

| Video | Ohne Übersetzung | Mit Übersetzung |
|---|---|---|
| YouTube, 20 Minuten, automatische Untertitel | 0,33 USD | 0,46 USD |
| Folge mit 24 Minuten, manuelle Untertitel | 0,14 USD | 0,30 USD |
| Film mit 2 Stunden, manuelle Untertitel | 0,72 USD | 1,50 USD |

## Pro Monat

Mit automatischen Untertiteln, Übersetzung und 30 Wortanfragen pro Videostunde:

| Nutzung | Stunden im Monat | Video | Anfragen | Gesamt | Vom Guthaben von 100 USD |
|---|---|---|---|---|---|
| 20 Minuten am Tag | 10 | 13,90 USD | 2,10 USD | 16 USD | 16 % |
| 1 Stunde am Tag | 30 | 41,70 USD | 6,30 USD | 48 USD | 48 % |
| 2 Stunden am Tag | 60 | 83,40 USD | 12,60 USD | 96 USD | 96 % |
| 3 Stunden am Tag | 90 | 125,10 USD | 18,90 USD | 144 USD | Überschritten |

Mit manuellen Untertiteln und ohne Übersetzung, weil das Video sie bereits in der eigenen Sprache hat:

| Nutzung | Stunden im Monat | Video | Anfragen | Gesamt | Vom Guthaben von 100 USD |
|---|---|---|---|---|---|
| 1 Stunde am Tag | 30 | 10,80 USD | 6,30 USD | 17 USD | 17 % |
| 3 Stunden am Tag | 90 | 32,40 USD | 18,90 USD | 51 USD | 51 % |

## Preise

Preise pro Million Tokens in Dollar. Das Nachdenken des Modells wird als Ausgabe berechnet.

| Modell | Eingabe | Ausgabe | Cache lesen | Cache schreiben, 5 Min. | Cache schreiben, 1 Std. |
|---|---|---|---|---|---|
| Claude Sonnet 5.5 | 2 | 10 | 0,20 | 2,50 | 4 |
| Claude Opus 5.5 | 4 | 20 | 0,20 | 5 | 8 |
| Claude Haiku 5.5 | 0,10 | 0,50 | 0,01 | 0,125 | 0,20 |

## Wie Kosten vermieden werden

| Maßnahme | Wirkung |
|---|---|
| Das Wortfenster öffnet sich mit dem Wörterbuch | Das Überfahren eines Wortes macht keine Anfrage mehr |
| Jede Antwort wird 90 Tage pro Wort und Satz gespeichert | Das Hin und Her zwischen Wörtern oder die Rückkehr zum selben Video kostet nichts |
| Eine laufende Anfrage wird nicht abgebrochen | Der Wechsel zu einem anderen Wort wirft das bereits Bezahlte nicht weg: Es wird beendet, gespeichert und bleibt verfügbar |
| Zwei gleiche Anfragen zur selben Zeit teilen sich eine Anfrage | Ungeduld wird nicht zweimal bezahlt |
| Die Prüfung schreitet mit dem Video voran | Einen Film nach 10 Minuten abzubrechen kostet nicht den ganzen Film |
| Das vollständige Skript ist bei Anfragen optional | Jede Anfrage sendet 40 Zeilen Kontext, nicht das ganze Video |

## Wie sich weniger ausgeben lässt

| Einstellung | Wo | Ersparnis pro Videostunde |
|---|---|---|
| Nur bei Bedarf übersetzen | Untertitel erstellen | 0,39 USD |
| Nicht fortlaufend prüfen | Untertitel erstellen | 0,36 USD |
| Automatische Untertitel beim Öffnen nicht korrigieren | Untertitel erstellen | 0,64 USD |
| Ein kleineres Modell oder geringerer Aufwand pro Aufgabe | Einstellungen, Claude | Hängt von der Aufgabe ab und kann die Qualität beeinflussen |

Die ersten drei lassen sich beim gewünschten Video weiterhin über ihre Schaltfläche anfordern.
