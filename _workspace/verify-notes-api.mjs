// /api/widget/notes 실서버 검증 — 폰 노트 위젯의 서버 절반.
//
//  핵심: **지정된 노트 위젯 하나**(속성 '모바일 홈 화면에 표시')만 보이고,
//  조회·추가·삭제가 전부 그 하나에만 걸린다.
//
//  전제: dev 서버 실행 중, .env.local에 Supabase 키.
//  사용: node _workspace/verify-notes-api.mjs [baseUrl]
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
/** 웹에서 '모바일 홈 화면에 표시'를 켜고/끄는 것과 같은 config 변경. */
const designate = async (id, on, at) => {
  const cfg = await cfgOf(id);
  await rest(`pb_widgets?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      config: { ...cfg, mobileSync: on, ...(on ? { mobileSyncAt: at } : {}) },
    }),
  });
};

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

  const plainId = randomUUID(), richId = randomUUID(), otherSecId = randomUUID();
  const mkNote = async (title, sections, extra = {}) =>
    (await (await rest("pb_widgets", {
      method: "POST",
      body: JSON.stringify({
        dashboard_id: boardId, user_id: userId, type: "note",
        config: { title, html: "<p>머리말입니다</p>", attachments: [], collapse: "more", sections, ...extra },
        layout: { x: 0, y: 0, w: 8, h: 8, gv: 2 },
      }),
    })).json())[0];

  const noteA = await mkNote("연결 노트", [
    { id: plainId, title: "1주차", html: '<p><span style="font-weight:bold">굵은 글</span></p><p>둘째 줄</p>' },
    { id: richId, title: "2주차", html: '<p>도표</p><img src="data:image/png;base64,AAA">' },
  ]);
  const noteB = await mkNote("다른 노트", [
    { id: otherSecId, title: "다른 노트 소제목", html: "<p>보이면 안 된다</p>" },
  ]);
  check("임시 노트 2개 생성", Boolean(noteA.id && noteB.id));

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

  check("익명 GET → 401", (await fetch(`${BASE}/api/widget/notes`)).status === 401);

  /* ── 1) 지정 전: 아무것도 안 보이고 추가도 막힌다 ─────────────────── */
  {
    const r = await get();
    check("지정 전에는 instanceId=null·빈 목록", r.body.instanceId === null && r.body.items.length === 0);
    const add = await fetch(`${BASE}/api/widget/notes`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "x", text: "y" }),
    });
    check("지정 전 추가 → 409 + 안내", add.status === 409 && (await add.json()).message.includes("모바일 홈 화면에 표시"));
  }

  /* ── 2) 노트 A 지정 → A의 소제목만 보인다 ─────────────────────────── */
  await designate(noteA.id, true, 1_000);
  let etag;
  {
    const r = await get();
    etag = r.etag;
    check("지정 후 instanceId가 그 노트", r.body.instanceId === noteA.id);
    check("A의 소제목 2건만 나온다", r.body.items.length === 2, r.body.items.map((i) => i.title).join(" | "));
    check("다른 노트(B)의 소제목은 안 나온다", !r.body.items.some((i) => i.noteId === noteB.id));
    const plain = r.body.items.find((i) => i.sectionId === plainId);
    check("본문이 평문으로 변환되고 줄바꿈이 살아난다", plain.body === "굵은 글\n둘째 줄", JSON.stringify(plain.body));
    check("머리말은 항목이 아니다", !r.body.items.some((i) => i.body.includes("머리말")));
    check("이미지 있는 소제목은 rich=true", r.body.items.find((i) => i.sectionId === richId).rich === true);
    check("If-None-Match → 304", (await get({ "if-none-match": etag ?? "" })).status === 304);
  }

  /* ── 3) 지정되지 않은 노트는 고칠 수 없다 ─────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${noteB.id}/${otherSecId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "침범" }),
    });
    check("비지정 노트 수정 → 409", r.status === 409, `status=${r.status}`);
    const d = await fetch(`${BASE}/api/widget/notes/${noteB.id}/${otherSecId}`, { method: "DELETE", headers: T });
    check("비지정 노트 삭제 → 409", d.status === 409, `status=${d.status}`);
    check("B는 그대로다", (await cfgOf(noteB.id)).sections.length === 1);
  }

  /* ── 4) 조회·수정: 서식 보존 ──────────────────────────────────────── */
  {
    const before = (await cfgOf(noteA.id)).sections[0].html;
    const r = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${plainId}`, {
      method: "POST", headers: T,
      body: JSON.stringify({ title: "1주차 (수정)", text: "굵은 글\n둘째 줄" }),
    });
    check("제목만 바꾼 수정 → 200", r.status === 200, `status=${r.status}`);
    const cfg = await cfgOf(noteA.id);
    check("본문 HTML(굵게)이 그대로 보존된다", cfg.sections[0].html === before);
    check("소제목 이름은 바뀐다", cfg.sections[0].title === "1주차 (수정)");
  }
  {
    await fetch(`${BASE}/api/widget/notes/${noteA.id}/${plainId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "폰에서 고친 내용" }),
    });
    const cfg = await cfgOf(noteA.id);
    check("본문이 바뀌면 그때만 새 HTML", cfg.sections[0].html === "<p>폰에서 고친 내용</p>");
    check("머리말·첨부·접기는 그대로", cfg.html === "<p>머리말입니다</p>" && cfg.collapse === "more" && Array.isArray(cfg.attachments));
    check("지정 플래그도 보존된다", cfg.mobileSync === true);
  }

  /* ── 5) 이미지·표 보호 ────────────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${richId}`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "평문으로 덮어쓰기" }),
    });
    check("이미지 있는 소제목 본문 수정 → 409", r.status === 409, `status=${r.status}`);
    check("이미지가 그대로 남아 있다", (await cfgOf(noteA.id)).sections[1].html.includes("base64,AAA"));
    const r2 = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${richId}`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "2주차 (이름만)" }),
    });
    check("이미지 있어도 제목은 바꿀 수 있다", r2.status === 200, `status=${r2.status}`);
  }

  /* ── 6) 추가 — 지정된 노트에만 ────────────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "3주차", text: "새 내용" }),
    });
    const created = await r.json();
    check("추가 → 201", r.status === 201 && created.sectionId, created.title);
    check("지정 노트(A) 맨 위에 붙는다(새로 쓴 것이 위로)", (await cfgOf(noteA.id)).sections[0].title === "3주차");
    check("다른 노트(B)에는 안 생긴다", (await cfgOf(noteB.id)).sections.length === 1);
  }

  /* ── 7) 삭제 — 소제목만, 노트는 유지 ──────────────────────────────── */
  {
    const r = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${plainId}`, { method: "DELETE", headers: T });
    check("삭제 → 200", r.status === 200, `status=${r.status}`);
    const cfg = await cfgOf(noteA.id);
    check("그 소제목만 빠진다", !cfg.sections.some((s) => s.id === plainId) && cfg.sections.length === 2);
    check("노트 위젯 자체는 남는다", cfg.title === "연결 노트" && cfg.html === "<p>머리말입니다</p>");
    const again = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${plainId}`, { method: "DELETE", headers: T });
    check("이미 지운 소제목 재삭제 → 404", again.status === 404, `status=${again.status}`);
  }

  /* ── 8) 지정을 옮기면 대상도 옮겨간다(마지막에 켠 쪽이 이긴다) ────── */
  {
    await designate(noteB.id, true, 2_000); // A(1000)보다 나중에 켬
    const r = await get();
    check("나중에 켠 노트(B)가 대상이 된다", r.body.instanceId === noteB.id, r.body.instanceId);
    check("이제 B의 소제목만 보인다", r.body.items.length === 1 && r.body.items[0].sectionId === otherSecId);
    const stale = await fetch(`${BASE}/api/widget/notes/${noteA.id}/${richId}`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "옛 캐시로 수정" }),
    });
    check("폰의 옛 캐시로 A를 고치려 하면 409", stale.status === 409, `status=${stale.status}`);
  }

  /* ── 9) 지정을 모두 끄면 다시 미연결 ──────────────────────────────── */
  {
    await designate(noteA.id, false);
    await designate(noteB.id, false);
    const r = await get();
    check("지정을 끄면 instanceId=null·빈 목록", r.body.instanceId === null && r.body.items.length === 0);
  }

  /* ── 10) 입력 검증 ────────────────────────────────────────────────── */
  {
    await designate(noteA.id, true, 3_000);
    const r = await fetch(`${BASE}/api/widget/notes`, {
      method: "POST", headers: T, body: JSON.stringify({ title: "  ", text: "" }),
    });
    check("제목·내용 둘 다 비면 400", r.status === 400, `status=${r.status}`);
    const r2 = await fetch(`${BASE}/api/widget/notes/${noteA.id}/없는섹션`, {
      method: "POST", headers: T, body: JSON.stringify({ text: "x" }),
    });
    check("없는 섹션 id → 404", r2.status === 404, `status=${r2.status}`);
  }
} finally {
  await cleanup();
  const rows = await (await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`)).json();
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
