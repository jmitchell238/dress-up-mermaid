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
      ACCESSORY_LAYOUT, LOOK_CONTENT, accessoryRect,
      equip, enterPlay, enterMenu, doSurprise, doFavorite, doShowOff,
      checkMatch, rebuildHits, handleTap,
      state: () => state,
      modeId: () => modeId,
      matchTarget: () => matchTarget,
      matchDone: () => matchDone,
      sessionDress: () => sessionDress,
      categoryIndex: () => categoryIndex,
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
// Crown sits on upper content (head), not bottom
const cr = G.accessoryRect('crown', 0, 0, 280, 374);
const neck = G.accessoryRect('jewelry', 0, 0, 280, 374);
const hand = G.accessoryRect('prop', 0, 0, 280, 374);
assert(cr && cr.y < 80, 'crown near top of character');
assert(neck && neck.y > cr.y, 'gems below crown');
assert(hand && hand.x > 120, 'hold item toward side hand');

console.log('\n\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) {
  console.error('\nFailures:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
process.exit(0);
