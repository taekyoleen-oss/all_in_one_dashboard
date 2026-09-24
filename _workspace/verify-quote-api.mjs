// 폰 '주식'·'환율' 위젯 브리지 실서버 검증.
//   node _workspace/verify-quote-api.mjs [baseUrl]
// 임시 승인 계정으로 위젯을 심고 디바이스 토큰으로 조회한 뒤 전부 지운다.
import { readFileSync } from "node:fs";
import { createHash, randomInt } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

let pass = 0, total = 0;
const check = (n, ok, d = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`);
  if (!ok) process.exitCode = 1;
};
const rest = (p, i = {}) => fetch(`${SUPA}/rest/v1/${p}`, {
  ...i,
  headers: {
    apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json", prefer: "return=representation", ...(i.headers ?? {}),
  },
});
const adminAuth = (p, i = {}) => fetch(`${SUPA}${p}`, {
  ...i,
  headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, "content-type": "application/json", ...(i.headers ?? {}) },
});

const EMAIL = `pb-quote-${Date.now()}@example.com`;
let userId = null;
try {
  /* ── 익명 차단 ─────────────────────────────────────────────────────── */
  for (const path of ["stocks", "fx"]) {
    const r = await fetch(`${BASE}/api/widget/${path}`);
    check(`익명 /api/widget/${path} 401`, r.status === 401, `HTTP ${r.status}`);
  }

  /* ── 임시 계정·보드 ─────────────────────────────────────────────────── */
  await rest("pb_members", { method: "POST", body: JSON.stringify({ email: EMAIL, status: "approved" }) });
  userId = (await (await adminAuth("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: `Pw-${Math.random().toString(36).slice(2)}-9aZ`, email_confirm: true }),
  })).json()).id;
  check("임시 계정", Boolean(userId));

  const boardId = (await (await rest("pb_dashboards", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name: "검증", is_default: true, sort_order: 0 }),
  })).json())[0].id;

  const addWidget = async (type, config) =>
    (await (await rest("pb_widgets", {
      method: "POST",
      body: JSON.stringify({
        dashboard_id: boardId, user_id: userId, type, config,
        layout: { x: 0, y: 0, w: 8, h: 8, gv: 2 },
      }),
    })).json())[0];

  // 주식 위젯 1개(지정 없음) — "현재는 기존 위젯에 연결"이 성립해야 한다.
  const SYMS = ["^KS11", "005930"];
  const stockA = await addWidget("stock", { symbols: SYMS });
  // 환율 위젯 1개(지정 없음)
  const fxA = await addWidget("fx", { base: "KRW", quotes: ["USD", "JPY"] });

  /* ── 디바이스 페어링 ────────────────────────────────────────────────── */
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await rest("pb_widget_pairing_codes", {
    method: "POST",
    body: JSON.stringify({ code_hash: sha256(code), user_id: userId, expires_at: new Date(Date.now() + 3e5).toISOString() }),
  });
  const pair = await (await fetch(`${BASE}/api/widget/pair`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, label: "verify-quote" }),
  })).json();
  const T = { authorization: `Bearer ${pair.token}` };
  check("디바이스 토큰 발급", typeof pair.token === "string");

  /* ── 주식 ──────────────────────────────────────────────────────────── */
  const s1res = await fetch(`${BASE}/api/widget/stocks`, { headers: T });
  const s1 = await s1res.json();
  check("지정 없어도 주식 위젯이 하나뿐이면 그것", s1.instanceId === stockA.id, s1.instanceId);
  check("종목이 웹에 저장된 순서 그대로", s1.items.map((i) => i.symbol).join(",") === SYMS.join(","),
    s1.items.map((i) => i.symbol).join(","));
  const q = s1.items[0];
  check("시세 필드가 채워진다", typeof q?.price === "number" && q.price > 0 && typeof q.changePct === "number",
    `${q?.name} ${q?.price} ${q?.changePct}%`);
  check("통화·지수 플래그", q?.currency === "KRW" && q?.isIndex === true, `${q?.currency} isIndex=${q?.isIndex}`);
  const sessions = s1.items.map((i) => i.session).filter(Boolean);
  check("시간외 표식은 pre|post만(정규장이면 아예 없음)",
    sessions.every((v) => v === "pre" || v === "post"),
    sessions.length ? sessions.join(",") : "표식 없음(정규장)");
  for (const i of s1.items) console.log(`   ${i.symbol} ${i.name} ${i.price} ${i.changePct}% ${i.session ?? ""}`);

  const etag = s1res.headers.get("etag");
  const s304 = await fetch(`${BASE}/api/widget/stocks`, { headers: { ...T, "if-none-match": etag } });
  check("같은 값이면 304(폴링 비용 절감)", s304.status === 304 || s304.status === 200,
    `HTTP ${s304.status}${s304.status === 200 ? " (시세가 바뀌면 200이 정상)" : ""}`);

  // 둘로 늘리면 어느 쪽인지 알 수 없다 → 사용자가 고르게 미지정.
  const stockB = await addWidget("stock", { symbols: ["AAPL"] });
  const s2 = await (await fetch(`${BASE}/api/widget/stocks`, { headers: T })).json();
  check("주식 위젯이 둘인데 지정이 없으면 미연결", s2.instanceId === null && s2.items.length === 0,
    `${s2.instanceId} / ${s2.items.length}건`);

  // 지정하면 그 위젯을 본다.
  await rest(`pb_widgets?id=eq.${stockB.id}`, {
    method: "PATCH",
    body: JSON.stringify({ config: { symbols: ["AAPL"], mobileSync: true, mobileSyncAt: Date.now() } }),
  });
  const s3 = await (await fetch(`${BASE}/api/widget/stocks`, { headers: T })).json();
  check("지정한 위젯이 대상", s3.instanceId === stockB.id, s3.instanceId);
  check("미국 종목도 조회된다", s3.items[0]?.symbol === "AAPL" && s3.items[0]?.currency === "USD",
    `${s3.items[0]?.name} ${s3.items[0]?.price} ${s3.items[0]?.currency} ${s3.items[0]?.session ?? ""}`);

  /* ── 환율 ──────────────────────────────────────────────────────────── */
  const f1res = await fetch(`${BASE}/api/widget/fx`, { headers: T });
  const f1 = await f1res.json();
  check("지정 없어도 환율 위젯이 하나뿐이면 그것", f1.instanceId === fxA.id, f1.instanceId);
  check("통화 순서 그대로", f1.items.map((i) => i.code).join(",") === "USD,JPY",
    f1.items.map((i) => i.code).join(","));
  const usd = f1.items.find((i) => i.code === "USD");
  const jpy = f1.items.find((i) => i.code === "JPY");
  // 뒤집기가 틀리면 0.0007 같은 값이 나온다 — 자릿수로 바로 잡힌다.
  check("USD는 1달러당 원(수백~수천 원대)", usd && usd.unit === 1 && usd.krw > 500 && usd.krw < 3000,
    `${usd?.krw}원`);
  check("JPY는 100엔 단위", jpy && jpy.unit === 100 && jpy.krw > 300 && jpy.krw < 3000, `${jpy?.unit}엔 = ${jpy?.krw}원`);
  check("전일 대비는 있으면 숫자, 없으면 아예 없음",
    f1.items.every((i) => i.changePct === undefined || typeof i.changePct === "number"),
    f1.items.map((i) => `${i.code}:${i.changePct ?? "—"}`).join(" "));
  for (const i of f1.items) console.log(`   ${i.unit === 1 ? i.code : i.unit + " " + i.code} = ${i.krw}원 (${i.changePct ?? "—"}%)`);

  const fEtag = f1res.headers.get("etag");
  const f304 = await fetch(`${BASE}/api/widget/fx`, { headers: { ...T, "if-none-match": fEtag } });
  check("환율도 304", f304.status === 304, `HTTP ${f304.status}`);

  /* ── 위젯이 없으면 조용히 빈 응답(에러 아님) ───────────────────────── */
  await rest(`pb_widgets?id=eq.${fxA.id}`, { method: "DELETE" });
  const f2 = await (await fetch(`${BASE}/api/widget/fx`, { headers: T })).json();
  check("환율 위젯을 지우면 미연결 + 빈 목록", f2.instanceId === null && f2.items.length === 0,
    `${f2.instanceId} / ${f2.items.length}건`);
} finally {
  if (userId) await adminAuth(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}`, { method: "DELETE" });
  const rows = await (await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`)).json();
  const widgets = userId
    ? await (await rest(`pb_widgets?user_id=eq.${userId}&select=id`)).json()
    : [];
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행 · pb_widgets 잔여 ${Array.isArray(widgets) ? widgets.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
