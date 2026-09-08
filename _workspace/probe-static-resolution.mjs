// 지도 해상도를 올릴 방법이 있는가 — StaticMap의 크기·배율 한계를 실측한다.
//   문서는 width/height 1~512라고만 적혀 있다. 실제로 더 큰 값·retina 배율을
//   받아주는지, 안 되면 무엇이 남는지 확인한다.
//   사용: node _workspace/probe-static-resolution.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const K = env.TMAP_APP_KEY;

/** PNG 헤더에서 실제 픽셀 크기를 읽는다(응답이 요청대로인지 확인). */
function pngSize(buf) {
  if (buf.length < 24 || buf.subarray(1, 4).toString() !== "PNG") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const call = async (label, params) => {
  const q = new URLSearchParams({
    version: "1",
    appKey: K,
    coordType: "WGS84GEO",
    longitude: "126.9924",
    latitude: "37.5430",
    zoom: "16",
    format: "PNG",
    ...params,
  });
  try {
    const r = await fetch(`https://apis.openapi.sk.com/tmap/staticMap?${q}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const size = pngSize(buf);
    const ct = r.headers.get("content-type") ?? "";
    const body = size ? "" : buf.toString("utf8").replace(/\s+/g, " ").slice(0, 90);
    console.log(
      `  ${String(r.status).padEnd(4)} ${label.padEnd(34)} ${
        size ? `${size.w}×${size.h}px ${(buf.length / 1024).toFixed(0)}KB` : `${ct} ${body}`
      }`,
    );
    return size;
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(34)} ${e.message}`);
    return null;
  }
};

console.log("── 요청 크기를 키우면 받아주는가 ──");
await call("512×512 (문서상 최대)", { width: "512", height: "512" });
await call("640×640", { width: "640", height: "640" });
await call("1024×1024", { width: "1024", height: "1024" });
await call("1280×720", { width: "1280", height: "720" });

console.log("\n── retina/배율 파라미터가 있는가 ──");
await call("scale=2", { width: "512", height: "512", scale: "2" });
await call("dpi=2", { width: "512", height: "512", dpi: "2" });
await call("retina=true", { width: "512", height: "512", retina: "true" });
await call("resolution=2", { width: "512", height: "512", resolution: "2" });

console.log("\n── 같은 zoom에서 타일을 이어 붙이면(모자이크) ──");
console.log("  → 512×512 4장 = 1024×1024. 투영을 우리가 알고 있으므로 가능.");
const TILE = 512;
const rad = (d) => (d * Math.PI) / 180;
const project = (lon, lat, z) => {
  const s = TILE * 2 ** z;
  const sn = Math.sin(rad(lat));
  return {
    x: ((lon + 180) / 360) * s,
    y: (0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI)) * s,
  };
};
const unproject = (x, y, z) => {
  const s = TILE * 2 ** z;
  return {
    lon: (x / s) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / s))),
  };
};
// 2×2 모자이크의 각 조각 중심 좌표를 계산해 4장이 모두 받아지는지 확인
const Z = 16;
const c = project(126.9924, 37.543, Z);
let ok = 0;
for (const [dx, dy] of [[-256, -256], [256, -256], [-256, 256], [256, 256]]) {
  const p = unproject(c.x + dx, c.y + dy, Z);
  const size = await call(
    `조각 (${dx > 0 ? "+" : ""}${dx},${dy > 0 ? "+" : ""}${dy})`,
    { width: "512", height: "512", longitude: String(p.lon), latitude: String(p.lat) },
  );
  if (size?.w === 512) ok++;
}
console.log(`  모자이크 4장 중 ${ok}장 수신 — ${ok === 4 ? "1024×1024 구성 가능" : "실패"}`);

console.log("\n── 줌을 올리면 같은 픽셀에 더 자세히 담기는가 ──");
for (const z of [14, 16, 18, 19]) {
  await call(`zoom ${z}`, { width: "512", height: "512", zoom: String(z) });
}
