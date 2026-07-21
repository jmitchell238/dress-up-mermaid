# Mermaid Dress-Up — AI working instructions

Guidance for Claude / AI agents working in this repo. Read
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) first — it explains how the game
is put together. This file is about *how to work here*.

## What this project is

A tiny, dependency-free PWA dress-up game for young children (ages 4–6). Plain
HTML/CSS/vanilla JS rendering to one canvas. **No build step, no framework, no
npm packages.** Keep it that way unless the owner explicitly asks otherwise.

## Golden rules

- **Fix what was asked, then stop.** No unsolicited refactors, optimizations, or
  "while I was here" changes. Ask first.
- **Preserve the art and the kid-friendly feel.** No fail states, no score
  pressure, nothing that reads as scary.
- **No new dependencies or build tooling** without explicit approval.
- **Always run `node tests/run.mjs` after changes** and keep it at 100% pass
  before committing. Add tests for new logic.
- **Bump `GAME_VERSION` (`js/config.js`) and `CACHE` (`sw.js`) together** for any
  shipped change — a test enforces they match, and it drives client auto-update.

## Where things live

- Gameplay logic and drawing → `js/game.js`
- Data/catalogs (add a crown, look, prop, scene…) → `js/config.js`
- Accessory placement / image handling → `js/assets.js`
- Input, canvas sizing, gestures → `js/main.js`
- Tests → `tests/run.mjs`

Full map and rendering pipeline: `docs/ARCHITECTURE.md`.

## Common tasks

**Add a wearable item.** Add art under `art/layers/<category>/`, add an entry to
the matching catalog in `config.js` (with `swatch`), and confirm
`node tests/run.mjs` still lists the asset and passes. Item catalogs drive the
tray, the loader, and the SW precache automatically.

**Adjust accessory alignment.** Edit only `ACCESSORY_LAYOUT` (fractions +
`anchor`) in `js/assets.js` — do not special-case items in the draw loop. Values
are fractions of the character content box and were tuned against `gold-teal.png`.
Verify visually before/after; keep the alignment assertions in `tests/run.mjs`
green. See `docs/ARCHITECTURE.md → Accessory alignment`.

**Touch the tray or input.** Tray geometry is `TRAY` in `js/game.js`; scrolling
is `trayScroll`/`scrollTray`; gestures (tap vs. swipe) live in `js/main.js`.
Cells are a fixed size and scroll on overflow — never shrink cells to fit.

## Coordinates

Everything is authored in a fixed 390×700 logical stage (`W`×`H`). Draw and
hit-test in those units; `main.js` handles scaling and DPR. Don't hardcode
device pixels.

## Verifying visual changes

There is no browser in CI. For alignment/layout work, prefer a small headless
check (a Node PNG compositor that mirrors the game's draw math) or open
`index.html` locally. Don't guess pixel positions — measure or render.

## Commits (owner preferences)

- Do **not** add co-author/trailer lines unless explicitly asked.
- Do **not** push without confirming the remote first.
- Include **all** modified files; double-check core files aren't left out.
