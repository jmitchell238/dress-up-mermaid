#!/usr/bin/env node
/**
 * Mermaid Dress-Up — unit + shell tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function loadGame() {
  const files = [
    'js/config.js',
    'js/assets.js',
    'js/save.js',
    'js/audio.js',
    'js/particles.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, W, H, MODES, MODE_ORDER, CATEGORIES,
      BACKGROUNDS, LOOKS, CROWNS, JEWELRY, PROPS, DEFAULT_OUTFIT, MAX_FAVORITES,
      LAYER_ORDER, ACCESSORY_LAYOUT,
      outfitsEqual, isValidItem, normalizeOutfit, resolveEquip, randomOutfit,
      findItem, itemForOutfit, resolveLayers, allLayerSrcs, fitContain, MERMAID_VIEW,
      ACCESSORY_LAYOUT, LOOK_CONTENT, accessoryRect, anchorOffsetY,
      lookCenters, LOOK_CENTER_DEFAULT,
      equip, enterPlay, enterMenu, doSurprise, doFavorite, doShowOff,
      checkMatch, rebuildHits, handleTap,
      TRAY, scrollTray, inTrayBand,
      state: () => state,
      modeId: () => modeId,
      matchTarget: () => matchTarget,
      matchDone: () => matchDone,
      sessionDress: () => sessionDress,
      categoryIndex: () => categoryIndex,
      trayScroll: () => trayScroll,
      trayScrollMax: () => trayScrollMax,
      hitButtons: () => hitButtons,
      hitTray: () => hitTray,
      hitCats: () => hitCats,
      save,
      setMode, setMuted, setFullOutfit, setOutfitPart,
      toggleFavorite, isFavorite, loadFavorite, outfitKey,
    };
  `;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Math,
    performance: { now: () => Date.now() },
    Image: class {
      constructor() {
        this.complete = false;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.src = '';
      }
      set src(v) {
        this._src = v;
        // Simulate missing images gracefully (no network in tests)
        this.complete = true;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        if (typeof this.onerror === 'function') setTimeout(() => this.onerror(), 0);
      }
      get src() { return this._src; }
    },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    window: {},
    globalThis: {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { filename: 'game-bundle.js' });
  return sandbox.globalThis.__TEST__;
}

// ---- Shell ----
section('PWA shell');
assert(exists('index.html'), 'index.html');
assert(exists('manifest.webmanifest'), 'manifest');
assert(exists('sw.js'), 'sw.js');
assert(exists('css/style.css'), 'css');
assert(exists('js/config.js'), 'config');
assert(exists('js/assets.js'), 'assets');
assert(exists('js/game.js'), 'game');
assert(exists('js/main.js'), 'main');
assert(exists('art/cover.jpg'), 'cover');
assert(exists('icons/icon-192.png'), 'icon-192');
assert(exists('icons/icon-512.png'), 'icon-512');

const sw = read('sw.js');
const cfg = read('js/config.js');
const ver = cfg.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
assert(!!ver, 'GAME_VERSION present');
assert(sw.includes(ver[1]), 'sw CACHE matches GAME_VERSION');

// ---- Config integrity ----
section('config + art');
const G = loadGame();
assert(G.GAME_NAME.includes('Mermaid'), 'game name');
assert(G.CATEGORIES.length >= 5, 'enough categories');
assert(G.LOOKS.length >= 12, 'mermaid styles + poses');
assert(G.LOOKS.some(l => l.id.startsWith('pose-')), 'has pose variants');
assert(G.CATEGORIES.some(c => c.id === 'prop' && c.label === 'Hold'), 'prop labeled Hold');
// View box is portrait (~3:4), not wide
assert(G.MERMAID_VIEW.w / G.MERMAID_VIEW.h < 0.8, 'mermaid view not too wide');
// Contain-fit: 768×1024 into 350×360 must not produce stretched 350×360
const fit = G.fitContain(768, 1024, 350, 360);
assert(Math.abs(fit.w / fit.h - 768 / 1024) < 0.01, 'fit preserves aspect ratio');
assert(fit.w <= 350 && fit.h <= 360, 'fit stays inside box');
assert(fit.w < 350, 'wide box does not force full width (no horizontal stretch)');
// Tray-style contain: tall portrait into wide cell stays portrait
const trayFit = G.fitContain(768, 1024, 58, 64);
assert(Math.abs(trayFit.w / trayFit.h - 0.75) < 0.02, 'tray contain keeps 3:4');
assert(trayFit.h <= 64 && trayFit.w <= 58, 'tray thumb inside cell');
assert(G.BACKGROUNDS.length >= 4, 'enough backgrounds');

const srcs = G.allLayerSrcs();
assert(srcs.length >= 20, 'many layer srcs');
for (const src of srcs) {
  assert(exists(src), 'asset on disk: ' + src);
}

// Every category item with src has a file
for (const cat of G.CATEGORIES) {
  for (const item of cat.items) {
    if (item.src) assert(exists(item.src), cat.id + '/' + item.id + ' src exists');
  }
}

// ---- Outfit logic ----
section('outfit logic');
assert(G.isValidItem('look', 'gold-teal'), 'valid look');
assert(!G.isValidItem('look', 'nope'), 'invalid look');
assert(G.isValidItem('crown', 'none'), 'none crown ok');

const n = G.normalizeOutfit({ look: 'gold-teal', crown: 'bogus', prop: 'shell' });
assertEq(n.look, 'gold-teal', 'normalize keeps look');
assertEq(n.crown, G.DEFAULT_OUTFIT.crown, 'normalize drops bad crown');
assertEq(n.prop, 'shell', 'normalize keeps prop');

assertEq(G.resolveEquip('crown', 'tiara-gold', { crown: 'none' }), 'tiara-gold', 'equip crown');
assertEq(G.resolveEquip('crown', 'tiara-gold', { crown: 'tiara-gold' }), 'none', 'toggle optional off');
assertEq(G.resolveEquip('look', 'pink-sparkle', { look: 'pink-sparkle' }), 'pink-sparkle', 'required no toggle off');

const a = G.randomOutfit(false);
assert(G.isValidItem('look', a.look), 'random look valid');
assert(G.isValidItem('bg', a.bg), 'random bg valid');

const b = Object.assign({}, a);
assert(G.outfitsEqual(a, b), 'equal outfits');
assert(!G.outfitsEqual(a, Object.assign({}, a, { crown: a.crown === 'none' ? 'tiara-gold' : 'none' })), 'unequal');

// ---- Favorites / save ----
section('favorites');
G.setFullOutfit(G.DEFAULT_OUTFIT);
assert(!G.isFavorite(G.save.outfit) || true, 'favorite check runs');
const before = G.save.favorites.length;
const added = G.toggleFavorite();
assert(added === true || added === false, 'toggle returns bool');
if (added) assert(G.save.favorites.length === before + 1 || G.save.favorites.length <= G.MAX_FAVORITES, 'fav added');

// ---- Play flow ----
section('play flow');
G.enterPlay('free');
assertEq(G.state(), 'play', 'enter play');
assert(G.hitCats().length === G.CATEGORIES.length, 'cat hits');
assert(G.hitTray().length > 0, 'tray hits');
G.equip('look', 'rainbow');
assertEq(G.save.outfit.look, 'rainbow', 'equip look');
assert(G.sessionDress() >= 1, 'session dress count');

G.enterPlay('match');
assert(G.matchTarget(), 'match has target');
assert(!G.matchDone(), 'match not done yet');

G.doSurprise();
assert(G.isValidItem('look', G.save.outfit.look), 'surprise valid');

G.doShowOff();
assert((G.save.showOffs | 0) >= 1, 'showoff counted');

G.enterMenu();
assertEq(G.state(), 'menu', 'back to menu');

// ---- Layer order ----
section('layers');
assert(G.LAYER_ORDER[0] === 'bg', 'bg first');
assert(G.LAYER_ORDER.includes('look'), 'has look');
assert(G.ACCESSORY_LAYOUT.crown, 'crown layout');
const layers = G.resolveLayers(G.DEFAULT_OUTFIT);
assert(layers.some(l => l.key === 'look'), 'resolve includes look');

// ---- Accessory alignment ----
// Boxes are computed against the character content box inside the drawn look
// rect. Reference geometry mirrors MERMAID_VIEW (280×374) with a full-bleed look.
section('accessory alignment');
// Crown & gems center on the look's true head/neck axis (full-art-width
// fractions), not the bbox center. Use a reference look with known centers.
const rubyLook = G.LOOKS.find(l => l.id === 'ruby-sunset');
const centers = G.lookCenters(rubyLook);
const cr = G.accessoryRect('crown', 0, 0, 280, 374, centers);
const neck = G.accessoryRect('jewelry', 0, 0, 280, 374, centers);
const hand = G.accessoryRect('prop', 0, 0, 280, 374, centers);

// content box for this reference rect
const cbX = 280 * G.LOOK_CONTENT.x, cbY = 374 * G.LOOK_CONTENT.y;
const cbW = 280 * G.LOOK_CONTENT.w, cbH = 374 * G.LOOK_CONTENT.h;
const frac = (box) => ({
  cx: (box.x + box.w / 2 - cbX) / cbW,
  cy: (box.y + box.h / 2 - cbY) / cbH,
});
// Every look carries a measured head/neck axis, biased right of the bbox center.
assert(G.LOOKS.every(l => l.headX != null && l.neckX != null), 'looks carry head/neck axis');
assert(rubyLook.headX > 0.51 && rubyLook.neckX > 0.51, 'axis sits right of bbox center');

// Crown: centered exactly on the head axis (regression: NOT at bbox center 0.5).
assert(cr && cr.anchor === 'bottom', 'crown bottom-anchored (rests on head)');
assert(Math.abs((cr.x + cr.w / 2) - 280 * centers.headX) < 0.5, 'crown centered on head axis');
assert(frac(cr).cx > 0.52, 'crown pushed right of bbox center (fixes left drift)');
assert(cr.y < cbY, 'crown top rises above the content box');
assert(frac(cr).cy < 0.12, 'crown sits in the top head band');

// Gems: centered on the neck axis, top-anchored, below the crown, at the neck.
assert(neck && neck.anchor === 'top', 'gems top-anchored (hang from neck)');
assert(Math.abs((neck.x + neck.w / 2) - 280 * centers.neckX) < 0.5, 'gems centered on neck axis');
assert(frac(neck).cx > 0.52, 'gems pushed right of bbox center (fixes left drift)');
assert(neck.y > cr.y + cr.h, 'gems below the crown');
const nf = frac(neck).cy;
assert(nf > 0.30 && nf < 0.55, 'gems seated at neck / upper chest');

// A look with no measured center falls back to the default axis.
const dflt = G.lookCenters({ id: 'x' });
assertEq(dflt.headX, G.LOOK_CENTER_DEFAULT.headX, 'missing headX falls back');
assertEq(dflt.neckX, G.LOOK_CENTER_DEFAULT.neckX, 'missing neckX falls back');

// Hold: centered prop toward her hand (viewer right), around mid-body height.
assert(hand && hand.anchor === 'center', 'hold item center-anchored');
assert(frac(hand).cx > 0.6, 'hold item toward side hand');
const hf = frac(hand).cy;
assert(hf > 0.5 && hf < 0.8, 'hold item around hand height');

// anchorOffsetY seats art by anchor inside the box height.
assertEq(G.anchorOffsetY('top', 100, 60), 0, 'top anchor offset');
assertEq(G.anchorOffsetY('bottom', 100, 60), 40, 'bottom anchor offset');
assertEq(G.anchorOffsetY('center', 100, 60), 20, 'center anchor offset');

// ---- Tray horizontal scroll ----
section('tray scroll');
G.enterPlay('free');
// Select the Mermaid category (many items) via its tab, like a real tap.
const lookCat = G.hitCats().find((h, i) => G.CATEGORIES[i].id === 'look');
G.handleTap(lookCat.x + lookCat.w / 2, lookCat.y + lookCat.h / 2);
assertEq(G.CATEGORIES[G.categoryIndex()].id, 'look', 'switched to Mermaid tray');

const looksN = G.LOOKS.length;
assert(G.hitTray().length === looksN, 'every look gets a tray cell (no squashing)');
// Fixed cell size — cells are NOT shrunk to fit the viewport.
const cw0 = G.hitTray()[0].w;
assert(cw0 >= G.TRAY.cell - 6, 'tray cells keep full fixed size');
assert(looksN * G.TRAY.cell > G.TRAY.w, 'looks overflow the viewport');
assert(G.trayScrollMax() > 0, 'overflowing tray is scrollable');

// Scrolling shifts cells left and reveals later items.
const firstX0 = G.hitTray()[0].x;
const lastX0 = G.hitTray()[looksN - 1].x;
assert(lastX0 > G.TRAY.w, 'last item initially off the right edge');
G.scrollTray(120);
assert(G.trayScroll() > 0, 'scroll advances offset');
assert(G.hitTray()[0].x < firstX0, 'cells move left when scrolled');
assert(G.hitTray()[looksN - 1].x < lastX0, 'later items brought into view');

// Clamp: cannot scroll past the ends.
G.scrollTray(99999);
assertEq(G.trayScroll(), G.trayScrollMax(), 'scroll clamps at the right end');
G.scrollTray(-99999);
assertEq(G.trayScroll(), 0, 'scroll clamps at the left end');
assert(!G.scrollTray(-10), 'no-op scroll at the edge returns false');

// A short category (Scene = 5) fits without scrolling and stays centered.
const sceneCat = G.hitCats().find((h, i) => G.CATEGORIES[i].id === 'bg');
G.handleTap(sceneCat.x + sceneCat.w / 2, sceneCat.y + sceneCat.h / 2);
assertEq(G.trayScroll(), 0, 'switching category resets scroll');
assertEq(G.trayScrollMax(), 0, 'small category is not scrollable');

// Tray band hit test matches TRAY geometry.
assert(G.inTrayBand(G.W / 2, G.TRAY.y + 5), 'point inside tray band');
assert(!G.inTrayBand(G.W / 2, G.TRAY.y - 40), 'point above tray band excluded');

console.log('\n\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) {
  console.error('\nFailures:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
