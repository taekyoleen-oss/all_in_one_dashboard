// TMAP 403 진단 — 키 자체 문제인가 / 상품 사용설정 문제인가 / 키 전달방식 문제인가.
//   같은 키로 여러 상품 · 여러 전달방식(헤더 appKey, 쿼리 appKey)을 교차로 때려본다.
//   키는 절대 출력하지 않는다.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const K = env.TMAP_APP_KEY;
console.log(`key: ${K.length}자, [${/^[A-Za-z0-9]+$/.test(K) ? "영숫자만" : "특수문자 포함"}]\n`);

const show = async (label, res) => {
  const ct = res.headers.get("content-type") ?? "";
  let note = "";
  if (ct.includes("json")) {
    const j = await res.json().catch(() => null);
    note = j?.error ? `${j.error.code ?? ""} ${j.error.message ?? ""}`.trim() : Object.keys(j ?? {}).join(",").slice(0, 60);
  } else {
    const b = Buffer.from(await res.arrayBuffer());
    note = `${ct} ${(b.length / 1024).toFixed(0)}KB`;
  }
  console.log(`  ${res.ok ? "✅" : "❌"} ${String(res.status).padEnd(4)} ${label.padEnd(38)} ${note}`);
  return res.ok;
};

/* 1) StaticMap (지도) — GET, appKey를 쿼리로 */
console.log("── 상품별 (키 전달: 쿼리 appKey) ──");
await show(
  "StaticMap",
  await fetch(
    `https://apis.openapi.sk.com/tmap/staticMap?version=1&appKey=${K}&coordType=WGS84GEO&longitude=126.9882&latitude=37.5512&zoom=15&width=256&height=256&format=PNG`,
  ),
);

/* 2) POI 검색 — 대개 기본 사용가능한 상품 */
await show(
  "POI 통합검색",
  await fetch(
    `https://apis.openapi.sk.com/tmap/pois?version=1&appKey=${K}&searchKeyword=${encodeURIComponent("남산타워")}&count=1`,
  ),
);

/* 3) 보행자 경로 — 쿼리로 키 전달 */
const body = {
  startX: "126.9946", startY: "37.5345",
  endX: "126.9882", endY: "37.5512",
  startName: encodeURIComponent("출발"), endName: encodeURIComponent("도착"),
  reqCoordType: "WGS84GEO", resCoordType: "WGS84GEO",
};
await show(
  "보행자 경로 (쿼리 appKey)",
  await fetch(`https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&appKey=${K}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }),
);

console.log("\n── 키 전달 방식별 (보행자 경로) ──");
for (const [label, init] of Object.entries({
  "헤더 appKey": { headers: { appKey: K, "content-type": "application/json" } },
  "헤더 appkey(소문자)": { headers: { appkey: K, "content-type": "application/json" } },
  "폼 인코딩 + 헤더": {
    headers: { appKey: K, "content-type": "application/x-www-form-urlencoded" },
    formEncode: true,
  },
})) {
  const { formEncode, ...rest } = init;
  await show(
    label,
    await fetch("https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1", {
      method: "POST",
      ...rest,
      body: formEncode ? new URLSearchParams(body).toString() : JSON.stringify(body),
    }),
  );
}

/* 4) 자동차 경로 — 경로 상품군 전체가 막힌 건지 보행자만 막힌 건지 */
console.log("\n── 같은 '경로안내' 상품군 대조 ──");
await show(
  "자동차 경로",
  await fetch("https://apis.openapi.sk.com/tmap/routes?version=1", {
    method: "POST",
    headers: { appKey: K, "content-type": "application/json" },
    body: JSON.stringify(body),
  }),
);
