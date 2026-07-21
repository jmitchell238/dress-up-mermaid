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
 * Accessory placement within the mermaid view rect (normalized 0–1 of dw/dh).
 * Looks/bgs fill the full rect; crowns sit on the head, jewelry at neck, props at hand.
 */
const ACCESSORY_LAYOUT = {
  crown:   { x: 0.28, y: 0.02, w: 0.44, h: 0.18 },
  jewelry: { x: 0.32, y: 0.26, w: 0.36, h: 0.12 },
  prop:    { x: 0.58, y: 0.38, w: 0.34, h: 0.32 },
};
