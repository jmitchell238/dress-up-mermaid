# Mermaid Dress-Up

Dress up a mermaid with different looks, crowns, necklaces and things to hold, in a choice of underwater scenes. Save your favorites and show them off with bubbles. Free creative play for ages 4–6.

Play at https://jmitchell238.github.io/dress-up-mermaid/. It's one of the games in [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

The art is illustrated, layered sprites rather than shapes drawn in code.

## Modes

| Mode | Description |
|------|-------------|
| Free Play | Try on anything, no goals |
| Match Me | Copy the outfit on the faded mermaid to get a cheer |

## Features

- 13 mermaid looks: 10 color styles and 3 poses (Wave, Side, Swim)
- 5 scenes, 6 crowns, 6 necklaces and 5 things to hold
- Save up to 8 favorite outfits
- A Surprise button for a random look, and a Show off button for a dance and bubbles
- Mute and Calm motion settings
- Installable PWA that works offline after the first visit

There are no lives, ads, accounts or fail screens.

Plans for more content are in [ROADMAP.md](./ROADMAP.md), and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) explains how the game is put together.

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

Plain HTML, CSS and canvas with no build step. The art is PNG layers in `art/layers/`, cut out from source images with the scripts in `scripts/`. The source images (`.art-raw/`) aren't committed.

## Tests

```bash
node tests/run.mjs
```

## Versioning

When you bump `GAME_VERSION` in `js/config.js`, set `CACHE` in `sw.js` to `'dress-up-mermaid-' + GAME_VERSION`.

## License

Personal project for the family.
