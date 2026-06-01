# Mini-Jogo de Basquetebol 3D

**ICG 2025/2026 — Introduction to Computer Graphics**  
Individual project by Rafael Soares

A browser-based 3D basketball mini-game built with Three.js and Cannon.js.

---

## How to Run

The project is a set of static files — no build step or package manager needed.

**Option 1 — VS Code Live Server** (recommended)  
1. Open the project folder in VS Code.  
2. Install the "Live Server" extension (if not already installed).  
3. Right-click `index.html` → **Open with Live Server**.  
4. A browser tab opens automatically.

**Option 2 — Python HTTP server**  
```bash
# Python 3
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

**Option 3 — Any other local HTTP server**  
> ⚠️ Opening `index.html` directly as a `file://` URL will fail due to ES module CORS restrictions. Always use a local server.

---

## Controls

| Action | Input |
|---|---|
| Move player | WASD |
| Rotate camera | Hold right mouse button + drag (third-person) |
| Charge shot | Hold left mouse button |
| Release shot | Release left mouse button |
| Toggle camera mode | C |
| Look around (first-person) | Mouse (pointer lock) |

**Shooting tip:** The power bar fills while you hold. Release inside the **green zone** for a perfect shot. The further you are from the hoop, the smaller the perfect window.

---

## Features

- Free movement inside a full 28×15 m basketball court
- Dribbling animation (frequency increases when moving)
- Shooting with power bar, timing window, and trajectory preview
- Realistic ball physics via Cannon.js (gravity, rim/backboard collisions)
- Ball arc trajectory — launch angle computed from distance
- Basket detection and score update (2PT / 3PT)
- Field goal percentage tracker in HUD
- Day/night lighting cycle with spotlights
- Net rope simulation (Verlet integration)
- Procedural player model with idle, dribble, shoot, and celebrate animations
- Customisable jersey/shorts/ball colour and jersey number
- Procedural audio (Web Audio API) — swish, rim hit, dribble
- Outdoor park environment with NPCs, trees, birds

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| [Three.js](https://threejs.org/) | 0.128.0 | 3D rendering (WebGL) |
| [Cannon.js](https://github.com/schteppe/cannon.js) | 0.6.2 | Physics simulation |

Both loaded from CDN — no installation required.

All geometry is procedurally generated. All textures are canvas-rendered at runtime. No external assets (models, images, sound files) are used.

---

## Project Structure

```
index.html          Entry point
style.css           Main styles
ui.css              HUD / overlay styles
src/
  main.js           Game loop & orchestration
  core/
    constants.js    All tuneable parameters (court, ball, shot, physics)
    deps.js         CDN library exports
    camera.js       Third-person follow cam + first-person pointer-lock
    input.js        Keyboard & mouse input
    ui.js           HUD, power bar, customisation panel
    audio.js        Procedural sound synthesis
  game/
    shot.js         Shot power, timing window, launch angle, trajectory
    scoring.js      Basket detection & 2PT/3PT classification
  physics/
    world.js        Cannon.js world setup, collision materials
  world/
    ball.js         Basketball mesh, dribble state
    player.js       Player 3D model, animations, colour customisation
    court.js        Court geometry, hoops, backboards, hoop management
    net.js          Verlet-based net cloth simulation
    park.js         Outdoor environment
    sky.js          Sky dome
    npcs.js         Background characters
    dayNight.js     Day/night lighting cycle
docs/               Project documentation (PDFs)
```

---

## Attribution

**AI tools used during development:**

> OpenAI. (2026). *ChatGPT* [Large language model]. https://chat.openai.com

Also acknowledged in `src/main.js` header and `docs/creditos_ia_e_assets.txt`.

---

## License

MIT — Copyright 2026, rafael_soares
