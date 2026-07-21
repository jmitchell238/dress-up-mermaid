# Mermaid Dress-Up — Architecture

A dependency-free, single-page PWA. No build step, no framework. Plain HTML +
CSS + vanilla JS drawing to one `<canvas>`. Designed for creative free play for
ages 4–6 (no fail screens).

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Shell: canvas `#cv`, the menu screen DOM, script load order. |
| `css/style.css` | Menu-card + chrome styling. Gameplay is drawn on the canvas, not the DOM. |
| `js/config.js` | Pure data: version, stage size (`W`×`H`), catalogs (`LOOKS`, `CROWNS`, `JEWELRY`, `PROPS`, `BACKGROUNDS`), `CATEGORIES`, `DEFAULT_OUTFIT`, `LAYER_ORDER`. |
| `js/assets.js` | Image loading/caching, layer resolution, and **accessory placement** (`ACCESSORY_LAYOUT`, `accessoryRect`, `anchorOffsetY`). |
| `js/save.js` | `save` state, persistence to `localStorage`, favorites. |
| `js/audio.js` | WebAudio sound effects. |
| `js/particles.js` | Bubbles / confetti / praise-text particles. |
| `js/game.js` | Game state machine, layout (`rebuildHits`), input resolution (`handleTap`), and all canvas drawing (`drawPlay`, `drawPlayChrome`). |
| `js/main.js` | DOM wiring, canvas sizing, the rAF loop, and **pointer gestures** (tap vs. tray swipe). |
| `sw.js` | Service worker; precaches the shell. `CACHE` must track `GAME_VERSION`. |
| `tests/run.mjs` | Node test runner (no deps, no browser). |

Scripts load in dependency order (`config → assets → save → audio → particles →
game → main`); everything shares one global scope on purpose — there are no
modules at runtime. `tests/run.mjs` re-bundles the same files in a `vm` sandbox.

## Coordinate system

All gameplay is authored in a fixed **390×700** logical stage (`W`, `H`).
`resizeCanvas` in `main.js` scales that stage to the viewport and applies a DPR
transform, so every draw/hit coordinate in `game.js` is in logical stage units.
`eventToStage` maps pointer events back into the same units.

## Frame loop

`main.js#frame` runs each animation frame: `updatePlay(dt)` advances timers and
particles, then `drawPlay(ctx)` repaints. There is no retained scene graph — the
canvas is cleared and fully redrawn every frame from `save.outfit` + transient
state (`danceT`, `equipFlash`, `trayScroll`, …).

## Character + accessory rendering

The mermaid is a stack of full-frame PNGs (`LAYER_W`×`LAYER_H` = 768×1024) drawn
back-to-front per `LAYER_ORDER` (`bg → look → jewelry → crown → prop`).

`drawLayeredOutfit` (in `game.js`):
1. Contain-fits the `look` art into the destination rect (never stretched — the
   view box is kept ~3:4 portrait; see `MERMAID_VIEW`).
2. Snaps each accessory to the character using the drawn look rect, so
   accessories track the mermaid as she bobs/dances.

### Accessory alignment

Accessories are **not** placed against the canvas edge. They are placed against
the character *content box* — the non-transparent bounds of the reference art
(`gold-teal.png`), captured once as `LOOK_CONTENT` (`73,65 → 698,990` in the
768×1024 frame).

`ACCESSORY_LAYOUT[key]` gives `{ x, y, w, h }` as **fractions of that content
box**, plus an `anchor` describing how the contain-fit art seats vertically in
its box (so crowns/necklaces of different heights all land correctly):

- `crown` — `anchor: 'bottom'`: the crown base rests on the top of the hair.
- `jewelry` — `anchor: 'top'`: the necklace hangs down from the neck.
- `prop` — `anchor: 'center'`: the handheld item sits by her hand.

`accessoryRect` maps a layout into a pixel box within the drawn look rect;
`anchorOffsetY` computes the vertical seat. **These values were tuned visually**
using `scripts/preview-align.mjs` — a headless PNG compositor that mirrors the
game's exact draw math, so you can eyeball placement without a browser:

```
node scripts/preview-align.mjs <look> <crown> <jewelry> <prop> [out.png]
# e.g. node scripts/preview-align.mjs gold-teal crystal shell-choker mirror
```

Because accessory art has different aspect ratios, always re-check the *hard*
cases when tuning: tall crowns (`crystal`) and long pendant necklaces
(`shell-choker`, `gold-chain`, `gem-blue`), not just the choker/tiara. When
re-tuning, change only the fractions/anchors in `ACCESSORY_LAYOUT` — the draw and
hit code stay generic. Keep the `ACCESSORY_LAYOUT` copy in the script in sync.

Because the fractions are relative to the gold-teal content box, poses whose art
sits differently in the frame (`pose-*`) will align slightly less precisely; the
common styles all share gold-teal's framing.

## Play-screen chrome + the item tray

`rebuildHits` recomputes hit regions whenever layout-affecting state changes
(category, equip, favorites, scroll). Regions: `hitCats` (category tabs),
`hitTray` (item cells), `hitButtons` (actions + favorites). `drawPlayChrome`
renders them; `handleTap` resolves a tap by testing the same regions.

**Tray scrolling.** The tray uses **fixed-size cells** (`TRAY.cell`) laid out
left-to-right. When the row overflows the viewport (`TRAY.w`) the extra content
scrolls horizontally instead of squashing:

- `trayScroll` / `trayScrollMax` hold the offset and its clamp bound.
- Cells center when everything fits, and left-align (offset by `trayScroll`)
  when they overflow.
- Rendering is clipped to the tray viewport; chevron/fade cues (`drawTrayScrollHint`)
  appear at an edge when there is more to see.
- `handleTap` resets `trayScroll` on category change.

**Gestures** (`main.js`). A press becomes a **swipe** once horizontal movement
passes `DRAG_THRESHOLD` and dominates vertical movement; swipes that started in
the tray band (`inTrayBand`) drive `scrollTray`. A press that never crosses the
threshold fires `handleTap` on release. This tap-on-release model is what lets a
single pointer serve both tapping items and swiping the tray.

## Versioning + updates

`GAME_VERSION` (`config.js`) and the `CACHE` name (`sw.js`) must move together —
a test enforces it. `main.js` polls `config.js` and the SW for a version change
and reloads when safe (never mid-play). Bump both on any shipped change.

## Testing

`node tests/run.mjs` — zero-dependency runner. It bundles the game files into a
`vm` sandbox with stubbed `Image`/`localStorage`/`document`, exercises the pure
logic (outfit rules, favorites, play flow, **accessory alignment**, **tray
scroll**), and verifies every catalog asset exists on disk. Keep it green (100%)
before committing. Add assertions here for any new gameplay logic.
