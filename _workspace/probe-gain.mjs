/**
 * 누적 상승을 경로끼리 비교하려면 **공간 간격을 맞춰야** 한다.
 *
 * 앞선 두 측정(probe-purpose: 340 vs 412 / verify API: 371 vs 343)이 서로
 * 뒤집힌 이유를 확인한다 — 둘 다 "경로마다 100점"이라 긴 경로일수록 표본이
 * 성글어져 DEM 잔떨림이 덜 쌓인다. 길이가 다른 경로의 상승량을 그렇게 비교하면
 * 안 된다. 여기서는 두 경로 모두 **고정 25m 간격**으로 뽑아 다시 잰다.
 */
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const R = 6371000, rad = (d) => (d * Math.PI) / 180;
const hav = (a, b) => {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function route(so, c) {
  const r = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
    method: "POST",
    headers: { appKey: env.TMAP_APP_KEY, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      startX: c[0], startY: c[1], endX: c[2], endY: c[3],
      startName: encodeURIComponent("A"), endName: encodeURIComponent("B"),
      reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO", searchOption: String(so),
    }),
  });
  const j = JSON.parse(await r.text());
  const path = [];
  let cat1 = 0, total = 0;
  for (const f of j.features) {
    const p = f.properties ?? {};
    if (p.totalDistance != null) total = p.totalDistance;
    if (f.geometry?.type !== "LineString") continue;
    if (String(p.categoryRoadType) === "1") cat1 += Number(p.distance) || 0;
    for (const q of f.geometry.coordinates) {
      const last = path[path.length - 1];
      if (!last || last[0] !== q[0] || last[1] !== q[1]) path.push(q);
    }
  }
  return { path, total, cat1 };
}

/** 경로를 고정 간격(m)으로 다시 뽑는다. */
function atInterval(path, step) {
  const out = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    let seg = hav(path[i - 1], path[i]);
    if (seg === 0) continue;
    let t = (step - carry) / seg;
    while (t <= 1) {
      out.push([
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ]);
      t += step / seg;
    }
    carry = (carry + seg) % step;
  }
  return out;
}

async function elevations(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 100) {
    const b = pts.slice(i, i + 100);
    const r = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${b.map((p) => p[1]).join(",")}&longitude=${b.map((p) => p[0]).join(",")}`,
    );
    if (!r.ok) throw new Error(`elevation ${r.status}`);
    out.push(...(await r.json()).elevation);
    await new Promise((s) => setTimeout(s, 400));
  }
  return out;
}

const gain = (e) => {
  let up = 0;
  for (let i = 1; i < e.length; i++) if (e[i] > e[i - 1]) up += e[i] - e[i - 1];
  return Math.round(up);
};

const NAMSAN = ["126.99461", "37.53454", "126.98817", "37.5513"];
console.log("이태원역 → N서울타워 · 고정 25m 간격 표본으로 재측정\n");
for (const so of [0, 30]) {
  const r = await route(so, NAMSAN);
  const pts = atInterval(r.path, 25);
  const e = await elevations(pts);
  console.log(
    `  so=${String(so).padStart(2)}: ${r.total}m · 표본 ${pts.length}점(25m 간격)` +
    ` · 상승 ${gain(e)}m · 최고 ${Math.round(Math.max(...e))}m` +
    ` · 특화거리(산책로) ${Math.round(r.cat1)}m`,
  );
  // 참고: "경로마다 100점" 방식으로도 같이 재서 왜곡 폭을 보인다.
  const step = Math.max(1, Math.ceil(r.path.length / 100));
  const coarse = r.path.filter((_, i) => i % step === 0).slice(0, 100);
  const e2 = await elevations(coarse);
  console.log(`         (경로마다 100점으로 재면 상승 ${gain(e2)}m — 표본 간격 ${Math.round(r.total / 100)}m)`);
}
