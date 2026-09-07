// 최소 PNG 디코더 + 픽셀 diff — 육안 대신 "티맵 마커의 실제 픽셀 좌표"를 측정한다.
//  A안의 전제(표준 Web Mercator)를 숫자로 확정하기 위한 도구. zlib은 node 내장.
import { inflateSync } from "node:zlib";

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("PNG 아님");
  let off = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  let plte = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9]; interlace = data[12];
    } else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`bitDepth ${depth} 미지원`);
  if (interlace !== 0) throw new Error("interlaced 미지원");
  const chan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!chan) throw new Error(`colorType ${color} 미지원`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = chan, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  // RGB로 정규화
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl;
    if (color === 3) { const idx = out[i] * 3; r = plte[idx]; g = plte[idx + 1]; bl = plte[idx + 2]; }
    else if (color === 0) { r = g = bl = out[i]; }
    else if (color === 4) { r = g = bl = out[i * 2]; }
    else { r = out[i * chan]; g = out[i * chan + 1]; bl = out[i * chan + 2]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = bl;
  }
  return { w, h, rgb, color, depth };
}

/** 두 이미지의 다른 픽셀들의 무게중심과 바운딩박스. */
export function diffCentroid(a, b, threshold = 24) {
  let n = 0, sx = 0, sy = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * 3;
      const d = Math.abs(a.rgb[i] - b.rgb[i]) + Math.abs(a.rgb[i + 1] - b.rgb[i + 1]) + Math.abs(a.rgb[i + 2] - b.rgb[i + 2]);
      if (d > threshold) {
        n++; sx += x; sy += y;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return n === 0 ? null : { count: n, cx: sx / n, cy: sy / n, minX, minY, maxX, maxY };
}
