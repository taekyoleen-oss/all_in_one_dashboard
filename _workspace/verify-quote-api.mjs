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

  /* ── 디바이스 페어링 ──────────────────────────────────────────────────
   * 토큰 하나당 **분당 20회** 제한(requireDevice)이 있어 검증처럼 몰아 부르면
   * 429가 난다 — 실사용(15분 주기 + 가끔 탭)과는 무관하다. 구간마다 기기를
   * 새로 붙여 각자의 한도를 쓴다(실제로 폰이 여러 대인 상황과 같다). */
  const newDevice = async (label) => {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await rest("pb_widget_pairing_codes", {
      method: "POST",
      body: JSON.stringify({ code_hash: sha256(code), user_id: userId, expires_at: new Date(Date.now() + 3e5).toISOString() }),
    });
    const pair = await (await fetch(`${BASE}/api/widget/pair`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, label }),
    })).json();
    return { authorization: `Bearer ${pair.token}` };
  };
  const T = await newDevice("verify-quote");
  check("디바이스 토큰 발급", typeof T.authorization === "string" && T.authorization.includes("pbw_"));

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

  // 종목 정보 페이지 링크(요구) — 웹 행 클릭과 같은 규칙을 서버가 만들어 보낸다.
  const urlOf = (list, sym) => list.find((i) => i.symbol === sym)?.infoUrl;
  check("지수 링크 = 네이버 지수 페이지",
    urlOf(s1.items, "^KS11") === "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
    urlOf(s1.items, "^KS11"));
  check("국내 종목 링크 = 네이버 종목 페이지",
    urlOf(s1.items, "005930") === "https://finance.naver.com/item/main.naver?code=005930",
    urlOf(s1.items, "005930"));

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
  check("미국 종목 링크 = 야후 종목 페이지",
    s3.items[0]?.infoUrl === "https://finance.yahoo.com/quote/AAPL", s3.items[0]?.infoUrl);

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

  // 환율 정보 페이지 링크(요구) — 웹 행 더블클릭과 같은 규칙.
  check("환율 링크 = 네이버 환율 상세",
    f1.items.find((i) => i.code === "USD")?.infoUrl ===
      "https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW",
    f1.items.find((i) => i.code === "USD")?.infoUrl);
  check("엔화도 같은 규칙(100 단위와 무관)",
    f1.items.find((i) => i.code === "JPY")?.infoUrl ===
      "https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_JPYKRW",
    f1.items.find((i) => i.code === "JPY")?.infoUrl);

  const fEtag = f1res.headers.get("etag");
  const f304 = await fetch(`${BASE}/api/widget/fx`, { headers: { ...T, "if-none-match": fEtag } });
  check("환율도 304", f304.status === 304, `HTTP ${f304.status}`);

  /* ── 검색(폰에는 카탈로그가 없다) ──────────────────────────────────── */
  const T2 = await newDevice("verify-quote-2"); // 한도 분리
  const search = async (q) =>
    (await (await fetch(`${BASE}/api/widget/stocks/search?q=${encodeURIComponent(q)}`, { headers: T2 })).json()).results;
  const kr = await search("삼성전자");
  check("국내 종목을 이름으로 찾는다", kr.some((r) => r.symbol === "005930"), kr[0] && `${kr[0].name}/${kr[0].sub}`);
  const idx = await search("코스피");
  check("지수도 이름으로 찾는다", idx.some((r) => r.symbol === "^KS11"), idx[0] && `${idx[0].name}/${idx[0].sub}`);
  const us = await search("apple");
  check("미국 종목도 찾는다", us.some((r) => r.symbol === "AAPL"), us[0] && `${us[0].name}/${us[0].sub}`);
  const none = await search("");
  check("빈 질의는 빈 결과(업스트림 호출 없음)", none.length === 0);

  /* ── 주식 추가·삭제(폰에서) ────────────────────────────────────────── */
  // 대상은 stockB(지정된 위젯, symbols=["AAPL"]).
  let D = T2; // 구간마다 바꿔 끼우는 '현재 기기'
  const post = (path, body) => fetch(`${BASE}${path}`, {
    method: "POST", headers: { ...D, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const del = (path) => fetch(`${BASE}${path}`, { method: "DELETE", headers: D });

  const addRes = await post("/api/widget/stocks", { symbol: "msft" });
  check("폰에서 종목 추가(소문자도 정규화)", addRes.status === 201, `HTTP ${addRes.status}`);
  const afterAdd = await (await fetch(`${BASE}/api/widget/stocks`, { headers: D })).json();
  check("추가한 종목이 목록 맨 뒤에", afterAdd.items.map((i) => i.symbol).join(",") === "AAPL,MSFT",
    afterAdd.items.map((i) => i.symbol).join(","));
  const dup = await post("/api/widget/stocks", { symbol: "MSFT" });
  check("중복 추가는 409", dup.status === 409, `HTTP ${dup.status}`);
  check("없는 종목은 400", (await post("/api/widget/stocks", { symbol: "ZZZZNOPE" })).status === 400);

  // 폰이 config를 통째로 쓰지 않는다 — 지정 플래그가 살아 있어야 한다.
  const cfgAfter = (await (await rest(`pb_widgets?id=eq.${stockB.id}&select=config`)).json())[0].config;
  check("추가가 다른 설정을 지우지 않는다(mobileSync 보존)", cfgAfter.mobileSync === true,
    JSON.stringify(cfgAfter));

  check("폰에서 종목 삭제", (await del("/api/widget/stocks?symbol=MSFT")).status === 200);
  const afterDel = await (await fetch(`${BASE}/api/widget/stocks`, { headers: D })).json();
  check("삭제한 종목이 사라진다", afterDel.items.map((i) => i.symbol).join(",") === "AAPL",
    afterDel.items.map((i) => i.symbol).join(","));
  check("이미 삭제된 종목은 404", (await del("/api/widget/stocks?symbol=MSFT")).status === 404);

  /* ── 필라델피아 반도체(^SOX) — 접힘 요약의 기본 대상(요구) ───────── */
  D = await newDevice("verify-quote-sox"); // 한도 분리(토큰당 분당 20회)
  const soxHits = await search("반도체");
  check("필라델피아 반도체를 이름으로 찾는다", soxHits.some((r) => r.symbol === "^SOX"),
    soxHits.map((r) => r.symbol).join(","));
  check("^SOX 추가", (await post("/api/widget/stocks", { symbol: "^SOX" })).status === 201);
  const soxRow = (await (await fetch(`${BASE}/api/widget/stocks`, { headers: D })).json())
    .items.find((i) => i.symbol === "^SOX");
  check("^SOX 링크 = 야후 지수 페이지(네이버 검색 폴백 아님)",
    soxRow?.infoUrl === "https://finance.yahoo.com/quote/%5ESOX", soxRow?.infoUrl);
  check("^SOX에 시세가 붙고 지수로 표시된다",
    Boolean(soxRow) && soxRow.isIndex && !soxRow.unavailable && soxRow.price > 1000,
    soxRow && `${soxRow.name} ${soxRow.price} ${soxRow.currency} ${soxRow.changePct}%`);
  check("^SOX 삭제", (await del(`/api/widget/stocks?symbol=${encodeURIComponent("^SOX")}`)).status === 200);

  /* ── 조회 실패해도 행은 남는다(깜빡임 신고 수정) ─────────────────── */
  // 서버가 시세를 못 받는 심볼을 config에 직접 심는다(POST는 이런 값을 막으므로).
  await rest(`pb_widgets?id=eq.${stockB.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      config: { symbols: ["AAPL", "ZZZZNOPE"], mobileSync: true, mobileSyncAt: Date.now() },
    }),
  });
  const flaky = await (await fetch(`${BASE}/api/widget/stocks`, { headers: D })).json();
  check(
    "시세를 못 받아도 행이 사라지지 않는다",
    flaky.items.map((i) => i.symbol).join(",") === "AAPL,ZZZZNOPE",
    flaky.items.map((i) => i.symbol).join(","),
  );
  const bad = flaky.items.find((i) => i.symbol === "ZZZZNOPE");
  check("못 받은 행엔 unavailable 표식", bad?.unavailable === true, JSON.stringify(bad));
  check("정상 행엔 표식이 없다", flaky.items[0]?.unavailable === undefined);
  // 원상 복구(뒤 검증이 AAPL 하나를 전제로 한다)
  await rest(`pb_widgets?id=eq.${stockB.id}`, {
    method: "PATCH",
    body: JSON.stringify({ config: { symbols: ["AAPL"], mobileSync: true, mobileSyncAt: Date.now() } }),
  });

  /* ── 환율 추가·삭제(폰에서) ────────────────────────────────────────── */
  D = await newDevice("verify-quote-3"); // 한도 분리
  check("폰에서 통화 추가", (await post("/api/widget/fx", { code: "eur" })).status === 201);
  const fxAdd = await (await fetch(`${BASE}/api/widget/fx`, { headers: D })).json();
  check("추가한 통화가 목록에", fxAdd.items.map((i) => i.code).join(",") === "USD,JPY,EUR",
    fxAdd.items.map((i) => i.code).join(","));
  check("중복 통화는 409", (await post("/api/widget/fx", { code: "EUR" })).status === 409);
  const krwRes = await post("/api/widget/fx", { code: "KRW" });
  check("원화는 기준 통화라 400", krwRes.status === 400, `HTTP ${krwRes.status}`);
  check("형식 오류는 400", (await post("/api/widget/fx", { code: "EURO" })).status === 400);
  check("없는 통화는 400", (await post("/api/widget/fx", { code: "ZZZ" })).status === 400);
  check("폰에서 통화 삭제", (await del("/api/widget/fx?code=EUR")).status === 200);
  const fxDel = await (await fetch(`${BASE}/api/widget/fx`, { headers: D })).json();
  check("삭제한 통화가 사라진다", fxDel.items.map((i) => i.code).join(",") === "USD,JPY",
    fxDel.items.map((i) => i.code).join(","));
  check("이미 삭제된 통화는 404", (await del("/api/widget/fx?code=EUR")).status === 404);

  /* ── 위젯이 없으면 조용히 빈 응답(에러 아님) ───────────────────────── */
  await rest(`pb_widgets?id=eq.${fxA.id}`, { method: "DELETE" });
  const f2 = await (await fetch(`${BASE}/api/widget/fx`, { headers: D })).json();
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
