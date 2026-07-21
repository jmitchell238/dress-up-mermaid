'use strict';

/** @type {Map<string, HTMLImageElement>} */
const imageCache = new Map();
let assetsReady = false;
let assetsFailed = 0;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    if (imageCache.has(src)) { resolve(imageCache.get(src)); return; }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      assetsFailed++;
      console.warn('[assets] failed to load', src);
      resolve(null);
    };
    img.src = src;
  });
}

/** Preload every layer PNG listed in config. */
async function preloadAssets() {
  const srcs = allLayerSrcs();
  await Promise.all(srcs.map(loadImage));
  assetsReady = true;
  return { total: srcs.length, failed: assetsFailed };
}

function getImage(src) {
  if (!src) return null;
  return imageCache.get(src) || null;
}

function itemOf(list, id) {
  return list.find(x => x.id === id) || list[0];
}

function categoryOf(catId) {
  return CATEGORIES.find(c => c.id === catId);
}

function itemForOutfit(catId, outfit) {
  const cat = categoryOf(catId);
  if (!cat) return null;
  return itemOf(cat.items, outfit[catId]);
}

/**
 * Resolve draw layers for an outfit (back → front).
 * @returns {{ key: string, src: string|null, img: HTMLImageElement|null, swatch?: string }[]}
 */
function resolveLayers(outfit) {
  const layers = [];
  for (const key of LAYER_ORDER) {
    const item = itemForOutfit(key, outfit);
    if (!item) continue;
    if (!item.src) continue; // none
    layers.push({ key, src: item.src, img: getImage(item.src), swatch: item.swatch });
  }
  return layers;
}

/**
 * Character content box inside a full-frame look image (measured on gold-teal 768×1024).
 * Accessories are placed relative to THIS, not the padded canvas edge.
 */
const LOOK_CONTENT = { x: 73 / 768, y: 65 / 1024, w: 625 / 768, h: 925 / 1024 };

/**
 * Accessory placement as fractions of the character content box.
 * prop = handheld item near her side (she holds it).
 */
const ACCESSORY_LAYOUT = {
  // Sits on top of head / hair (y may be slightly negative = above content box)
  crown:   { x: 0.26, y: -0.04, w: 0.48, h: 0.13 },
  // Open U-necklace at the neck (below chin, above shell top)
  jewelry: { x: 0.30, y: 0.29, w: 0.40, h: 0.11 },
  // Held item near her hand (viewer's right / her left)
  prop:    { x: 0.66, y: 0.42, w: 0.32, h: 0.28 },
};

/**
 * Map accessory layout into the drawn look rectangle (after contain-fit).
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function accessoryRect(key, lookX, lookY, lookW, lookH) {
  const layout = ACCESSORY_LAYOUT[key];
  if (!layout) return null;
  const cx = lookX + lookW * LOOK_CONTENT.x;
  const cy = lookY + lookH * LOOK_CONTENT.y;
  const cw = lookW * LOOK_CONTENT.w;
  const ch = lookH * LOOK_CONTENT.h;
  return {
    x: cx + cw * layout.x,
    y: cy + ch * layout.y,
    w: cw * layout.w,
    h: ch * layout.h,
  };
}
