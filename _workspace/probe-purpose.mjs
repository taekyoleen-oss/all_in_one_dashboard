/**
 * 목적별(등산·강변) 경로가 TMAP에서 가능한가 — 실호출로 확인.
 *
 *  ① searchOption 0/4/10/30 이 실제로 경로를 바꾸는가 (문서상 4가지뿐)
 *  ② 문서에 없는 값(1·2·3·20)을 받는가 — 숨은 프로파일이 있는지
 *  ③ 응답의 roadType / categoryRoadType / facilityType 분포가
 *     등산 경로와 강변 경로에서 어떻게 다른가 (요청이 아니라 응답 필드)
 *  ④ 고도 상승량 차이 (Open-Meteo)
 *  ⑤ TMAP POI 검색(/tmap/pois)이 이 키로 열려 있는가 — '가까운 산·강변' 자동 경유지용
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const K = env.TMAP_APP_KEY;

const CASES = {
  등산: {
    start: { x: "126.99461", y: "37.53454", n: "이태원역" },
    end: { x: "126.98817", y: "37.5513", n: "N서울타워" },
  },
  강변: {
    start: { x: "126.99560", y: "37.51100", n: "반포한강공원" },
    end: { x: "127.01900", y: "37.52200", n: "잠원한강공원" },
  },
};

async function route(c, searchOption, extra = {}) {
  const r = await fetch(
    "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1",
    {
      method: "POST",
      headers: { appKey: K, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        startX: c.start.x, startY: c.start.y, endX: c.end.x, endY: c.end.y,
        startName: encodeURIComponent(c.start.n), endName: encodeURIComponent(c.end.n),
        reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO",
        searchOption: String(searchOption), ...extra,
      }),
    },
  );
  const t = await r.text();
  if (!r.ok) return { err: `${r.status} ${t.replace(/\s+/g, " ").slice(0, 100)}` };
  const j = JSON.parse(t);
  const sp = j.features.find((f) => f.properties?.totalDistance != null)?.properties;
  const path = [];
  const tally = { roadType: {}, categoryRoadType: {}, facilityType: {} };
  for (const f of j.features) {
    const p = f.properties ?? {};
    for (const k of Object.keys(tally)) {
      if (p[k] != null && p[k] !== "") {
        const key = String(p[k]);
        tally[k][key] = (tally[k][key] ?? 0) + (f.geometry?.type === "LineString" ? Number(p.distance) || 0 : 0);
      }
    }
    if (f.geometry?.type === "LineString") for (const q of f.geometry.coordinates) path.push(q);
  }
  return { dist: sp.totalDistance, time: sp.totalTime, path, tally };
}

async function gain(path) {
  if (!path?.length) return null;
  const step = Math.max(1, Math.ceil(path.length / 100));
  const pts = path.filter((_, i) => i % step === 0).slice(0, 100);
  const r = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p[1]).join(",")}&longitude=${pts.map((p) => p[0]).join(",")}`,
  );
  if (!r.ok) return null;
  const e = (await r.json()).elevation;
  let up = 0, down = 0;
  for (let i = 1; i < e.length; i++) {
    const d = e[i] - e[i - 1];
    if (d > 0) up += d; else down -= d;
  }
  return { up: Math.round(up), down: Math.round(down), min: Math.round(Math.min(...e)), max: Math.round(Math.max(...e)) };
}

const fmt = (o) =>
  Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${Math.round(v)}m`).join(" ");

for (const [name, c] of Object.entries(CASES)) {
  console.log(`\n══ ${name} (${c.start.n} → ${c.end.n}) ══`);
  for (const opt of [0, 4, 10, 30]) {
    const r = await route(c, opt);
    if (r.err) { console.log(`  so=${opt}: ❌ ${r.err}`); continue; }
    const g = await gain(r.path);
    console.log(
      `  so=${String(opt).padStart(2)}: ${String(r.dist).padStart(5)}m ${String(Math.round(r.time / 60)).padStart(3)}분` +
      (g ? ` · 상승 ${String(g.up).padStart(4)}m 하강 ${String(g.down).padStart(4)}m (${g.min}~${g.max}m)` : ""),
    );
    console.log(`        roadType     ${fmt(r.tally.roadType) || "-"}`);
    console.log(`        categoryRoad ${fmt(r.tally.categoryRoadType) || "-"}`);
    console.log(`        facility     ${fmt(r.tally.facilityType) || "-"}`);
  }
}

console.log("\n══ 문서에 없는 searchOption 값을 받는가 ══");
for (const opt of [1, 2, 3, 20, 31, 99]) {
  const r = await route(CASES.등산, opt);
  console.log(`  so=${String(opt).padStart(2)}: ${r.err ? `거절 ${r.err}` : `${r.dist}m ${Math.round(r.time / 60)}분`}`);
}

console.log("\n══ 목적 힌트가 될 만한 요청 파라미터 ══");
for (const [label, extra] of [
  ["routeOption=trail", { routeOption: "trail" }],
  ["poiOption=trail", { poiOption: "trail" }],
  ["theme=1", { theme: "1" }],
]) {
  const r = await route(CASES.등산, 0, extra);
  console.log(`  ${label}: ${r.err ? `거절 ${r.err}` : `${r.dist}m (기준과 같으면 무시된 것)`}`);
}

console.log("\n══ TMAP POI 검색이 이 키로 열려 있는가 ══");
for (const kw of ["남산", "한강공원"]) {
  const r = await fetch(
    `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(kw)}&count=3&resCoordType=WGS84GEO&searchtypCd=R&centerLon=126.99&centerLat=37.53&radius=10`,
    { headers: { appKey: K, Accept: "application/json" } },
  );
  const t = await r.text();
  if (!r.ok) { console.log(`  "${kw}": ❌ ${r.status} ${t.replace(/\s+/g, " ").slice(0, 120)}`); continue; }
  const list = JSON.parse(t)?.searchPoiInfo?.pois?.poi ?? [];
  console.log(`  "${kw}": ✅ ${list.length}건 — ${list.map((p) => `${p.name}(${p.upperBizName}>${p.middleBizName})`).join(", ")}`);
}
