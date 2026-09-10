/** facilityType 17 = 계단인가 — 안내문구와 대조해 확정한다. */
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const r = await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
  method: "POST",
  headers: { appKey: env.TMAP_APP_KEY, Accept: "application/json", "Content-Type": "application/json" },
  body: JSON.stringify({
    startX: "126.99461", startY: "37.53454", endX: "126.98817", endY: "37.5513",
    startName: encodeURIComponent("이태원역"), endName: encodeURIComponent("N서울타워"),
    reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO", searchOption: "0",
  }),
});
const feats = JSON.parse(await r.text()).features
  .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0));

// LineString의 facilityType과, 그 직전 Point의 description을 나란히 본다.
let lastDesc = "";
const byType = {};
for (const f of feats) {
  const p = f.properties ?? {};
  if (f.geometry?.type === "Point") { lastDesc = p.description || lastDesc; continue; }
  const t = String(p.facilityType ?? "");
  (byType[t] ??= []).push(`${p.distance}m ← "${lastDesc.slice(0, 40)}"`);
}
for (const [t, rows] of Object.entries(byType).sort()) {
  console.log(`\nfacilityType=${t} (${rows.length}구간)`);
  for (const row of rows.slice(0, 6)) console.log(`   ${row}`);
}
