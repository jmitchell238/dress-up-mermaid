'use strict';

/** @type {'menu'|'play'|'loading'} */
let state = 'menu';

let modeId = 'free';
let categoryIndex = 0;
let bob = 0;
let danceT = 0;
let equipFlash = 0;
let skyPhase = 0;
let sessionDress = 0;
let matchTarget = null;
let matchDone = false;
let matchFlash = 0;
let loadProgress = 0;

/** Hit regions for play UI (rebuilt each layout) */
let hitButtons = [];
let hitTray = [];
let hitCats = [];

/** Horizontal scroll of the item tray (px). Rebuilt/clamped in rebuildHits. */
let trayScroll = 0;
let trayScrollMax = 0;

/** Tray viewport + cell geometry (single source of truth for layout + input). */
const TRAY = { x: 10, y: 458, w: W - 20, h: 100, cell: 66 };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/**
 * Mermaid draw rect inside stage (character area above tray).
 * Art is 3:4 portrait (768×1024) — keep this box ~3:4 so she is never stretched wide.
 */
const MERMAID_VIEW = { x: 55, y: 32, w: 280, h: 374 };

/** Contain-fit src into box (preserve aspect ratio, letterbox centered). */
function fitContain(srcW, srcH, boxW, boxH) {
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { w, h, x: (boxW - w) / 2, y: (boxH - h) / 2 };
}

function currentMode() {
  return MODES[modeId] || MODES.free;
}

function findItem(list, id) {
  return list.find(x => x.id === id) || list[0];
}

function randomOutfit(keepLook) {
  const pick = (arr, allowNone) => {
    const pool = allowNone ? arr : arr.filter(x => x.id !== 'none');
    return pool[Math.floor(Math.random() * pool.length)].id;
  };
  return {
    bg: pick(BACKGROUNDS, false),
    look: keepLook ? save.outfit.look : pick(LOOKS, false),
    crown: pick(CROWNS, true),
    jewelry: pick(JEWELRY, true),
    prop: pick(PROPS, true),
  };
}

function outfitsEqual(a, b) {
  if (!a || !b) return false;
  return CATEGORIES.every(c => a[c.id] === b[c.id]);
}

function isValidItem(catId, itemId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return false;
  return cat.items.some(it => it.id === itemId);
}

function normalizeOutfit(o) {
  const out = Object.assign({}, DEFAULT_OUTFIT);
  if (!o || typeof o !== 'object') return out;
  for (const cat of CATEGORIES) {
    if (o[cat.id] && isValidItem(cat.id, o[cat.id])) out[cat.id] = o[cat.id];
  }
  return out;
}

function enterMenu() {
  state = 'menu';
  clearParticles();
  danceT = 0;
}

function enterPlay(forceMode) {
  state = 'play';
  modeId = forceMode || save.mode || 'free';
  categoryIndex = 0;
  sessionDress = 0;
  danceT = 0;
  equipFlash = 0;
  matchDone = false;
  matchFlash = 0;
  clearParticles();

  if (currentMode().challenge) {
    matchTarget = randomOutfit(false);
    setFullOutfit({
      bg: matchTarget.bg,
      look: matchTarget.look,
      crown: 'none',
      jewelry: 'none',
      prop: 'none',
    });
  } else {
    matchTarget = null;
  }
  rebuildHits();
}

function rebuildHits() {
  hitButtons = [];
  hitTray = [];
  hitCats = [];
  if (state !== 'play') return;

  // Category tabs — two rows if many categories
  const catY = 418;
  const catH = 36;
  const nCat = CATEGORIES.length;
  const catW = (W - 16) / nCat;
  CATEGORIES.forEach((cat, i) => {
    hitCats.push({
      x: 8 + i * catW, y: catY, w: catW - 3, h: catH,
      index: i,
    });
  });

  // Tray items — fixed-size portrait cells that scroll horizontally when they
  // overflow the viewport (swipe left/right), instead of squashing to fit.
  const cat = CATEGORIES[categoryIndex];
  const items = cat.items;
  const n = items.length;
  const cell = TRAY.cell;
  const total = n * cell;
  trayScrollMax = Math.max(0, total - TRAY.w);
  trayScroll = clamp(trayScroll, 0, trayScrollMax);
  // Center when everything fits; left-align (scrollable) when it overflows.
  const x0 = trayScrollMax > 0
    ? TRAY.x - trayScroll
    : TRAY.x + (TRAY.w - total) / 2;
  items.forEach((item, i) => {
    hitTray.push({
      x: x0 + i * cell + 2,
      y: TRAY.y,
      w: cell - 4,
      h: TRAY.h,
      item,
      catId: cat.id,
    });
  });

  // Action row
  const btnY = 570;
  const btnH = 46;
  const gap = 8;
  const labels = [
    { id: 'surprise', label: '🎲 Surprise' },
    { id: 'favorite', label: isFavorite(save.outfit) ? '★ Saved' : '☆ Save' },
    { id: 'showoff', label: '✨ Show off' },
  ];
  const bw = (W - 24 - gap * (labels.length - 1)) / labels.length;
  labels.forEach((b, i) => {
    hitButtons.push({
      x: 12 + i * (bw + gap),
      y: btnY,
      w: bw,
      h: btnH,
      id: b.id,
      label: b.label,
    });
  });

  // Favorites row
  if (save.favorites.length) {
    const fy = 628;
    const fh = 36;
    const fw = Math.min(40, (W - 40) / Math.max(1, save.favorites.length));
    save.favorites.forEach((_, i) => {
      hitButtons.push({
        x: 20 + i * (fw + 4),
        y: fy,
        w: fw,
        h: fh,
        id: 'fav-' + i,
        label: String(i + 1),
        favIndex: i,
      });
    });
  }
}

/**
 * Pure equip resolution. Re-tapping optional items unequips to 'none'.
 * Required categories never go to none.
 */
function resolveEquip(catId, itemId, currentOutfit) {
  if (!isValidItem(catId, itemId)) return currentOutfit[catId];
  const cat = CATEGORIES.find(c => c.id === catId);
  const cur = currentOutfit[catId];
  if (!cat.required && cur === itemId && itemId !== 'none') return 'none';
  return itemId;
}

function equip(catId, itemId) {
  const next = resolveEquip(catId, itemId, save.outfit);
  if (next === save.outfit[catId] && itemId === save.outfit[catId] &&
      !( !CATEGORIES.find(c => c.id === catId).required && itemId !== 'none')) {
    if (!isValidItem(catId, itemId)) return;
  }
  const unequipped = next === 'none' && save.outfit[catId] !== 'none';
  if (unequipped) sfxUnequip();
  else sfxEquip();
  setOutfitPart(catId, next);
  recordDress();
  sessionDress++;
  equipFlash = 0.35;
  const item = itemForOutfit(catId, save.outfit);
  const color = (item && item.swatch) || '#80DEEA';
  spawnBurst(W / 2, 220, color, 12);
  spawnBubbles(W / 2, 280, 8);
  spawnPraise(W / 2, 140);
  rebuildHits();
  checkMatch();
}

function checkMatch() {
  if (!currentMode().challenge || !matchTarget || matchDone) return;
  if (outfitsEqual(save.outfit, matchTarget)) {
    matchDone = true;
    matchFlash = 1.2;
    sfxMatch();
    spawnConfetti(W / 2, 200, 36);
    spawnPraise(W / 2, 130, 'Perfect match!');
    recordShowOff();
  }
}

function doSurprise() {
  sfxShuffle();
  const o = randomOutfit(false);
  setFullOutfit(o);
  recordDress();
  sessionDress++;
  equipFlash = 0.4;
  spawnBurst(W / 2, 220, '#80DEEA', 16);
  spawnBubbles(W / 2, 260, 14);
  spawnPraise(W / 2, 140, 'Surprise!');
  rebuildHits();
  checkMatch();
}

function doFavorite() {
  const added = toggleFavorite();
  if (added) {
    sfxFavorite();
    spawnBurst(W / 2, 200, '#FFD54F', 18);
    spawnPraise(W / 2, 140, 'Saved!');
  } else {
    sfxUnequip();
    spawnPraise(W / 2, 140, 'Unsaved');
  }
  rebuildHits();
}

function doShowOff() {
  sfxShowOff();
  danceT = save.reducedMotion ? 0.8 : 2.2;
  recordShowOff();
  spawnConfetti(W / 2, 180, 40);
  spawnConfetti(W / 2 - 60, 220, 16);
  spawnConfetti(W / 2 + 60, 220, 16);
  spawnBubbles(W / 2, 300, 20);
  spawnPraise(W / 2, 110, 'Splash!');
  spawnPraise(W / 2, 150, PRAISE[Math.floor(Math.random() * PRAISE.length)]);
}

function doNextMatch() {
  matchTarget = randomOutfit(false);
  matchDone = false;
  matchFlash = 0;
  setFullOutfit({
    bg: matchTarget.bg,
    look: matchTarget.look,
    crown: 'none',
    jewelry: 'none',
    prop: 'none',
  });
  sfxShuffle();
  spawnPraise(W / 2, 130, 'New look!');
  rebuildHits();
}

/** True when (x, y) is inside the scrollable tray band. */
function inTrayBand(x, y) {
  return y >= TRAY.y && y <= TRAY.y + TRAY.h && x >= 0 && x <= W;
}

/** Scroll the tray by dx px (positive = reveal items to the right). */
function scrollTray(dx) {
  if (trayScrollMax <= 0) return false;
  const before = trayScroll;
  trayScroll = clamp(trayScroll + dx, 0, trayScrollMax);
  if (trayScroll !== before) rebuildHits();
  return trayScroll !== before;
}

function handleTap(x, y) {
  if (state !== 'play') return;

  for (const h of hitCats) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      categoryIndex = h.index;
      trayScroll = 0;
      sfxClick();
      rebuildHits();
      return;
    }
  }

  for (const h of hitTray) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      equip(h.catId, h.item.id);
      return;
    }
  }

  for (const h of hitButtons) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      if (h.id === 'surprise') doSurprise();
      else if (h.id === 'favorite') doFavorite();
      else if (h.id === 'showoff') doShowOff();
      else if (h.id && h.id.startsWith('fav-')) {
        if (loadFavorite(h.favIndex)) {
          sfxEquip();
          equipFlash = 0.3;
          spawnBurst(W / 2, 220, '#80DEEA', 12);
          spawnPraise(W / 2, 140, 'Favorite!');
          rebuildHits();
          checkMatch();
        }
      }
      return;
    }
  }

  // Tap mermaid for splash
  if (y > MERMAID_VIEW.y && y < MERMAID_VIEW.y + MERMAID_VIEW.h &&
      x > MERMAID_VIEW.x && x < MERMAID_VIEW.x + MERMAID_VIEW.w) {
    sfxSplash();
    equipFlash = 0.25;
    spawnBubbles(W / 2, 240, 10);
    if (currentMode().challenge && matchDone) doNextMatch();
  }
}

function updatePlay(dt) {
  bob += dt * 2.0;
  skyPhase += dt;
  if (danceT > 0) danceT = Math.max(0, danceT - dt);
  if (equipFlash > 0) equipFlash = Math.max(0, equipFlash - dt);
  if (matchFlash > 0) matchFlash = Math.max(0, matchFlash - dt);
  updateParticles(dt);
}

// ---- Drawing ----

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Draw layered outfit into a destination rect.
 * Layers are full-frame art (LAYER_W × LAYER_H) with transparent backgrounds.
 */
function drawLayeredOutfit(ctx, outfit, dx, dy, dw, dh, opts = {}) {
  const layers = resolveLayers(outfit);
  const dance = opts.dance || 0;
  const flash = opts.flash || 0;

  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.42;

  // Soft floor shadow
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(dx + dw / 2, dy + dh * 0.92, dw * 0.28, dh * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  const sway = dance > 0 ? Math.sin(dance * 14) * 6 : Math.sin(bob) * 2.5;
  const hop = dance > 0 ? Math.abs(Math.sin(dance * 12)) * 8 : Math.sin(bob * 1.2) * 2;
  const rot = dance > 0 ? Math.sin(dance * 10) * 0.04 : 0;

  ctx.translate(dx + dw / 2 + sway, dy + dh / 2 - hop);
  if (rot) ctx.rotate(rot);
  ctx.translate(-dw / 2, -dh / 2);

  // Draw look first so we know where the character sits, then snap accessories to her.
  let anyDrawn = false;
  let lookX = 0;
  let lookY = 0;
  let lookW = dw;
  let lookH = dh;

  const lookLayer = layers.find(l => l.key === 'look');
  if (lookLayer && lookLayer.img && lookLayer.img.complete && lookLayer.img.naturalWidth) {
    const iw = lookLayer.img.naturalWidth || LAYER_W;
    const ih = lookLayer.img.naturalHeight || LAYER_H;
    const fit = fitContain(iw, ih, dw, dh);
    lookX = fit.x;
    lookY = fit.y;
    lookW = fit.w;
    lookH = fit.h;
    ctx.drawImage(lookLayer.img, 0, 0, iw, ih, lookX, lookY, lookW, lookH);
    anyDrawn = true;
  }

  for (const layer of layers) {
    if (layer.key === 'bg' && opts.skipBg) continue;
    if (layer.key === 'look') continue;
    if (!(layer.img && layer.img.complete && layer.img.naturalWidth)) continue;

    if (layer.key === 'crown' || layer.key === 'jewelry' || layer.key === 'prop') {
      const box = accessoryRect(layer.key, lookX, lookY, lookW, lookH);
      if (!box) continue;
      const fit = fitContain(layer.img.naturalWidth, layer.img.naturalHeight, box.w, box.h);
      const oy = anchorOffsetY(box.anchor, box.h, fit.h);
      ctx.drawImage(layer.img, box.x + fit.x, box.y + oy, fit.w, fit.h);
    } else {
      // Backgrounds (when drawn as a layer) — cover the box
      ctx.drawImage(layer.img, 0, 0, layer.img.naturalWidth, layer.img.naturalHeight, 0, 0, dw, dh);
    }
  }

  if (!anyDrawn) {
    // Placeholder mermaid silhouette while assets load / missing
    drawPlaceholderMermaid(ctx, 0, 0, dw, dh, outfit);
  }

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.35;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, dw, dh);
  }

  ctx.restore();
}

/** Soft illustrated placeholder until real layers load — still pretty, not dino-blobs. */
function drawPlaceholderMermaid(ctx, x, y, w, h, outfit) {
  const look = findItem(LOOKS, outfit.look);
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const accent = look.swatch || '#F5D76E';

  ctx.save();
  // Tail
  ctx.fillStyle = '#26A69A';
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy + 40);
  ctx.quadraticCurveTo(cx - 50, cy + 90, cx - 20, cy + 130);
  ctx.quadraticCurveTo(cx, cy + 155, cx + 40, cy + 125);
  ctx.quadraticCurveTo(cx + 20, cy + 80, cx + 24, cy + 40);
  ctx.closePath();
  ctx.fill();
  // Body
  ctx.fillStyle = '#FFDAB9';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 36, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  // Top
  ctx.fillStyle = '#F48FB1';
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy - 8, 16, 12, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 14, cy - 8, 16, 12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#FFDAB9';
  ctx.beginPath();
  ctx.arc(cx, cy - 55, 32, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 70, 38, 28, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - 30, cy - 40, 14, 40, 0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 30, cy - 40, 14, 40, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - 12, cy - 58, 8, 10, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 12, cy - 58, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5C6BC0';
  ctx.beginPath();
  ctx.arc(cx - 11, cy - 57, 4, 0, Math.PI * 2);
  ctx.arc(cx + 13, cy - 57, 4, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = '#E57373';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - 42, 10, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.restore();
}

function drawBgOnly(ctx, outfit) {
  const bg = findItem(BACKGROUNDS, outfit.bg);
  const img = bg && bg.src ? getImage(bg.src) : null;
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, 0, 0, LAYER_W, LAYER_H, 0, 0, W, H);
  } else {
    // Pretty underwater gradient fallback
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#81D4FA');
    g.addColorStop(0.45, '#4FC3F7');
    g.addColorStop(0.75, '#26C6DA');
    g.addColorStop(1, '#00838F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Soft light rays
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 70, 0);
      ctx.lineTo(80 + i * 70, 0);
      ctx.lineTo(50 + i * 70, H * 0.55);
      ctx.lineTo(20 + i * 70, H * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** A small chevron cue at a tray edge. dir -1 = points left, 1 = points right. */
function drawTrayScrollHint(ctx, x, y, dir) {
  ctx.save();
  const g = ctx.createLinearGradient(x - dir * 22, 0, x, 0);
  g.addColorStop(0, 'rgba(0,20,35,0)');
  g.addColorStop(1, 'rgba(0,20,35,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(dir < 0 ? x : x - 22, TRAY.y, 22, TRAY.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dir * 5, y - 7);
  ctx.lineTo(x + dir * 4, y);
  ctx.lineTo(x - dir * 5, y + 7);
  ctx.stroke();
  ctx.restore();
}

function drawPlayChrome(ctx) {
  // Category tabs
  CATEGORIES.forEach((cat, i) => {
    const h = hitCats[i];
    if (!h) return;
    const active = i === categoryIndex;
    ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(0,40,60,0.45)';
    roundRect(ctx, h.x, h.y, h.w, h.h, 10);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = '#80DEEA';
      ctx.lineWidth = 2;
      roundRect(ctx, h.x, h.y, h.w, h.h, 10);
      ctx.stroke();
    }
    ctx.fillStyle = active ? '#006064' : '#E0F7FA';
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.label, h.x + h.w / 2, h.y + h.h / 2);
  });

  // Tray panel
  ctx.fillStyle = 'rgba(0, 30, 50, 0.55)';
  roundRect(ctx, 6, 452, W - 12, 112, 16);
  ctx.fill();

  // Clip tray contents to the viewport so scrolled-off cells don't spill out.
  ctx.save();
  roundRect(ctx, TRAY.x - 2, 452, TRAY.w + 4, 112, 14);
  ctx.clip();

  // Tray items — image + name stacked tightly (no giant empty gap)
  for (const h of hitTray) {
    const selected = save.outfit[h.catId] === h.item.id;
    ctx.fillStyle = selected ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.16)';
    roundRect(ctx, h.x, h.y, h.w, h.h, 12);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2.5;
      roundRect(ctx, h.x, h.y, h.w, h.h, 12);
      ctx.stroke();
    }

    const pad = 4;
    const labelH = 14;
    // One tight stack: thumb then label, vertically centered as a group
    const stackH = h.h - pad * 2;
    const thumbH = stackH - labelH - 2;
    const thumbW = h.w - pad * 2;
    // Prefer nearly-square / slight portrait well so mermaids aren't tiny at top
    let tw = thumbW;
    let th = Math.min(thumbH, tw * 1.15);
    if (th > thumbH) th = thumbH;
    const groupH = th + 2 + labelH;
    const groupY = h.y + (h.h - groupH) / 2;
    const tx = h.x + (h.w - tw) / 2;
    const ty = groupY;

    // Soft well
    ctx.fillStyle = selected
      ? (h.item.swatch || '#B3E5FC')
      : 'rgba(0, 40, 60, 0.45)';
    if (selected && h.item.swatch) ctx.globalAlpha = 0.45;
    roundRect(ctx, tx, ty, tw, th, 8);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (h.item.src) {
      const img = getImage(h.item.src);
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        roundRect(ctx, tx, ty, tw, th, 8);
        ctx.clip();
        // Contain-fit with a little padding; mermaids fill most of the well
        const inset = 2;
        const fit = fitContain(img.naturalWidth, img.naturalHeight, tw - inset * 2, th - inset * 2);
        // Bias mermaid thumbs slightly upward so face is visible (less empty feet space)
        let oy = 0;
        if (h.catId === 'look' || h.catId === 'bg') {
          oy = Math.min(4, (th - inset * 2 - fit.h) * 0.15);
        }
        ctx.drawImage(img, tx + inset + fit.x, ty + inset + fit.y - oy, fit.w, fit.h);
        ctx.restore();
      }
    } else if (h.item.id === 'none') {
      ctx.strokeStyle = selected ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + 6, ty + 6);
      ctx.lineTo(tx + tw - 6, ty + th - 6);
      ctx.stroke();
    }

    ctx.fillStyle = selected ? '#006064' : '#E0F7FA';
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let label = h.item.label;
    if (h.w < 42 && label.length > 5) label = label.slice(0, 4) + '…';
    ctx.fillText(label, h.x + h.w / 2, groupY + th + 2 + labelH / 2);
  }

  ctx.restore(); // end tray clip

  // Scroll affordance — soft edge fades + chevrons when there is more to see.
  if (trayScrollMax > 0) {
    const midY = TRAY.y + TRAY.h / 2;
    if (trayScroll > 1) drawTrayScrollHint(ctx, TRAY.x + 2, midY, -1);
    if (trayScroll < trayScrollMax - 1) drawTrayScrollHint(ctx, TRAY.x + TRAY.w - 2, midY, 1);
  }

  // Action buttons
  for (const h of hitButtons) {
    if (h.id && h.id.startsWith('fav-')) {
      ctx.fillStyle = 'rgba(255, 213, 79, 0.9)';
      roundRect(ctx, h.x, h.y, h.w, h.h, 10);
      ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(h.label, h.x + h.w / 2, h.y + h.h / 2);
      continue;
    }
    const colors = {
      surprise: ['#CE93D8', '#7B1FA2'],
      favorite: ['#FFD54F', '#F9A825'],
      showoff: ['#80DEEA', '#00838F'],
    };
    const c = colors[h.id] || ['#90CAF9', '#1565C0'];
    const g = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
    g.addColorStop(0, c[0]);
    g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    roundRect(ctx, h.x, h.y, h.w, h.h, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.label, h.x + h.w / 2, h.y + h.h / 2);
  }

  // Mode / match banner (portrait-friendly panel)
  if (currentMode().challenge && matchTarget) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, W - 100, 48, 88, 128, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(matchDone ? 'Matched!' : 'Match me', W - 56, 62);
    // Portrait ghost (3:4) — never a wide strip that stretches her
    drawLayeredOutfit(ctx, matchTarget, W - 94, 68, 76, 100, { ghost: !matchDone, skipBg: true });
  }

  // Session looks counter
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, W / 2 - 40, 10, 80, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#E0F7FA';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Styles ' + sessionDress, W / 2, 22);
}

function drawPlay(ctx) {
  drawBgOnly(ctx, save.outfit);

  // Soft vignette over lower UI area
  const g = ctx.createLinearGradient(0, 380, 0, H);
  g.addColorStop(0, 'rgba(0,20,40,0)');
  g.addColorStop(0.25, 'rgba(0,25,45,0.35)');
  g.addColorStop(1, 'rgba(0,20,40,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 380, W, H - 380);

  // Character (skip bg layer — already drawn full-bleed)
  drawLayeredOutfit(
    ctx,
    save.outfit,
    MERMAID_VIEW.x,
    MERMAID_VIEW.y,
    MERMAID_VIEW.w,
    MERMAID_VIEW.h,
    { dance: danceT, flash: equipFlash, skipBg: true }
  );

  if (matchFlash > 0) {
    ctx.save();
    ctx.globalAlpha = matchFlash * 0.25;
    ctx.fillStyle = '#FFD54F';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawPlayChrome(ctx);
  drawParticles(ctx);
}

function drawMenuBackdrop(ctx) {
  drawBgOnly(ctx, save.outfit);
  // Dim for menu card readability
  ctx.fillStyle = 'rgba(0, 20, 40, 0.35)';
  ctx.fillRect(0, 0, W, H);
  // Soft mermaid preview behind menu (dimmed) — portrait 3:4 box
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawLayeredOutfit(ctx, save.outfit, 75, 160, 240, 320, { skipBg: true });
  ctx.restore();
  drawParticles(ctx);
}
