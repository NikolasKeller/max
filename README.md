# ⚽ Blitzkick – Fußball-Arcade

Ein schnelles 5-gegen-5-Arcade-Fußballspiel für den Browser – gebaut mit purem
JavaScript und HTML5 Canvas, ganz ohne Abhängigkeiten oder Build-Schritt.

## Spielen

Am einfachsten per lokalem Webserver:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

Alternativ genügt auch ein Doppelklick auf `index.html`.

## Steuerung

| Taste                       | Aktion                                      |
| --------------------------- | ------------------------------------------- |
| `WASD` / Pfeiltasten        | Laufen                                      |
| `Leertaste` (halten)        | Schuss aufladen, beim Loslassen schießen    |
| `E` / `X` / `Shift`         | Passen                                      |
| `P` / `Esc`                 | Pause                                       |
| `M`                         | Ton an/aus                                  |
| `Enter`                     | Spiel starten                               |

Gesteuert wird immer automatisch der eigene Feldspieler, der dem Ball am
nächsten ist (markiert durch den gelben Ring).

## Features

- **5 gegen 5** mit Torhütern: Du (Blau) gegen die CPU (Rot)
- **Drei Schwierigkeitsgrade** (Leicht / Mittel / Schwer) und wählbare Spielzeit
- **Aufladbare Schüsse** mit Zielhilfe, Pässe in den Lauf, Dribbling am Fuß
- **Torwart-KI** mit Paraden, Fangen und Abschlag
- **Golden Goal**: Bei Gleichstand entscheidet das nächste Tor
- **Hallenfußball-Banden**: kein Aus, das Spiel läuft immer weiter
- **Pfosten, Abpraller, Blocks** – komplette 2D-Ballphysik
- **Sound** komplett prozedural per WebAudio (Pfiff, Schüsse, Publikum)
- **Effekte**: Konfetti, Screenshake, Torjubel, Stadion mit Publikum
- **Anfängerschutz**: Eigentore sind nicht möglich – Schüsse Richtung eigenes
  Tor werden automatisch neben den Pfosten geklärt
- **Demo-Modus** („Demo ansehen"): komplettes Match KI gegen KI mit HUD;
  im Hauptmenü läuft außerdem im Hintergrund ein KI-Demospiel

## Projektstruktur

```
index.html        Einstiegspunkt
css/style.css     Layout und Skalierung
js/utils.js       Geometrie- und Mathe-Helfer, Spielfeld-Konstanten
js/audio.js       Prozeduraler Sound (WebAudio)
js/input.js       Tastatur- und Maus-Eingaben
js/ball.js        Ballphysik
js/player.js      Spieler, Formation, Bewegung
js/ai.js          KI für Mitspieler, Gegner und Torhüter
js/game.js        Spielregeln, Zustände, Kollisionen, Effekte
js/render.js      Komplettes Rendering (Feld, HUD, Menüs)
js/main.js        Game-Loop
```
