// 경유지(passList)가 실제로 경로를 바꾸는가 — TMAP 직접 호출로 확인.
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const K = env.TMAP_APP_KEY;
const call = async (label, extra) => {
  const r = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
    method: "POST",
    headers: { appKey: K, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      startX: "126.99461", startY: "37.53454",
      endX: "126.98817", endY: "37.5513",
      startName: encodeURIComponent("이태원역"), endName: encodeURIComponent("N서울타워"),
      reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO", searchOption: "0", ...extra,
    }),
  });
  const t = await r.text();
  if (!r.ok) { console.log(`  ❌ ${label}: ${r.status} ${t.replace(/\s+/g,' ').slice(0,120)}`); return null; }
  const j = JSON.parse(t);
  const sp = j.features.find((f) => f.properties?.totalDistance != null)?.properties;
  const pts = j.features.filter((f) => f.geometry?.type === "Point");
  const via = pts.filter((p) => String(p.properties?.pointType || "").startsWith("PP"));
  console.log(`  ✅ ${label}: ${sp.totalDistance}m · ${Math.round(sp.totalTime/60)}분 · 안내 ${pts.length}개 · 경유지 마커 ${via.length}개`);
  return sp.totalDistance;
};

console.log("── 경유지 없이 vs 있을 때 ──");
const base = await call("경유지 없음", {});
// 남산도서관 쪽(서쪽)을 경유 — 직선 경로와 뚜렷이 다른 곳
const one = await call("경유지 1개(남산도서관 부근)", { passList: "126.98150,37.55000" });
const two = await call("경유지 2개", { passList: "126.98150,37.55000_126.98500,37.54700" });
await call("경유지 5개(상한)", { passList: "126.9930,37.5380_126.9910,37.5420_126.9880,37.5450_126.9850,37.5480_126.9860,37.5500" });
await call("경유지 6개(상한 초과)", { passList: "126.9930,37.5380_126.9910,37.5420_126.9880,37.5450_126.9850,37.5480_126.9860,37.5500_126.9870,37.5505" });
console.log(`\n  경유지가 경로를 바꾸는가: ${base && one && one !== base ? `예 (${base}m → ${one}m)` : "아니오"}`);
