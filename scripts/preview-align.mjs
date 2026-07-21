#!/usr/bin/env node
/**
 * Accessory-alignment preview — headless.
 *
 * Composites a look + crown + jewelry + prop using the SAME math the game uses
 * (js/assets.js ACCESSORY_LAYOUT / accessoryRect / anchorOffsetY, contain-fit
 * into MERMAID_VIEW). Lets you eyeball placement without a browser, which is how
 * ACCESSORY_LAYOUT was tuned. No dependencies.
 *
 * Usage:
 *   node scripts/preview-align.mjs [look] [crown] [jewelry] [prop] [outfile]
 * Examples:
 *   node scripts/preview-align.mjs gold-teal crystal shell-choker mirror
 *   node scripts/preview-align.mjs ruby-sunset tiara-gold gem-blue harp out.png
 */
import { decode, makeCanvas, drawImage, fitContain, encode } from './lib-png.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [look = 'gold-teal', crown = 'crystal', jewelry = 'shell-choker',
       prop = 'mirror', out = 'preview-align.png'] = process.argv.slice(2);

// Keep in sync with js/assets.js
const LOOK_CONTENT = { x: 73 / 768, y: 65 / 1024, w: 625 / 768, h: 925 / 1024 };
const ACCESSORY_LAYOUT = {
  crown:   { x: 0.30,  y: -0.05, w: 0.40, h: 0.17, anchor: 'bottom' },
  jewelry: { x: 0.365, y: 0.34,  w: 0.27, h: 0.13, anchor: 'top' },
  prop:    { x: 0.55,  y: 0.46,  w: 0.40, h: 0.34, anchor: 'center' },
};
function accessoryRect(key, lx, ly, lw, lh) {
  const l = ACCESSORY_LAYOUT[key];
  const cx = lx + lw * LOOK_CONTENT.x, cy = ly + lh * LOOK_CONTENT.y;
  const cw = lw * LOOK_CONTENT.w, ch = lh * LOOK_CONTENT.h;
  return { x: cx + cw * l.x, y: cy + ch * l.y, w: cw * l.w, h: ch * l.h, anchor: l.anchor };
}
function anchorOffsetY(anchor, boxH, fitH) {
  if (anchor === 'bottom') return boxH - fitH;
  if (anchor === 'top') return 0;
  return (boxH - fitH) / 2;
}

// MERMAID_VIEW is 280x374; render at 2x for clarity.
const SC = 2, dw = 280 * SC, dh = 374 * SC, pad = 20;
const canvas = makeCanvas(dw + pad * 2, dh + pad * 2, [30, 50, 80, 255]);

const lookImg = decode(`${ROOT}/art/layers/look/${look}.png`);
const fit = fitContain(lookImg.w, lookImg.h, dw, dh);
const [lx, ly, lw, lh] = [fit.x, fit.y, fit.w, fit.h];
drawImage(canvas, lookImg, pad + lx, pad + ly, lw, lh);

const files = {
  crown: crown === 'none' ? null : `${ROOT}/art/layers/crown/${crown}.png`,
  jewelry: jewelry === 'none' ? null : `${ROOT}/art/layers/jewelry/${jewelry}.png`,
  prop: prop === 'none' ? null : `${ROOT}/art/layers/prop/${prop}.png`,
};
for (const key of ['jewelry', 'crown', 'prop']) {
  if (!files[key]) continue;
  const img = decode(files[key]);
  const box = accessoryRect(key, lx, ly, lw, lh);
  const f = fitContain(img.w, img.h, box.w, box.h);
  const oy = anchorOffsetY(box.anchor, box.h, f.h);
  drawImage(canvas, img, pad + box.x + f.x, pad + box.y + oy, f.w, f.h);
}

const outPath = path.isAbsolute(out) ? out : path.join(ROOT, out);
encode(canvas, outPath);
console.log('wrote', outPath, `(${look} / ${crown} / ${jewelry} / ${prop})`);
