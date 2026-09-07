// P1 게이트 — /api/route/walk · /api/map/static 실서버 검증.
//
//  전제: dev 서버 실행 중(npm run dev), .env.local에 TMAP_APP_KEY + Supabase 키.
//  사용: node _workspace/verify-walk-api.mjs [baseUrl]
//
//  세션 쿠키는 @supabase/ssr가 직접 만들게 한다(인코딩·청킹을 손으로 흉내내지 않는다).
//  임시 승인 계정은 끝에서 반드시 삭제한다(pb_members 행 + auth 계정).
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

let pass = 0,
  total = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};
const info = (s) => console.log(`   ${s}`);

const admin = (path, init = {}) =>
  fetch(`${SUPA}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

/* ── 임시 승인 계정 ─────────────────────────────────────────────────────── */
const EMAIL = `pb-walk-${Date.now()}@example.com`;
const PASSWORD = `Pw-${Math.random().toString(36).slice(2)}-9aZ`;
let userId = null;

async function cleanup() {
  if (userId) {
    await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  }
  await admin(`/rest/v1/pb_members?email=eq.${encodeURIComponent(EMAIL)}`, {
    method: "DELETE",
  });
}

try {
  // pb_members 승인 등록이 먼저 — 그래야 앱이 이 계정을 통과시킨다.
  const mem = await admin("/rest/v1/pb_members", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, status: "approved" }),
  });
  check("임시 계정 승인 등록(pb_members)", mem.ok, mem.ok ? EMAIL : await mem.text());

  const mk = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const mkJson = await mk.json();
  userId = mkJson.id ?? null;
  check("임시 계정 생성", mk.ok && Boolean(userId), userId ? userId.slice(0, 8) : JSON.stringify(mkJson).slice(0, 120));

  /* ── 세션 쿠키 만들기 (@supabase/ssr가 인코딩) ─────────────────────────── */
  const jar = new Map();
  const supa = createServerClient(SUPA, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: signInErr } = await supa.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  const cookieHeader = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
  check("세션 쿠키 확보", !signInErr && jar.size > 0, signInErr?.message ?? `쿠키 ${jar.size}개`);

  const authed = (path) => fetch(`${BASE}${path}`, { headers: { cookie: cookieHeader } });
  const anon = (path) => fetch(`${BASE}${path}`);

  /* ── 1) 인증 게이트 ─────────────────────────────────────────────────── */
  const WALK = "/api/route/walk?sx=126.9946&sy=37.5345&ex=126.9882&ey=37.5512";
  const MAP = "/api/map/static?lat=37.543&lon=126.9924&zoom=14&w=512&h=512";

  {
    const r = await anon(WALK);
    check("익명 → /api/route/walk 401", r.status === 401, `status=${r.status}`);
    check("401은 캐시되지 않는다", (r.headers.get("cache-control") ?? "").includes("no-store"), r.headers.get("cache-control"));
  }
  {
    const r = await anon(MAP);
    check("익명 → /api/map/static 401", r.status === 401, `status=${r.status}`);
  }

  /* ── 2) 파라미터 검증 ───────────────────────────────────────────────── */
  {
    const r = await authed("/api/route/walk");
    check("좌표 누락 → 400", r.status === 400, `status=${r.status}`);
  }
  {
    const r = await authed("/api/route/walk?sx=999&sy=999&ex=1&ey=1");
    check("좌표 범위 이탈 → 400", r.status === 400, `status=${r.status}`);
  }

  /* ── 3) 실제 경로 200 ───────────────────────────────────────────────── */
  let route = null;
  {
    const t0 = Date.now();
    const r = await authed(`${WALK}&sname=%EC%9D%B4%ED%83%9C%EC%9B%90%EC%97%AD&ename=N%EC%84%9C%EC%9A%B8%ED%83%80%EC%9B%8C`);
    const ms = Date.now() - t0;
    check("인증 + 실좌표 → 200", r.status === 200, `status=${r.status} · ${ms}ms`);
    const cc = r.headers.get("cache-control") ?? "";
    check("경로 응답 캐시 헤더(s-maxage=86400)", cc.includes("s-maxage=86400"), cc);
    if (r.ok) {
      route = await r.json();
      info(`총거리 ${route.totalDistance}m · ${Math.round(route.totalTime / 60)}분 · path ${route.path.length}점 · steps ${route.steps.length} · 고도 ${route.elevation.length}점`);
    }
  }

  if (route) {
    check("path는 [경도,위도] 쌍 배열", Array.isArray(route.path) && route.path.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)));
    check("bounds가 path 전체를 감싼다",
      route.path.every(([lon, lat]) =>
        lon >= route.bounds.west && lon <= route.bounds.east &&
        lat >= route.bounds.south && lat <= route.bounds.north));

    const sp = route.steps[0], ep = route.steps.at(-1);
    check("첫 안내지점은 출발지(SP), 마지막은 도착지(EP)", sp?.pointType === "SP" && ep?.pointType === "EP", `${sp?.pointType} … ${ep?.pointType}`);
    check("출발지의 distanceFromStart는 0", sp?.distanceFromStart === 0, String(sp?.distanceFromStart));
    check("도착지의 distanceFromStart ≈ totalDistance",
      Math.abs((ep?.distanceFromStart ?? 0) - route.totalDistance) <= 1,
      `${ep?.distanceFromStart} vs ${route.totalDistance}`);
    check("안내지점 누적거리가 단조 증가",
      route.steps.every((s, i) => i === 0 || s.distanceFromStart >= route.steps[i - 1].distanceFromStart));
    check("모든 안내지점에 한국어 문구", route.steps.every((s) => typeof s.description === "string"),
      `예: "${route.steps.find((s) => s.description)?.description ?? ""}"`);

    check("고도 100점", route.elevation.length === 100, `${route.elevation.length}점`);
    check("고도 거리축이 단조 증가",
      route.elevation.every((e, i) => i === 0 || e.distance > route.elevation[i - 1].distance));
    check("고도 거리축이 0에서 시작해 총거리에서 끝난다",
      route.elevation[0]?.distance === 0 &&
      Math.abs(route.elevation.at(-1).distance - route.totalDistance) / route.totalDistance < 0.02,
      `0 … ${Math.round(route.elevation.at(-1)?.distance ?? 0)} (총 ${route.totalDistance})`);
    check("고도 출처 표기 존재", typeof route.elevationSource === "string" && route.elevationSource.includes("90m"), route.elevationSource);
    const eles = route.elevation.map((e) => e.elevation);
    info(`고도 ${Math.min(...eles)}~${Math.max(...eles)}m`);
  }

  /* ── 4) 지도 이미지 프록시 ──────────────────────────────────────────── */
  {
    const r = await authed(MAP);
    const buf = Buffer.from(await r.arrayBuffer());
    check("인증 + 지도 → 200 PNG", r.status === 200 && buf.subarray(1, 4).toString() === "PNG",
      `status=${r.status} · ${(buf.length / 1024).toFixed(0)}KB · ${r.headers.get("content-type")}`);
    const cc = r.headers.get("cache-control") ?? "";
    check("지도 캐시 헤더(immutable)", cc.includes("immutable") && cc.includes("s-maxage"), cc);
    check("응답에 앱 키가 새어나오지 않는다", !buf.subarray(0, 2000).toString("latin1").includes(env.TMAP_APP_KEY));
  }
  {
    // 범위를 벗어난 zoom/크기는 400이 아니라 클램프되어 정상 이미지가 나와야 한다.
    const r = await authed("/api/map/static?lat=37.543&lon=126.9924&zoom=99&w=9999&h=9999");
    check("zoom·크기 초과값은 클램프되어 200", r.status === 200, `status=${r.status}`);
  }
  {
    const r = await authed("/api/map/static?lat=abc&lon=126.99&zoom=14");
    check("잘못된 좌표 → 400", r.status === 400, `status=${r.status}`);
  }

  /* ── 5) 서비스 지역 밖(참고) ────────────────────────────────────────── */
  {
    // 울릉도 — 보행자 경로 제공 지역 목록에 없다. 커버리지는 확대될 수 있으므로 참고만.
    const r = await authed("/api/route/walk?sx=130.9057&sy=37.4844&ex=130.8998&ey=37.5010");
    const body = await r.json().catch(() => ({}));
    info(`서비스 지역 밖(울릉도) → ${r.status} ${body.error ?? ""} "${body.message ?? ""}"`);
    check("지역 밖이 조용한 빈 응답이 아니라 사유를 준다",
      r.status === 200 || (typeof body.error === "string" && typeof body.message === "string"),
      `status=${r.status}`);
  }
} finally {
  await cleanup();
  const left = await admin(`/rest/v1/pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`);
  const rows = await left.json().catch(() => []);
  check("임시 계정·멤버 행 정리 완료", Array.isArray(rows) && rows.length === 0, `잔여 ${Array.isArray(rows) ? rows.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
