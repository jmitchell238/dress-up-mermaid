#!/usr/bin/env node
/**
 * Measure each look's true head / neck horizontal axis (fraction of art width).
 * These feed LOOKS[*].headX / neckX in js/config.js so crowns and necklaces
 * center on the character, not on the hair/tail-biased bounding box.
 *
 * Usage: node scripts/measure-centerline.mjs art/layers/look/*.png
 */
import fs from 'fs';
import zlib from 'zlib';

function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w, h, colorType; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); pos += 4;
    const type = buf.toString('ascii', pos, pos + 4); pos += 4;
    if (type === 'IHDR') { w = buf.readUInt32BE(pos); h = buf.readUInt32BE(pos + 4); colorType = buf[pos + 9]; }
    else if (type === 'IDAT') idat.push(buf.slice(pos, pos + len));
    else if (type === 'IEND') break;
    pos += len + 4;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride), bpp = ch; let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const rb = raw[rp++];
      const a = x >= bpp ? out[y*stride+x-bpp] : 0, b = y>0 ? out[(y-1)*stride+x] : 0, c = (x>=bpp&&y>0)?out[(y-1)*stride+x-bpp]:0;
      let v; switch (f){case 1:v=rb+a;break;case 2:v=rb+b;break;case 3:v=rb+((a+b)>>1);break;case 4:{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=rb+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);break;}default:v=rb;} out[y*stride+x]=v&0xff;
    }
  }
  return { w, h, ch, out };
}

// Centroid X of alpha in a horizontal band [y0,y1). Returns fraction of width.
function bandCenterX(img, y0, y1) {
  const { w, ch, out } = img;
  let sum = 0, cnt = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const a = ch === 4 ? out[(y*w+x)*4+3] : 255;
      if (a > 40) { sum += x; cnt++; }
    }
  return cnt ? sum / cnt / w : 0.5;
}

for (const f of process.argv.slice(2)) {
  const img = decode(f);
  // top ~6% band = top of head/hair; a lower band ~ neck/shoulders
  const headBand = bandCenterX(img, Math.round(img.h*0.06), Math.round(img.h*0.14));
  const neckBand = bandCenterX(img, Math.round(img.h*0.36), Math.round(img.h*0.44));
  const whole = bandCenterX(img, 0, img.h);
  console.log(f.split('/').pop().padEnd(20),
    'head', headBand.toFixed(3), 'neck', neckBand.toFixed(3), 'bboxCtr~', whole.toFixed(3));
}
