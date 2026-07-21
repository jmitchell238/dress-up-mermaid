# Mermaid Dress-Up

Dress a beautiful mermaid with illustrated looks, crowns, gems, props, and underwater scenes. Save favorites, show off with bubbles. Creative free play for ages **4–6**.

**Play:** https://jmitchell238.github.io/dress-up-mermaid/

Part of [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

> **Graphics:** real illustrated layered sprites (commercial princess-mermaid style) — not canvas shape blobs.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for phases, art strategy, and expansion plans.

## Modes

| Mode | What |
|------|------|
| Free Play | Tap cosmetics forever — no goals |
| Match Me | Copy the little ghost outfit for a cheer |

## Features (v1)

- **13 mermaids** (10 color styles + Wave / Side / Swim poses)
- **5 scenes**, **6 crowns**, **6 necklaces (Gems)**, **5 handheld toys (Hold)**
- Save up to 8 favorite outfits
- Surprise random look + show-off dance/bubbles
- Sound mute + reduced motion
- Offline PWA after first visit
- Zero fail screens

## Stack

Static HTML / CSS / Canvas. No build step.  
Art: PNG layers under `art/layers/` (chroma-keyed from `.art-raw/`).

## Tests

```bash
node tests/run.mjs
```

## Versioning

`GAME_VERSION` in `js/config.js` ↔ `CACHE` in `sw.js`.

## Local preview

```bash
python3 -m http.server 8080
```

## Parents

No lives, ads, accounts, or fail screens. Creative play only.

## License

Personal project for family Arcade Hub.
