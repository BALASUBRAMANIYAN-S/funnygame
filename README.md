# Vicky & Mrunal Runner

A Chrome-Dino-style endless runner built with plain HTML, CSS and JavaScript. Run through the desert, jump and duck over obstacles, and beat your high score.

## Features

- Endless runner with an animated skeletal runner wearing a real character head cut-out
- Day / night cycle and a parallax desert background
- Sound effects generated in code with the Web Audio API (no audio files needed)
- Sound on/off setting remembered between visits
- High score tracking
- Pause, resume and restart screens
- Mobile-friendly on-screen **Jump**, **Duck** and **Attack** buttons (the Attack button is hidden until it is needed)

## Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Start / Jump | `Space`, `↑` or `W` | Jump button |
| Duck | `↓` or `S` (hold) | Duck button |
| Pause | `P` | Pause button |
| Restart after game over | `R` | Restart button |

## How to run

No build step is needed.

```bash
git clone https://github.com/BALASUBRAMANIYAN-S/funnygame.git
cd funnygame
```

Open `index.html` in a browser, or serve it locally:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Project Structure

```
├── index.html                  # Game page and overlays (loading, start, pause, game over)
├── style.css
├── game.js                     # Game engine, audio, controls, rendering
├── character_head_base64.js    # Character head image embedded as base64
├── export_asset.py             # Script that creates the base64 file from character_head.png
├── hero.png, hero1.png, heroin.png
└── enemy1.png, ememy2.png      # Enemy sprites
```

## Regenerating the character head

`export_asset.py` converts `character_head.png` into `character_head_base64.js`:

```bash
python export_asset.py
```

Put your own `character_head.png` next to the script first.

## Ideas for next steps

- Add more enemies and a story mode
- Add level and speed progression
