#!/usr/bin/env node
/**
 * Extract a full-frame accessory layer from a "designed on mermaid" composite.
 *
 * Workflow (Photoshop-style):
 *   1. Edit gold-teal.png to ADD one accessory looking natural (worn / held).
 *   2. Resize that composite to 768×1024.
 *   3. Run this script to subtract the base mermaid and write the layer PNG.
 *
 * Usage:
 *   node scripts/extract-accessory-layer.mjs <composite.png> <kind> <out.png>
 *   kind = crown | jewelry | prop
 */
import { decode, encode, makeCanvas } from './lib-png.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [compPath, kind = 'crown', outPath] = process.argv.slice(2);
if (!compPath || !outPath) {
  console.error('Usage: node scripts/extract-accessory-layer.mjs <composite.png> <crown|jewelry|prop> <out.png>');
  process.exit(1);
}

const ROIS = {
  crown:   { x0: 0.25, y0: 0.00, x1: 0.80, y1: 0.30 },
  jewelry: { x0: 0.28, y0: 0.28, x1: 0.78, y1: 0.52 },
  prop:    { x0: 0.50, y0: 0.30, x1: 0.99, y1: 0.75 },
};
const thr = kind === 'jewelry' ? 42 : 48;

const base = decode(`${ROOT}/art/layers/look/gold-teal.png`);
const comp = decode(compPath);
const { w, h } = base;
if (comp.w !== w || comp.h !== h) {
  console.error(`Size mismatch: base ${w}x${h}, composite ${comp.w}x${comp.h}. Resize composite to 768x1024 first.`);
  process.exit(1);
}
for (let i = 0; i < w * h; i++) {
  if (comp.data[i * 4 + 3] === 0 && comp.data[i*4]+comp.data[i*4+1]+comp.data[i*4+2] > 0)
    comp.data[i * 4 + 3] = 255;
}
const roi = ROIS[kind] || ROIS.crown;
const x0 = Math.floor(w * roi.x0), x1 = Math.floor(w * roi.x1);
const y0 = Math.floor(h * roi.y0), y1 = Math.floor(h * roi.y1);
const out = makeCanvas(w, h, [0, 0, 0, 0]);
let n = 0;
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  const i = y * w + x, bi = i * 4, ci = i * 4;
  const ba = base.data[bi + 3];
  const dist = Math.sqrt(
    (comp.data[ci] - base.data[bi]) ** 2 +
    (comp.data[ci+1] - base.data[bi+1]) ** 2 +
    (comp.data[ci+2] - base.data[bi+2]) ** 2
  );
  const newly = ba < 25 && comp.data[ci+3] > 50;
  if (!newly && dist < thr) continue;
  let a = newly || dist > thr + 50 ? 255 : Math.min(255, Math.round(120 + ((dist - thr) / 50) * 135));
  out.data[ci] = comp.data[ci]; out.data[ci+1] = comp.data[ci+1];
  out.data[ci+2] = comp.data[ci+2]; out.data[ci+3] = a; n++;
}
// despeckle
const clean = Buffer.from(out.data);
for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
  const i = (y * w + x) * 4;
  if (out.data[i+3] < 30) continue;
  let neigh = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    if (out.data[((y+dy)*w+(x+dx))*4+3] > 30) neigh++;
  }
  if (neigh < 2) clean[i+3] = 0;
}
out.data = clean;
const dest = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
encode(out, dest);
console.log('wrote', dest, 'pixels', n);
