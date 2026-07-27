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
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [look = 'gold-teal', crown = 'crystal', jewelry = 'shell-choker',
       prop = 'mirror', out = 'preview-align.png'] = process.argv.slice(2);

/** Pull this look's axes from config.js. */
function lookCenters(id) {
  const cfg = fs.readFileSync(`${ROOT}/js/config.js`, 'utf8');
  const re = new RegExp(`id:\\s*'${id}'[\\s\\S]*?(?=\\n\\s*\\{ id:|\\n\\];)`, 'm');
  const block = cfg.match(re)?.[0] || '';
  const num = (key) => {
    const m = block.match(new RegExp(`${key}:\\s*([\\d.]+)`));
    return m ? +m[1] : null;
  };
  return {
    headX: num('headX') ?? 0.538,
    neckX: num('neckX') ?? 0.540,
    handX: num('handX') ?? 0.84,
    headY: num('headY'),
    neckY: num('neckY'),
    handY: num('handY') ?? 0.53,
  };
}
const CENTERS = lookCenters(look);

// Keep in sync with js/assets.js
const LOOK_CONTENT = { x: 73 / 768, y: 65 / 1024, w: 625 / 768, h: 925 / 1024 };
const ACCESSORY_LAYOUT = {
  crown:   { x: 0.30,  y: -0.01, w: 0.34, h: 0.13, anchor: 'bottom' },
  jewelry: { x: 0.365, y: 0.36,  w: 0.20, h: 0.075, anchor: 'top' },
  prop:    { x: 0.72,  y: 0.44,  w: 0.18, h: 0.18, anchor: 'center' },
};
function accessoryRect(key, lx, ly, lw, lh) {
  const l = ACCESSORY_LAYOUT[key];
  const cx = lx + lw * LOOK_CONTENT.x, cy = ly + lh * LOOK_CONTENT.y;
  const cw = lw * LOOK_CONTENT.w, ch = lh * LOOK_CONTENT.h;
  const w = cw * l.w, h = ch * l.h;
  let x;
  if (key === 'crown') x = lx + lw * CENTERS.headX - w / 2;
  else if (key === 'jewelry') x = lx + lw * CENTERS.neckX - w / 2;
  else if (key === 'prop') x = lx + lw * CENTERS.handX - w / 2;
  else x = cx + cw * l.x;
  let y = cy + ch * l.y;
  if (key === 'crown' && CENTERS.headY != null) y = ly + lh * CENTERS.headY - h;
  else if (key === 'jewelry' && CENTERS.neckY != null) y = ly + lh * CENTERS.neckY;
  else if (key === 'prop' && CENTERS.handY != null) y = ly + lh * CENTERS.handY - h / 2;
  return { x, y, w, h, anchor: l.anchor };
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
