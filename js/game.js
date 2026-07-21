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

  // Tray items — portrait-friendly cells (never a wide strip that squashes thumbs)
  const cat = CATEGORIES[categoryIndex];
  const items = cat.items;
  const trayY = 460;
  const trayH = 96;
  const n = items.length;
  // Cap width so cells stay roughly square / portrait; shrink if many items
  const cell = Math.min(64, (W - 16) / Math.max(1, n));
  const total = n * cell;
  const x0 = (W - total) / 2;
  items.forEach((item, i) => {
    hitTray.push({
      x: x0 + i * cell + 2,
      y: trayY,
      w: cell - 4,
      h: trayH,
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

function handleTap(x, y) {
  if (state !== 'play') return;

  for (const h of hitCats) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      categoryIndex = h.index;
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

  let anyDrawn = false;
  for (const layer of layers) {
    if (layer.key === 'bg' && opts.skipBg) continue;
    if (!(layer.img && layer.img.complete && layer.img.naturalWidth)) continue;

    const layout = typeof ACCESSORY_LAYOUT !== 'undefined' ? ACCESSORY_LAYOUT[layer.key] : null;
    if (layout) {
      // Trimmed accessory PNGs — place at head / neck / hand anchors (relative to view box)
      const ax = layout.x * dw;
      const ay = layout.y * dh;
      const aw = layout.w * dw;
      const ah = layout.h * dh;
      const fit = fitContain(layer.img.naturalWidth, layer.img.naturalHeight, aw, ah);
      ctx.drawImage(layer.img, ax + fit.x, ay + fit.y, fit.w, fit.h);
    } else if (layer.key === 'look') {
      // NEVER stretch — contain-fit portrait art inside the view rect
      const iw = layer.img.naturalWidth || LAYER_W;
      const ih = layer.img.naturalHeight || LAYER_H;
      const fit = fitContain(iw, ih, dw, dh);
      ctx.drawImage(layer.img, 0, 0, iw, ih, fit.x, fit.y, fit.w, fit.h);
      anyDrawn = true;
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
  roundRect(ctx, 8, 454, W - 16, 108, 16);
  ctx.fill();

  // Tray items — square-ish portrait thumbs, always contain-fit (never stretch)
  for (const h of hitTray) {
    const selected = save.outfit[h.catId] === h.item.id;
    ctx.fillStyle = selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.18)';
    roundRect(ctx, h.x, h.y, h.w, h.h, 12);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2.5;
      roundRect(ctx, h.x, h.y, h.w, h.h, 12);
      ctx.stroke();
    }

    // Portrait thumb box inside the cell (3:4-ish, leaves room for label)
    const labelH = 18;
    const pad = 5;
    const maxTw = h.w - pad * 2;
    const maxTh = h.h - labelH - pad * 2;
    // Prefer portrait 3:4; if cell is narrow, shrink width first
    let tw = maxTw;
    let th = tw * (4 / 3);
    if (th > maxTh) {
      th = maxTh;
      tw = th * (3 / 4);
    }
    if (tw > maxTw) {
      tw = maxTw;
      th = Math.min(maxTh, tw * (4 / 3));
    }
    const tx = h.x + (h.w - tw) / 2;
    const ty = h.y + pad;

    // Soft swatch well behind the art
    ctx.fillStyle = h.item.swatch
      ? (selected ? h.item.swatch : 'rgba(0,0,0,0.2)')
      : 'rgba(0,0,0,0.2)';
    if (h.item.swatch && !selected) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = h.item.swatch;
    }
    roundRect(ctx, tx, ty, tw, th, 8);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (h.item.src) {
      const img = getImage(h.item.src);
      if (img && img.complete && img.naturalWidth) {
        ctx.save();
        roundRect(ctx, tx, ty, tw, th, 8);
        ctx.clip();
        // CONTAIN fit — full art visible, correct proportions, no stretch
        const fit = fitContain(img.naturalWidth, img.naturalHeight, tw - 4, th - 4);
        ctx.drawImage(
          img,
          tx + 2 + fit.x,
          ty + 2 + fit.y,
          fit.w,
          fit.h
        );
        ctx.restore();
      }
    } else if (h.item.id === 'none') {
      ctx.strokeStyle = selected ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + 8, ty + 8);
      ctx.lineTo(tx + tw - 8, ty + th - 8);
      ctx.stroke();
    }

    ctx.fillStyle = selected ? '#006064' : '#E0F7FA';
    ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Truncate long labels in tiny cells
    let label = h.item.label;
    if (h.w < 40 && label.length > 5) label = label.slice(0, 4) + '…';
    ctx.fillText(label, h.x + h.w / 2, h.y + h.h - 10);
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
