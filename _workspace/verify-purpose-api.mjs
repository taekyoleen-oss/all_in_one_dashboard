// 목적(일반·등산·강변)이 /api/route/walk 결과를 실제로 바꾸는가 — 실서버 검증.
//
//  전제: dev 서버 실행 중, .env.local에 TMAP_APP_KEY + Supabase 키.
//  사용: node _workspace/verify-purpose-api.mjs [baseUrl]
//  임시 승인 계정은 끝에서 반드시 삭제한다.
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

let pass = 0, total = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

const admin = (path, init = {}) =>
  fetch(`${SUPA}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json", ...(init.headers ?? {}),
    },
  });

const EMAIL = `pb-purpose-${Date.now()}@example.com`;
const PASSWORD = `Pw-${Math.random().toString(36).slice(2)}-9aZ`;
let userId = null;
async function cleanup() {
  if (userId) await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  await admin(`/rest/v1/pb_members?email=eq.${encodeURIComponent(EMAIL)}`, { method: "DELETE" });
}

/** 누적 상승(m) — 서버가 준 고도 프로파일 그대로. */
const gainOf = (el) => {
  let up = 0;
  for (let i = 1; i < el.length; i++) {
    const d = el[i].elevation - el[i - 1].elevation;
    if (d > 0) up += d;
  }
  return Math.round(up);
};

try {
  const mem = await admin("/rest/v1/pb_members", {
    method: "POST", body: JSON.stringify({ email: EMAIL, status: "approved" }),
  });
  check("임시 계정 승인 등록", mem.ok, mem.ok ? EMAIL : await mem.text());
  const mk = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const mkJson = await mk.json();
  userId = mkJson.id ?? null;
  check("임시 계정 생성", mk.ok && Boolean(userId), userId?.slice(0, 8));

  const jar = new Map();
  const supa = createServerClient(SUPA, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInErr } = await supa.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
  check("세션 쿠키 확보", !signInErr && jar.size > 0, signInErr?.message ?? `쿠키 ${jar.size}개`);

  const get = async (q) => {
    const r = await fetch(`${BASE}/api/route/walk?${q}`, { headers: { cookie } });
    if (!r.ok) return { status: r.status, body: await r.text() };
    return { status: r.status, ...(await r.json()) };
  };

  /* ── 등산 경로: 이태원역 → N서울타워 ─────────────────────────────────── */
  const HIKE = "sx=126.99461&sy=37.53454&ex=126.98817&ey=37.5513&sname=%EC%9D%B4%ED%83%9C%EC%9B%90&ename=N%EC%84%9C%EC%9A%B8%ED%83%80%EC%9B%8C";
  console.log("\n── 등산 경로(이태원역 → N서울타워) ──");
  const walk = await get(`${HIKE}&purpose=walk`);
  const walkStairs = await get(`${HIKE}&purpose=walk&avoidStairs=1`);
  const hike = await get(`${HIKE}&purpose=hike&avoidStairs=1`);
  for (const [k, r] of [["일반", walk], ["일반+계단회피", walkStairs], ["등산+계단회피", hike]]) {
    console.log(`   ${k.padEnd(14)} ${r.status === 200 ? `${r.totalDistance}m · ${Math.round(r.totalTime / 60)}분 · 상승 ${gainOf(r.elevation)}m` : `HTTP ${r.status} ${r.body?.slice(0, 80)}`}`);
  }
  check("일반 + 계단 회피는 경로를 바꾼다(searchOption 30 도달)",
    walkStairs.status === 200 && walk.status === 200 && walkStairs.totalDistance !== walk.totalDistance,
    `${walk.totalDistance}m → ${walkStairs.totalDistance}m`);
  check("등산은 계단 회피 체크를 무시하고 추천(0)을 쓴다",
    hike.status === 200 && hike.totalDistance === walk.totalDistance,
    `등산 ${hike.totalDistance}m = 일반 ${walk.totalDistance}m ≠ 계단회피 ${walkStairs.totalDistance}m`);
  // 상승량으로는 비교하지 않는다 — 경로마다 100점 표본이라 긴 경로일수록 잔떨림이
  // 덜 쌓여 순서가 뒤집힌다(purpose.ts 머리말). 티맵이 직접 준 거리로만 판정한다.
  check("계단 제외는 같은 산을 더 멀리 돌게 한다 — 등산에서 끄는 근거",
    walkStairs.totalDistance > hike.totalDistance * 1.05,
    `계단회피 ${walkStairs.totalDistance}m vs 등산 ${hike.totalDistance}m (+${Math.round((walkStairs.totalDistance / hike.totalDistance - 1) * 100)}%)`);

  /* ── 강변 경로: 반포한강공원 → 잠원한강공원 ──────────────────────────── */
  const RIVER = "sx=126.9956&sy=37.511&ex=127.019&ey=37.522&sname=%EB%B0%98%ED%8F%AC&ename=%EC%9E%A0%EC%9B%90";
  console.log("\n── 강변 경로(반포한강공원 → 잠원한강공원) ──");
  const rWalk = await get(`${RIVER}&purpose=walk`);
  const rSide = await get(`${RIVER}&purpose=waterside`);
  const rSide2 = await get(`${RIVER}&purpose=waterside&avoidStairs=0`);
  for (const [k, r] of [["일반", rWalk], ["강변", rSide]]) {
    console.log(`   ${k.padEnd(14)} ${r.status === 200 ? `${r.totalDistance}m · ${Math.round(r.totalTime / 60)}분 · 상승 ${gainOf(r.elevation)}m` : `HTTP ${r.status}`}`);
  }
  check("강변은 일반과 다른 경로를 만든다",
    rSide.status === 200 && rWalk.status === 200 && rSide.totalDistance !== rWalk.totalDistance,
    `${rWalk.totalDistance}m → ${rSide.totalDistance}m`);
  check("강변은 계단 회피 체크가 꺼져 있어도 계단 제외(30)를 쓴다",
    rSide2.status === 200 && rSide2.totalDistance === rSide.totalDistance,
    `${rSide2.totalDistance}m`);

  /* ── 모르는 목적 값은 일반으로 떨어진다 ──────────────────────────────── */
  const bogus = await get(`${HIKE}&purpose=<script>alert(1)</script>`);
  check("모르는 목적 값 → 400이 아니라 일반으로 처리",
    bogus.status === 200 && bogus.totalDistance === walk.totalDistance,
    `${bogus.status} · ${bogus.totalDistance}m`);
  const none = await get(HIKE);
  check("purpose 없음(구버전 위젯) → 일반",
    none.status === 200 && none.totalDistance === walk.totalDistance,
    `${none.totalDistance}m`);

  /* ── 오르막 보정(위젯이 하는 계산과 같은 규칙) ───────────────────────── */
  const g = gainOf(hike.elevation);
  const adjusted = Math.round(hike.totalTime + g * 6);
  console.log(`\n   오르막 보정: 티맵 ${Math.round(hike.totalTime / 60)}분 + 상승 ${g}m → ${Math.round(adjusted / 60)}분`);
  check("등산 보정 시간이 티맵 값보다 유의미하게 크다", adjusted > hike.totalTime * 1.3,
    `${Math.round(hike.totalTime / 60)}분 → ${Math.round(adjusted / 60)}분`);
} finally {
  await cleanup();
  const left = await admin(`/rest/v1/pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`);
  const rows = await left.json();
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
