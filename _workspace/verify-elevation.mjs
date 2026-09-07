// P0 ③ — 고도 파이프라인 검증 (TMAP 키 불필요).
//   TMAP 경로가 아직 안 나오므로, 남산 오르막 위 합성 경로로 파이프라인 계약만 확인한다:
//   폴리라인 → 거리 등간격 100점 리샘플 → Open-Meteo 고도 1회 요청 → 프로파일.
//   (경로의 실제 정확도가 아니라 "100점 1회 요청이 되는가 · 값이 그럴듯한가"를 본다)
//   사용: node _workspace/verify-elevation.mjs

let pass = 0, total = 0;
const check = (name, ok, detail = "") => {
  total++; if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const haversine = ([lo1, la1], [lo2, la2]) => {
  const a = Math.sin(rad(la2 - la1) / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const cumulative = (pts) => {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + haversine(pts[i - 1], pts[i]));
  return out;
};
const resample = (pts, n) => {
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  if (total === 0) return [pts[0]];
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
};

/* ── 리샘플 자체 검증(순수 로직 — geo.test.ts로 옮겨갈 내용) ── */
{
  // 적도 위 동서 직선: 리샘플 간격이 균일해야 한다
  const line = [[0, 0], [0.01, 0], [0.05, 0]];
  const rs = resample(line, 11);
  const gaps = [];
  for (let i = 1; i < rs.length; i++) gaps.push(haversine(rs[i - 1], rs[i]));
  const spread = (Math.max(...gaps) - Math.min(...gaps)) / Math.max(...gaps);
  check("리샘플: 등간격", spread < 0.01, `간격 편차 ${(spread * 100).toFixed(3)}%`);
  check("리샘플: 양 끝 보존",
    Math.abs(rs[0][0]) < 1e-9 && Math.abs(rs[10][0] - 0.05) < 1e-9);
  check("리샘플: 요청한 개수", rs.length === 11, `${rs.length}점`);
  check("누적거리 단조증가", cumulative(line).every((v, i, a) => i === 0 || v > a[i - 1]));
}

/* ── 남산 오르막 합성 경로(이태원역 → N서울타워 직선) ── */
const START = [126.9946, 37.5345];
const END = [126.9882, 37.5512];
const path = Array.from({ length: 40 }, (_, i) => {
  const t = i / 39;
  return [START[0] + (END[0] - START[0]) * t, START[1] + (END[1] - START[1]) * t];
});
const length = cumulative(path).at(-1);
console.log(`\n   합성 경로 ${Math.round(length)}m (이태원역 → N서울타워 직선)\n`);

const SAMPLES = 100;
const sampled = resample(path, SAMPLES);
const t0 = Date.now();
const res = await fetch(
  `https://api.open-meteo.com/v1/elevation?latitude=${sampled.map((p) => p[1].toFixed(5)).join(",")}&longitude=${sampled.map((p) => p[0].toFixed(5)).join(",")}`,
);
const ms = Date.now() - t0;
check("Open-Meteo 고도 200 (API 키 없이)", res.ok, `${res.status} · ${ms}ms`);
const json = await res.json();
const ele = json.elevation ?? [];
check("좌표 100개 → 1회 요청으로 100개 응답", ele.length === SAMPLES, `${ele.length}개`);

if (ele.length === SAMPLES) {
  const min = Math.min(...ele), max = Math.max(...ele);
  let gain = 0, loss = 0;
  for (let i = 1; i < ele.length; i++) {
    const d = ele[i] - ele[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  console.log(`   출발 ${ele[0]}m → 도착 ${ele.at(-1)}m · 최저 ${min}m / 최고 ${max}m`);
  console.log(`   누적상승 ${Math.round(gain)}m · 누적하강 ${Math.round(loss)}m`);
  const bars = "▁▂▃▄▅▆▇█";
  console.log("   " + ele.filter((_, i) => i % 2 === 0)
    .map((e) => bars[Math.min(7, Math.floor(((e - min) / Math.max(1, max - min)) * 8))]).join(""));

  check("남산 정상부 고도가 실제와 부합(230~300m)", ele.at(-1) >= 230 && ele.at(-1) <= 300, `도착 ${ele.at(-1)}m`);
  check("오르막이 그래프로 드러남", max - min >= 100, `고저차 ${Math.round(max - min)}m`);
  check("모든 값이 유한한 숫자", ele.every((e) => Number.isFinite(e)));
}

/* 상한 확인 — 101점은 거부되는가(리샘플 상한을 100으로 잡은 근거) */
{
  const over = Array.from({ length: 101 }, (_, i) => [126.99, 37.53 + i * 1e-4]);
  const r = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${over.map((p) => p[1].toFixed(5)).join(",")}&longitude=${over.map((p) => p[0].toFixed(5)).join(",")}`,
  );
  const j = await r.json().catch(() => ({}));
  check("101점은 거부됨(문서상 상한 100 확인)", !r.ok, `${r.status} ${(j.reason ?? "").slice(0, 70)}`);
}

console.log(`\n${pass}/${total} PASS`);
