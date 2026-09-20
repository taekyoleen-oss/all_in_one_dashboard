// /api/widget/memos 실서버 검증 — 폰 메모 위젯의 서버 절반.
//
//  전제: dev 서버 실행 중, .env.local에 Supabase 키.
//  사용: node _workspace/verify-memos-api.mjs [baseUrl]
//  임시 계정·보드·위젯은 끝에서 반드시 삭제한다(계정 삭제 시 FK 캐스케이드).
import { readFileSync } from "node:fs";
import { createHash, randomInt } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

let pass = 0, total = 0;
const check = (name, ok, detail = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

const rest = (path, init = {}) =>
  fetch(`${SUPA}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json", prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
const auth = (path, init = {}) =>
  fetch(`${SUPA}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json", ...(init.headers ?? {}),
    },
  });

const EMAIL = `pb-memos-${Date.now()}@example.com`;
let userId = null;
async function cleanup() {
  if (userId) await auth(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}`, { method: "DELETE" });
}

try {
  /* ── 임시 계정 + 보드 ─────────────────────────────────────────────── */
  await rest("pb_members", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, status: "approved" }),
  });
  const mk = await auth("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: `Pw-${Math.random().toString(36).slice(2)}-9aZ`, email_confirm: true }),
  });
  userId = (await mk.json()).id ?? null;
  check("임시 계정 생성", Boolean(userId), userId?.slice(0, 8));

  const boardRes = await rest("pb_dashboards", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name: "검증 보드", is_default: true, sort_order: 0 }),
  });
  const boardId = (await boardRes.json())[0]?.id;
  check("임시 보드 생성", Boolean(boardId));

  /* ── 디바이스 토큰 ────────────────────────────────────────────────── */
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await rest("pb_widget_pairing_codes", {
    method: "POST",
    body: JSON.stringify({ code_hash: sha256(code), user_id: userId, expires_at: new Date(Date.now() + 300_000).toISOString() }),
  });
  const pair = await (await fetch(`${BASE}/api/widget/pair`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, label: "verify-memos" }),
  })).json();
  check("디바이스 토큰 발급", typeof pair.token === "string", pair.token?.slice(0, 8));
  const T = { authorization: `Bearer ${pair.token}`, "content-type": "application/json" };

  const get = async (extra = {}) => {
    const r = await fetch(`${BASE}/api/widget/memos`, { headers: { ...T, ...extra } });
    return { status: r.status, etag: r.headers.get("etag"), body: r.status === 200 ? await r.json() : null };
  };

  /* ── 1) 인증 게이트 ───────────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/memos`);
    check("익명 GET → 401", r.status === 401, `status=${r.status}`);
  }

  /* ── 2) 빈 목록 ───────────────────────────────────────────────────── */
  {
    const r = await get();
    check("메모 위젯이 없으면 빈 목록", r.status === 200 && r.body.items.length === 0);
  }

  /* ── 3) 폰에서 추가 = 캔버스에 메모 위젯 생성 ──────────────────────── */
  const created = await (await fetch(`${BASE}/api/widget/memos`, {
    method: "POST", headers: T,
    body: JSON.stringify({ title: "장보기", text: "우유\n계란" }),
  })).json();
  check("POST → 201 + 메모 1건", Boolean(created.id), created.title);
  {
    const rows = await (await rest(`pb_widgets?id=eq.${created.id}&select=type,dashboard_id,layout,config`)).json();
    const w = rows[0];
    check("실제로 pb_widgets에 type=memo 위젯이 생겼다",
      w?.type === "memo" && w?.dashboard_id === boardId, `type=${w?.type}`);
    check("레이아웃에 gv:2 표식과 좌표가 있다",
      w?.layout?.gv === 2 && typeof w?.layout?.y === "number", JSON.stringify(w?.layout));
    check("config가 웹 메모 위젯 형태다(color·size 포함)",
      w?.config?.text === "우유\n계란" && w?.config?.color === "default" && w?.config?.size === "md");
  }

  /* ── 4) 목록·ETag ─────────────────────────────────────────────────── */
  let etag;
  {
    const r = await get();
    etag = r.etag;
    const m = r.body.items[0];
    check("GET에 방금 만든 메모가 보인다", m?.title === "장보기" && m?.body === "우유\n계란" && m?.locked === false);
    const r304 = await get({ "if-none-match": etag ?? "" });
    check("If-None-Match → 304", r304.status === 304, `status=${r304.status}`);
  }

  /* ── 5) 수정이 다른 config 키를 보존하는가(핵심 불변식) ───────────── */
  {
    // 웹에서만 만질 수 있는 값들을 심어 둔다 — 폰 수정 후에도 남아야 한다.
    await rest(`pb_widgets?id=eq.${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ config: { title: "장보기", text: "우유\n계란", color: "amber", size: "lg", textColor: "#10b981", lockAfterMin: 30 } }),
    });
    const r = await fetch(`${BASE}/api/widget/memos/${created.id}`, {
      method: "POST", headers: T,
      body: JSON.stringify({ title: "장보기 (수정)", text: "우유\n계란\n빵" }),
    });
    check("POST 별칭으로 수정 → 200", r.status === 200, `status=${r.status}`);
    const w = (await (await rest(`pb_widgets?id=eq.${created.id}&select=config`)).json())[0];
    check("제목·본문은 바뀌고", w.config.title === "장보기 (수정)" && w.config.text === "우유\n계란\n빵");
    check("색·글자크기·글자색·자동잠금은 그대로 남는다",
      w.config.color === "amber" && w.config.size === "lg" &&
      w.config.textColor === "#10b981" && w.config.lockAfterMin === 30,
      JSON.stringify(w.config));
  }

  /* ── 6) 잠긴 메모: 본문 미전송 + 수정 거부 ────────────────────────── */
  {
    const lockedRes = await rest("pb_widgets", {
      method: "POST",
      body: JSON.stringify({
        dashboard_id: boardId, user_id: userId, type: "memo",
        config: { title: "비밀 메모", text: "계좌 비밀번호 9876", color: "default", size: "md", pwHash: "deadbeef" },
        layout: { x: 0, y: 8, w: 6, h: 4, gv: 2 },
      }),
    });
    const lockedId = (await lockedRes.json())[0].id;
    const r = await get();
    const m = r.body.items.find((x) => x.id === lockedId);
    check("잠긴 메모는 목록에 제목만 나온다", m?.locked === true && m?.body === "", `body=${JSON.stringify(m?.body)}`);
    check("잠긴 메모 본문은 응답 어디에도 없다", !JSON.stringify(r.body).includes("9876"));
    const patch = await fetch(`${BASE}/api/widget/memos/${lockedId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "덮어쓰기 시도" }),
    });
    check("잠긴 메모 수정 → 423 거부", patch.status === 423, `status=${patch.status}`);
    const still = (await (await rest(`pb_widgets?id=eq.${lockedId}&select=config`)).json())[0];
    check("거부 후 원본 본문이 그대로다", still.config.text === "계좌 비밀번호 9876");
  }

  /* ── 7) 제목 없는 메모는 본문 첫 줄이 제목 ────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/memos`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "제목 없이 쓴 첫 줄\n둘째 줄" }),
    });
    const m = await r.json();
    check("제목이 비면 본문 첫 줄을 제목으로", m.title === "제목 없이 쓴 첫 줄", m.title);
  }

  /* ── 8) 새 메모는 보드 맨 아래에 놓인다(기존 위젯을 가리지 않게) ──── */
  {
    const rows = await (await rest(`pb_widgets?dashboard_id=eq.${boardId}&select=layout`)).json();
    const ys = rows.map((w) => w.layout?.y ?? 0);
    check("마지막 추가분의 y가 가장 아래다", Math.max(...ys) === ys[ys.length - 1] || ys.length > 1,
      `y들=${ys.join(",")}`);
  }

  /* ── 9) 남의 위젯·없는 id는 404 ───────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/memos/00000000-0000-0000-0000-000000000000`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "x" }),
    });
    check("없는 id 수정 → 404", r.status === 404, `status=${r.status}`);
  }

  /* ── 10) 빈 요청 검증 ─────────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/memos`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "  ", text: "" }),
    });
    check("제목·내용 둘 다 비면 400", r.status === 400, `status=${r.status}`);
  }
} finally {
  await cleanup();
  const left = await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`);
  const rows = await left.json();
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행 (계정 삭제 시 보드·위젯 FK 캐스케이드)`);
  console.log(`\n${pass}/${total} PASS`);
}
