// P0 게이트 — 길찾기 위젯의 3가지 전제를 실호출로 확정한다(PLAN-walk-route-widget.md §6).
//
//   ① TMAP 보행자 경로안내 실응답 shape (LineString/Point, turnType·description 실값)
//   ② TMAP StaticMap 파라미터 + 마커 포맷, 그리고 **표준 Web Mercator 좌표계 가정**
//   ③ Open-Meteo 고도 API — 100점 1회 요청
//
//  ②의 좌표계 가정이 A안(이미지+SVG 오버레이)의 성립 조건이다. 이 스크립트는 지도 PNG와
//  "우리 수학으로 그린 경로선"을 겹친 HTML을 뱉는다 — 선이 도로 위를 따라가면 통과,
//  건물을 가로지르면 A안 폐기(→ C안 Leaflet).
//
//  사용: node _workspace/verify-tmap.mjs
//  산출: _workspace/out/{staticmap.png, overlay.html, route.json}
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const APP_KEY = env.TMAP_APP_KEY;
if (!APP_KEY) {
  console.error("⛔ .env.local에 TMAP_APP_KEY가 없습니다.");
  process.exit(2);
}

const OUT = new URL("./out/", import.meta.url);
mkdirSync(OUT, { recursive: true });

let pass = 0,
  total = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

/* ── 검증 경로: 이태원역 → N서울타워 (약 1.5km 오르막 — 고도 그래프가 의미 있는 구간) ── */
const START = { name: "이태원역", lat: 37.5345, lon: 126.9946 };
const END = { name: "N서울타워", lat: 37.5512, lon: 126.9882 };

/* ══════════════════════ ① 보행자 경로안내 ══════════════════════ */

const routeRes = await fetch(
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1",
  {
    method: "POST",
    headers: { appKey: APP_KEY, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      startX: String(START.lon),
      startY: String(START.lat),
      endX: String(END.lon),
      endY: String(END.lat),
      startName: encodeURIComponent(START.name),
      endName: encodeURIComponent(END.name),
      reqCoordType: "WGS84GEO",
      resCoordType: "WGS84GEO",
      searchOption: "0",
    }),
  },
);

check("보행자 경로 HTTP 200", routeRes.ok, `status=${routeRes.status}`);
const route = await routeRes.json();
writeFileSync(new URL("./route.json", OUT), JSON.stringify(route, null, 2));

if (!routeRes.ok) {
  console.error(JSON.stringify(route).slice(0, 600));
  process.exit(1);
}

const features = route.features ?? [];
check("FeatureCollection features 존재", features.length > 0, `${features.length}개`);

const geomTypes = [...new Set(features.map((f) => f.geometry?.type))];
console.log(`\n   geometry 종류: ${geomTypes.join(", ")}`);

const points = features.filter((f) => f.geometry?.type === "Point");
const lines = features.filter((f) => f.geometry?.type === "LineString");
check("Point(안내지점) + LineString(경로) 둘 다 있음", points.length > 0 && lines.length > 0, `Point ${points.length} / LineString ${lines.length}`);

// 총거리·총시간은 어느 feature에 실려 오는가
const withTotals = features.find((f) => f.properties?.totalDistance != null);
const totalDistance = withTotals?.properties?.totalDistance;
const totalTime = withTotals?.properties?.totalTime;
check(
  "totalDistance/totalTime 수신",
  Number.isFinite(totalDistance) && Number.isFinite(totalTime),
  `${totalDistance}m · ${Math.round((totalTime ?? 0) / 60)}분 (index=${features.indexOf(withTotals)})`,
);

console.log("\n   Point properties 키:", [...new Set(points.flatMap((f) => Object.keys(f.properties ?? {})))].join(", "));
console.log("   LineString properties 키:", [...new Set(lines.flatMap((f) => Object.keys(f.properties ?? {})))].join(", "));

// turnType ↔ description 실값 — 아이콘 매핑표를 실데이터로 확정
console.log("\n   ── 안내 지점(turnType · description) ──");
const turnSamples = new Map();
for (const p of points) {
  const t = p.properties?.turnType;
  if (t != null && !turnSamples.has(t)) turnSamples.set(t, p.properties?.description ?? "");
}
for (const [t, d] of [...turnSamples].sort((a, b) => a[0] - b[0])) {
  console.log(`   turnType ${String(t).padStart(3)} : ${d}`);
}
check("description 한국어 안내 문구 존재", points.some((p) => (p.properties?.description ?? "").length > 0));

/* 경로 폴리라인 조립 — LineString들을 순서대로 이어 붙인다 */
const ordered = [...lines].sort(
  (a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0),
);
const path = [];
for (const f of ordered) {
  for (const [lon, lat] of f.geometry.coordinates) {
    const last = path[path.length - 1];
    if (!last || last[0] !== lon || last[1] !== lat) path.push([lon, lat]);
  }
}
check("폴리라인 조립", path.length > 1, `${path.length}점`);

/* ══════════════════════ 지오 계산 (lib/widgets/route/geo.ts 가 될 부분) ══════════════════════ */

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
/** 각 점까지의 누적 거리(m). */
function cumulative(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + haversine(pts[i - 1], pts[i]));
  return out;
}
/** 거리 기준 등간격 n점으로 리샘플(양 끝 포함). */
function resample(pts, n) {
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total === 0) return pts.slice(0, 1);
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j];
    const t = span === 0 ? 0 : (target - cum[j]) / span;
    out.push([
      pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t,
      pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t,
    ]);
  }
  return out;
}

// 실측 확정(_workspace/verify-scale3.mjs): 티맵 StaticMap은 512px 타일 = 표준 zoom+1
const TILE = 512;
/** WGS84 → Web Mercator 월드 픽셀 좌표(zoom 기준). */
function project(lon, lat, zoom) {
  const scale = TILE * 2 ** zoom;
  const s = Math.min(Math.max(Math.sin(rad(lat)), -0.9999), 0.9999);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

const cum = cumulative(path);
const pathLength = cum[cum.length - 1];
check(
  "폴리라인 길이 ≈ totalDistance",
  Math.abs(pathLength - totalDistance) / totalDistance < 0.05,
  `계산 ${Math.round(pathLength)}m vs API ${totalDistance}m`,
);

/* ══════════════════════ ③ Open-Meteo 고도 ══════════════════════ */

const SAMPLES = 100;
const sampled = resample(path, SAMPLES);
const eleRes = await fetch(
  `https://api.open-meteo.com/v1/elevation?latitude=${sampled.map((p) => p[1].toFixed(5)).join(",")}&longitude=${sampled.map((p) => p[0].toFixed(5)).join(",")}`,
);
check("Open-Meteo 고도 HTTP 200 (키 없음)", eleRes.ok, `status=${eleRes.status}`);
const eleJson = await eleRes.json();
const elevation = eleJson.elevation ?? [];
check("고도 100점 1회 응답", elevation.length === SAMPLES, `${elevation.length}점`);

if (elevation.length === SAMPLES) {
  const min = Math.min(...elevation);
  const max = Math.max(...elevation);
  let gain = 0;
  for (let i = 1; i < elevation.length; i++) {
    const d = elevation[i] - elevation[i - 1];
    if (d > 0) gain += d;
  }
  console.log(
    `\n   고도: 출발 ${elevation[0]}m → 도착 ${elevation[SAMPLES - 1]}m · 최저 ${min}m / 최고 ${max}m · 누적상승 ${Math.round(gain)}m`,
  );
  check("고도 변화가 관측됨(그래프가 평평하지 않음)", max - min >= 10, `고저차 ${Math.round(max - min)}m`);
  // 스파크라인 미리보기
  const bars = "▁▂▃▄▅▆▇█";
  const spark = elevation
    .filter((_, i) => i % 2 === 0)
    .map((e) => bars[Math.min(7, Math.floor(((e - min) / Math.max(1, max - min)) * 8))])
    .join("");
  console.log(`   ${spark}`);
}

/* ══════════════════════ ② StaticMap + 좌표계 검증 ══════════════════════ */

// bbox → 512×512에 맞는 center/zoom 산출
const lons = path.map((p) => p[0]);
const lats = path.map((p) => p[1]);
const bbox = {
  w: Math.min(...lons), e: Math.max(...lons),
  s: Math.min(...lats), n: Math.max(...lats),
};
const center = { lon: (bbox.w + bbox.e) / 2, lat: (bbox.s + bbox.n) / 2 };
const SIZE = 512;
const PAD = 24;
let zoom = 19;
for (let z = 19; z >= 6; z--) {
  const a = project(bbox.w, bbox.n, z);
  const b = project(bbox.e, bbox.s, z);
  if (b.x - a.x <= SIZE - PAD * 2 && b.y - a.y <= SIZE - PAD * 2) { zoom = z; break; }
}
console.log(`\n   지도: center ${center.lat.toFixed(5)},${center.lon.toFixed(5)} · zoom ${zoom} · ${SIZE}×${SIZE}`);

const staticUrl = (extra = {}) => {
  const q = new URLSearchParams({
    version: "1",
    appKey: APP_KEY,
    coordType: "WGS84GEO",
    longitude: String(center.lon),
    latitude: String(center.lat),
    zoom: String(zoom),
    width: String(SIZE),
    height: String(SIZE),
    format: "PNG",
    ...extra,
  });
  return `https://apis.openapi.sk.com/tmap/staticMap?${q}`;
};

const baseRes = await fetch(staticUrl());
const baseBuf = Buffer.from(await baseRes.arrayBuffer());
check(
  "StaticMap PNG 수신",
  baseRes.ok && baseBuf.length > 1000 && baseBuf.subarray(1, 4).toString() === "PNG",
  `${baseRes.status} · ${(baseBuf.length / 1024).toFixed(0)}KB · ${baseRes.headers.get("content-type")}`,
);
writeFileSync(new URL("./staticmap.png", OUT), baseBuf);

// 마커 포맷 탐침 — 문서에 형식이 없어 후보를 넣어보고 "이미지 바이트가 달라지는지"로 판정한다
const mk = `${START.lon},${START.lat}`;
const candidates = {
  "markers=lon,lat": { markers: mk },
  "markers=lon,lat,name": { markers: `${mk},S` },
  "markers=lon,lat|lon,lat": { markers: `${mk}|${END.lon},${END.lat}` },
  "markers=lon,lat_lon,lat": { markers: `${mk}_${END.lon},${END.lat}` },
};
console.log("\n   ── StaticMap 마커 포맷 탐침 (baseline 대비 바이트 변화) ──");
let markerFormat = null;
for (const [label, extra] of Object.entries(candidates)) {
  const r = await fetch(staticUrl(extra));
  const b = Buffer.from(await r.arrayBuffer());
  const changed = r.ok && b.length > 1000 && !b.equals(baseBuf);
  console.log(`   ${changed ? "★" : " "} ${label.padEnd(26)} ${r.status} ${(b.length / 1024).toFixed(0)}KB${changed ? "  ← 렌더됨" : ""}`);
  if (changed && !markerFormat) {
    markerFormat = label;
    writeFileSync(new URL("./staticmap-markers.png", OUT), b);
  }
}
check("StaticMap 마커 포맷 확인", markerFormat != null, markerFormat ?? "어떤 후보도 baseline과 다르지 않음(마커 미지원 가능)");

/* 좌표계 검증용 오버레이 HTML — 우리 수학으로 그린 경로선을 지도 위에 겹친다 */
const c = project(center.lon, center.lat, zoom);
const toPx = ([lon, lat]) => {
  const p = project(lon, lat, zoom);
  return [p.x - c.x + SIZE / 2, p.y - c.y + SIZE / 2];
};
const poly = path.map(toPx).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const [sx, sy] = toPx([START.lon, START.lat]);
const [ex, ey] = toPx([END.lon, END.lat]);
const guides = points
  .filter((p) => p.geometry?.coordinates)
  .map((p) => toPx(p.geometry.coordinates));

writeFileSync(
  new URL("./overlay.html", OUT),
  `<!doctype html><meta charset="utf-8"><title>TMAP 좌표계 검증</title>
<body style="margin:0;background:#111;color:#eee;font:13px system-ui">
<p style="padding:8px 12px;margin:0">경로선(빨강)이 <b>도로를 따라가면</b> Web Mercator 가정 통과 · 건물을 가로지르면 A안 폐기</p>
<div style="position:relative;width:${SIZE}px;height:${SIZE}px;margin:0 12px">
  <img src="./staticmap.png" width="${SIZE}" height="${SIZE}" style="position:absolute;inset:0">
  <svg width="${SIZE}" height="${SIZE}" style="position:absolute;inset:0">
    <polyline points="${poly}" fill="none" stroke="#ff2d55" stroke-width="4" stroke-opacity="0.85" stroke-linejoin="round" stroke-linecap="round"/>
    ${guides.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#00e5ff" fill-opacity="0.9"/>`).join("\n    ")}
    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7" fill="none" stroke="#00ff88" stroke-width="3"/>
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="7" fill="none" stroke="#ffd60a" stroke-width="3"/>
  </svg>
</div>
<p style="padding:8px 12px;margin:0">초록=출발 · 노랑=도착 · 하늘=안내지점 · zoom ${zoom}</p>
</body>`,
);

console.log(`\n   오버레이: _workspace/out/overlay.html (육안 확인 필요)`);
console.log(`\n${pass}/${total} PASS`);
