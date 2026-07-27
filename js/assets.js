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
 * prop = handheld item (grip centers on handX/handY when set).
 *
 * `anchor` controls how the contain-fit art is seated vertically inside the
 * box, so crowns of different heights all rest on the head and necklaces of
 * different heights all hang from the neck:
 *   'bottom' — art base sits at box bottom (crowns rest on the hair)
 *   'top'    — art top sits at box top    (necklaces hang from the neck)
 *   'center' — art centered in the box    (handheld props)
 * Tuned visually against the gold-teal reference character (see
 * docs/ARCHITECTURE.md → "Accessory alignment").
 *
 * Crown art is front-facing only (no wrap-around back band). Jewelry is a
 * shallow front arc (chain + pendant), drawn small at the collarbone.
 */
const ACCESSORY_LAYOUT = {
  // Front-facing tiara: base sits in the hair (not a floating 3D ring).
  crown:   { x: 0.30,  y: -0.02, w: 0.34, h: 0.11, anchor: 'bottom' },
  // Delicate collarbone necklace — small, shallow arc.
  jewelry: { x: 0.365, y: 0.385, w: 0.18, h: 0.055, anchor: 'top' },
  // Palm-sized hold; grip is the BOTTOM of the prop (handle sits in the palm).
  prop:    { x: 0.74,  y: 0.46,  w: 0.15, h: 0.18, anchor: 'bottom' },
};

/**
 * Resolve a look's accessory axes, falling back to defaults.
 * headX/neckX/handX = fraction of full art width.
 * headY/neckY/handY = optional fraction of full art height.
 * When vertical pins are omitted, ACCESSORY_LAYOUT content-box fractions apply.
 */
function lookCenters(lookItem) {
  return {
    headX: (lookItem && lookItem.headX != null) ? lookItem.headX : LOOK_CENTER_DEFAULT.headX,
    neckX: (lookItem && lookItem.neckX != null) ? lookItem.neckX : LOOK_CENTER_DEFAULT.neckX,
    handX: (lookItem && lookItem.handX != null) ? lookItem.handX : LOOK_CENTER_DEFAULT.handX,
    headY: (lookItem && lookItem.headY != null) ? lookItem.headY : null,
    neckY: (lookItem && lookItem.neckY != null) ? lookItem.neckY : null,
    handY: (lookItem && lookItem.handY != null) ? lookItem.handY : LOOK_CENTER_DEFAULT.handY,
  };
}

/**
 * Map accessory layout into the drawn look rectangle (after contain-fit).
 *
 * Crown & gems center on headX / neckX. Hold items center on handX / handY
 * (full-art fractions) so the grip lands in her palm, not on the hip/tail.
 *
 * Poses may also set headY / neckY when framing differs from gold-teal.
 * @returns {{ x: number, y: number, w: number, h: number, anchor: string }}
 */
function accessoryRect(key, lookX, lookY, lookW, lookH, centers) {
  const layout = ACCESSORY_LAYOUT[key];
  if (!layout) return null;
  const cx = lookX + lookW * LOOK_CONTENT.x;
  const cy = lookY + lookH * LOOK_CONTENT.y;
  const cw = lookW * LOOK_CONTENT.w;
  const ch = lookH * LOOK_CONTENT.h;
  const w = cw * layout.w;
  const h = ch * layout.h;

  let x;
  if (key === 'crown' && centers && centers.headX != null) {
    x = lookX + lookW * centers.headX - w / 2;
  } else if (key === 'jewelry' && centers && centers.neckX != null) {
    x = lookX + lookW * centers.neckX - w / 2;
  } else if (key === 'prop' && centers && centers.handX != null) {
    x = lookX + lookW * centers.handX - w / 2;
  } else {
    x = cx + cw * layout.x;
  }

  let y = cy + ch * layout.y;
  if (key === 'crown' && centers && centers.headY != null) {
    // Bottom of the crown box rests on the head/hairline.
    y = lookY + lookH * centers.headY - h;
  } else if (key === 'jewelry' && centers && centers.neckY != null) {
    // Top of the jewelry box sits at the neck / collarbone.
    y = lookY + lookH * centers.neckY;
  } else if (key === 'prop' && centers && centers.handY != null) {
    // Bottom of the hold box sits on the palm (handle / grip).
    y = lookY + lookH * centers.handY - h;
  }

  return { x, y, w, h, anchor: layout.anchor || 'center' };
}

/** Vertical offset for contain-fit art seated in an accessory box by anchor. */
function anchorOffsetY(anchor, boxH, fitH) {
  if (anchor === 'bottom') return boxH - fitH;
  if (anchor === 'top') return 0;
  return (boxH - fitH) / 2;
}
