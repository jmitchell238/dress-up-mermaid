import fs from 'fs';
import zlib from 'zlib';

function decode(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, w, h, colorType;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); pos += 4;
    const type = buf.toString('ascii', pos, pos + 4); pos += 4;
    if (type === 'IHDR') { w = buf.readUInt32BE(pos); h = buf.readUInt32BE(pos + 4); colorType = buf[pos + 9]; }
    else if (type === 'IDAT') idat.push(buf.slice(pos, pos + len));
    else if (type === 'IEND') break;
    pos += len + 4;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels, out = Buffer.alloc(h * stride), bpp = channels;
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const rb = raw[rp++];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      switch (filter) {
        case 1: v = rb + a; break; case 2: v = rb + b; break;
        case 3: v = rb + ((a + b) >> 1); break;
        case 4: { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = rb + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
        default: v = rb;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  // normalize to rgba
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (channels === 4) { rgba[i*4]=out[i*4];rgba[i*4+1]=out[i*4+1];rgba[i*4+2]=out[i*4+2];rgba[i*4+3]=out[i*4+3]; }
    else if (channels === 3) { rgba[i*4]=out[i*3];rgba[i*4+1]=out[i*3+1];rgba[i*4+2]=out[i*3+2];rgba[i*4+3]=255; }
    else { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=out[i];rgba[i*4+3]=255; }
  }
  return { w, h, data: rgba };
}

function makeCanvas(W, H, bg=[20,40,70,255]) {
  const d = Buffer.alloc(W*H*4);
  for (let i=0;i<W*H;i++){ d[i*4]=bg[0];d[i*4+1]=bg[1];d[i*4+2]=bg[2];d[i*4+3]=bg[3]; }
  return { w:W, h:H, data:d };
}

// draw src (rgba) scaled into dst rect (dx,dy,dw,dh) with alpha compositing
function drawImage(dst, src, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const sy = Math.floor((y / dh) * src.h);
    const ty = Math.round(dy + y);
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor((x / dw) * src.w);
      const tx = Math.round(dx + x);
      if (tx < 0 || tx >= dst.w) continue;
      const si = (sy * src.w + sx) * 4, di = (ty * dst.w + tx) * 4;
      const a = src.data[si+3] / 255;
      if (a <= 0) continue;
      for (let k = 0; k < 3; k++)
        dst.data[di+k] = Math.round(src.data[si+k]*a + dst.data[di+k]*(1-a));
      dst.data[di+3] = 255;
    }
  }
}

function fitContain(sw, sh, bw, bh) {
  const s = Math.min(bw/sw, bh/sh);
  const w = sw*s, h = sh*s;
  return { w, h, x:(bw-w)/2, y:(bh-h)/2 };
}

function encode(canvas, file) {
  const { w, h, data } = canvas;
  const stride = w*4;
  const raw = Buffer.alloc(h*(stride+1));
  for (let y=0;y<h;y++){ raw[y*(stride+1)]=0; data.copy(raw, y*(stride+1)+1, y*stride, y*stride+stride); }
  const comp = zlib.deflateSync(raw);
  function chunk(type, d) {
    const b = Buffer.alloc(12 + d.length);
    b.writeUInt32BE(d.length, 0); b.write(type, 4);
    d.copy(b, 8);
    const crcBuf = Buffer.concat([Buffer.from(type), d]);
    b.writeUInt32BE(crc32(crcBuf) >>> 0, 8 + d.length);
    return b;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',comp), chunk('IEND',Buffer.alloc(0))]));
}
const crcTable = (() => { const t=[]; for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c;} return t; })();
function crc32(buf){ let c=0xffffffff; for(let i=0;i<buf.length;i++)c=crcTable[(c^buf[i])&0xff]^(c>>>8); return c^0xffffffff; }

export { decode, makeCanvas, drawImage, fitContain, encode };
