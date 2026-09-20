// /api/widget/notes 실서버 검증 — 폰 노트 위젯의 서버 절반.
//
//  전제: dev 서버 실행 중, .env.local에 Supabase 키.
//  사용: node _workspace/verify-notes-api.mjs [baseUrl]
//  임시 계정·보드·위젯은 끝에서 삭제한다(계정 삭제 시 FK 캐스케이드).
import { readFileSync } from "node:fs";
import { createHash, randomInt, randomUUID } from "node:crypto";

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
const check = (name, ok, detail = "") => {
  total++;
  if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
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
  headers: {
    apikey: SERVICE, authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json", ...(i.headers ?? {}),
  },
});

const EMAIL = `pb-notes-${Date.now()}@example.com`;
let userId = null;
async function cleanup() {
  if (userId) await adminAuth(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}`, { method: "DELETE" });
}

const cfgOf = async (id) =>
  (await (await rest(`pb_widgets?id=eq.${id}&select=config`)).json())[0].config;

try {
  await rest("pb_members", { method: "POST", body: JSON.stringify({ email: EMAIL, status: "approved" }) });
  const mk = await adminAuth("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: `Pw-${Math.random().toString(36).slice(2)}-9aZ`, email_confirm: true }),
  });
  userId = (await mk.json()).id ?? null;
  check("임시 계정 생성", Boolean(userId), userId?.slice(0, 8));

  const boardId = (await (await rest("pb_dashboards", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, name: "검증 보드", is_default: true, sort_order: 0 }),
  })).json())[0].id;

  /* 노트 2개: 공유 받기 노트(대상) + 오래된 노트 */
  const plainId = randomUUID(), richId = randomUUID();
  const targetNote = (await (await rest("pb_widgets", {
    method: "POST",
    body: JSON.stringify({
      dashboard_id: boardId, user_id: userId, type: "note",
      config: {
        title: "강의 노트", html: "<p>머리말입니다</p>", attachments: [], shareTarget: true,
        collapse: "more",
        sections: [
          { id: plainId, title: "1주차", html: '<p><span style="font-weight:bold">굵은 글</span></p><p>둘째 줄</p>' },
          { id: richId, title: "2주차", html: '<p>도표</p><img src="data:image/png;base64,AAA">' },
        ],
      },
      layout: { x: 0, y: 0, w: 8, h: 8, gv: 2 },
    }),
  })).json())[0];
  const otherNote = (await (await rest("pb_widgets", {
    method: "POST",
    body: JSON.stringify({
      dashboard_id: boardId, user_id: userId, type: "note",
      config: { title: "다른 노트", html: "", attachments: [], sections: [] },
      layout: { x: 0, y: 8, w: 8, h: 8, gv: 2 },
    }),
  })).json())[0];
  check("임시 노트 2개 생성", Boolean(targetNote.id && otherNote.id));

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await rest("pb_widget_pairing_codes", {
    method: "POST",
    body: JSON.stringify({ code_hash: sha256(code), user_id: userId, expires_at: new Date(Date.now() + 300_000).toISOString() }),
  });
  const pair = await (await fetch(`${BASE}/api/widget/pair`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, label: "verify-notes" }),
  })).json();
  check("디바이스 토큰 발급", typeof pair.token === "string");
  const T = { authorization: `Bearer ${pair.token}`, "content-type": "application/json" };
  const get = async (extra = {}) => {
    const r = await fetch(`${BASE}/api/widget/notes`, { headers: { ...T, ...extra } });
    return { status: r.status, etag: r.headers.get("etag"), body: r.status === 200 ? await r.json() : null };
  };

  /* ── 1) 인증 ──────────────────────────────────────────────────────── */
  check("익명 GET → 401", (await fetch(`${BASE}/api/widget/notes`)).status === 401);

  /* ── 2) 소제목이 목록으로 나온다 ──────────────────────────────────── */
  let etag;
  {
    const r = await get();
    etag = r.etag;
    const items = r.body.items;
    check("소제목 2건이 목록으로 나온다", items.length === 2, items.map((i) => i.title).join(" | "));
    const plain = items.find((i) => i.sectionId === plainId);
    check("본문은 평문으로 변환되고 줄바꿈이 살아난다", plain.body === "굵은 글\n둘째 줄", JSON.stringify(plain.body));
    check("노트 제목이 함께 온다", plain.noteTitle === "강의 노트");
    check("머리말은 항목이 아니다(소제목만)", !items.some((i) => i.body.includes("머리말")));
    const rich = items.find((i) => i.sectionId === richId);
    check("이미지가 있는 소제목은 rich=true", rich.rich === true && plain.rich === false);
    check("If-None-Match → 304", (await get({ "if-none-match": etag ?? "" })).status === 304);
  }

  /* ── 3) 수정: 평문이 같으면 HTML을 건드리지 않는다(서식 보존) ─────── */
  {
    const before = (await cfgOf(targetNote.id)).sections[0].html;
    const r = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${plainId}`, {
      method: "POST", headers: T,
      body: JSON.stringify({ title: "1주차 (수정)", text: "굵은 글\n둘째 줄" }),
    });
    check("제목만 바꾼 수정 → 200", r.status === 200, `status=${r.status}`);
    const cfg = await cfgOf(targetNote.id);
    check("본문 HTML(굵게)이 그대로 보존된다", cfg.sections[0].html === before, cfg.sections[0].html);
    check("소제목 이름은 바뀐다", cfg.sections[0].title === "1주차 (수정)");
  }

  /* ── 4) 본문이 실제로 바뀌면 그때만 새로 쓴다 ─────────────────────── */
  {
    await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${plainId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "폰에서 고친 내용" }),
    });
    const cfg = await cfgOf(targetNote.id);
    check("본문이 새 HTML로 저장된다", cfg.sections[0].html === "<p>폰에서 고친 내용</p>", cfg.sections[0].html);
    check("머리말·첨부·공유플래그·접기는 그대로", cfg.html === "<p>머리말입니다</p>" && cfg.shareTarget === true && cfg.collapse === "more" && Array.isArray(cfg.attachments));
    check("다른 소제목(2주차)은 손대지 않는다", cfg.sections[1].id === richId && cfg.sections[1].html.includes("<img"));
  }

  /* ── 5) 이미지·표가 있는 소제목의 본문 수정은 막는다 ──────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${richId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "평문으로 덮어쓰기" }),
    });
    check("이미지 있는 소제목 본문 수정 → 409 거부", r.status === 409, `status=${r.status}`);
    const cfg = await cfgOf(targetNote.id);
    check("거부 후 이미지가 그대로 남아 있다", cfg.sections[1].html.includes("data:image/png;base64,AAA"));
    // 제목 변경은 허용되어야 한다.
    const r2 = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${richId}`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "2주차 (이름만 변경)" }),
    });
    check("이미지 있는 소제목도 제목은 바꿀 수 있다", r2.status === 200, `status=${r2.status}`);
    check("제목만 바꿔도 이미지는 그대로", (await cfgOf(targetNote.id)).sections[1].html.includes("<img"));
  }

  /* ── 6) 추가 — 공유 받기 노트 맨 아래에 ───────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "3주차", text: "새 소제목 내용" }),
    });
    const created = await r.json();
    check("POST → 201 + 새 소제목", r.status === 201 && created.sectionId, created.title);
    const cfg = await cfgOf(targetNote.id);
    check("공유 받기 노트의 맨 아래에 붙는다", cfg.sections.length === 3 && cfg.sections[2].title === "3주차");
    const other = await cfgOf(otherNote.id);
    check("다른 노트에는 생기지 않는다", (other.sections ?? []).length === 0);
  }

  /* ── 7) 삭제 — 그 소제목만 ────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${plainId}`, {
      method: "DELETE", headers: T,
    });
    check("DELETE → 200", r.status === 200, `status=${r.status}`);
    const cfg = await cfgOf(targetNote.id);
    check("그 소제목만 빠진다", !cfg.sections.some((s) => s.id === plainId) && cfg.sections.length === 2);
    check("노트 위젯 자체는 남는다", cfg.title === "강의 노트" && cfg.html === "<p>머리말입니다</p>");
    const again = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/${plainId}`, { method: "DELETE", headers: T });
    check("이미 지운 소제목 재삭제 → 404", again.status === 404, `status=${again.status}`);
  }

  /* ── 8) 남의·없는 id ──────────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${randomUUID()}/${randomUUID()}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "x" }),
    });
    check("없는 노트 id → 404", r.status === 404, `status=${r.status}`);
    const r2 = await fetch(`${BASE}/api/widget/notes/${targetNote.id}/없는섹션`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "x" }),
    });
    check("없는 섹션 id → 404", r2.status === 404, `status=${r2.status}`);
  }

  /* ── 9) 빈 요청 ───────────────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "  ", text: "" }),
    });
    check("제목·내용 둘 다 비면 400", r.status === 400, `status=${r.status}`);
  }
} finally {
  await cleanup();
  const rows = await (await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`)).json();
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
