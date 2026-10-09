# Development

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

When you bump `GAME_VERSION` in `js/config.js`, set `CACHE` in `sw.js` to `'dress-up-mermaid-' + GAME_VERSION`. The tests check that they match.
