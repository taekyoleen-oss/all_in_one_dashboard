// P1 DoD 검증 (PLAN-android-widget.md): 페어링 → 토큰 → 아젠다 → 상태 변경 → 정리.
//
//  전제: ① supabase/migrations/20260828120001_pb_widget_devices.sql 라이브 적용,
//        ② 로컬 dev 서버(기본 http://localhost:3000) 실행 중.
//  사용: node _workspace/verify-widget-api.mjs [baseUrl]
//  비밀값은 .env.local에서만 읽고 출력하지 않는다. 만든 행(코드·디바이스·임시 일정)은
//  끝에서 모두 삭제한다.
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
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = (env.ALLOWED_EMAIL ?? "").toLowerCase();
if (!SUPA || !KEY || !OWNER_EMAIL) throw new Error(".env.local에 필요한 키가 없습니다");

const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const rest = (path, init = {}) => fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const results = [];
const check = (name, ok, detail = "") => {
  results.push([ok ? "PASS" : "FAIL", name, detail]);
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

// 0) DDL 적용 여부
{
  const r = await rest("pb_widget_devices?limit=0");
  if (!r.ok) {
    console.error("⛔ pb_widget_devices 테이블이 없습니다. 먼저 마이그레이션 SQL을 SQL Editor에서 실행하세요.");
    process.exit(2);
  }
  check("DDL: pb_widget_devices 존재", true);
  const c = await rest("pb_circle_appointments?select=status&limit=1");
  check("DDL: appointments.status 컬럼", c.ok, c.ok ? "" : await c.text());
}

// 1) 소유자 user_id 해석 (auth admin)
const usersRes = await fetch(`${SUPA}/auth/v1/admin/users?per_page=100`, { headers: H });
const users = (await usersRes.json()).users ?? [];
const owner = users.find((u) => (u.email ?? "").toLowerCase() === OWNER_EMAIL);
if (!owner) throw new Error("소유자 계정을 찾지 못했습니다");
check("소유자 계정 해석", true, owner.id.slice(0, 8) + "…");

// 2) 페어링 코드 시드(설정 UI의 POST /api/widget/pairing-codes와 동일 저장 형태)
const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
await rest(`pb_widget_pairing_codes?user_id=eq.${owner.id}`, { method: "DELETE" });
const seed = await rest("pb_widget_pairing_codes", {
  method: "POST",
  body: JSON.stringify({ code_hash: sha256(code), user_id: owner.id, expires_at: new Date(Date.now() + 300_000).toISOString() }),
});
check("페어링 코드 시드", seed.ok, seed.ok ? "" : await seed.text());

// 3) POST /api/widget/pair — 코드 → 토큰 (DoD 핵심 ①)
const pairRes = await fetch(`${BASE}/api/widget/pair`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code, label: "verify-script" }),
});
const pair = await pairRes.json();
check("POST /api/widget/pair → 200 + token", pairRes.status === 200 && typeof pair.token === "string" && pair.token.startsWith("pbw_"), `status ${pairRes.status}`);

// 3b) 같은 코드 재사용은 거부(1회용)
const reuse = await fetch(`${BASE}/api/widget/pair`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }),
});
check("코드 재사용 → 400", reuse.status === 400, `status ${reuse.status}`);

// 4) 임시 일정 1건(내일 이내) 생성 후 아젠다 확인
const tmpAppt = await rest("pb_circle_appointments", {
  method: "POST", headers: { prefer: "return=representation" },
  body: JSON.stringify({ user_id: owner.id, content: "위젯 검증용 임시 일정", when_at: new Date(Date.now() + 3_600_000).toISOString() }),
}).then((r) => r.json());
const apptId = tmpAppt?.[0]?.id;

const agendaRes = await fetch(`${BASE}/api/widget/agenda?days=2`, { headers: { authorization: `Bearer ${pair.token}` } });
const agenda = await agendaRes.json();
const etag = agendaRes.headers.get("etag");
const found = (agenda.items ?? []).find((i) => i.id === apptId);
check("GET /api/widget/agenda → 200 (DoD 핵심 ②)", agendaRes.status === 200, `items ${agenda.items?.length}`);
check("아젠다에 임시 일정 포함 + ETag", Boolean(found && etag), `etag ${etag}`);

// 4b) If-None-Match → 304
const notMod = await fetch(`${BASE}/api/widget/agenda?days=2`, { headers: { authorization: `Bearer ${pair.token}`, "if-none-match": etag ?? "" } });
check("If-None-Match → 304", notMod.status === 304, `status ${notMod.status}`);

// 5) PATCH 상태 변경: done → snoozed(기본 내일 9시) → pending
const patch = (bodyObj) => fetch(`${BASE}/api/widget/appointments/${apptId}`, {
  method: "PATCH", headers: { authorization: `Bearer ${pair.token}`, "content-type": "application/json" },
  body: JSON.stringify(bodyObj),
});
const doneRes = await patch({ status: "done" });
const dbDone = await rest(`pb_circle_appointments?id=eq.${apptId}&select=status,completed_at`).then((r) => r.json());
check("PATCH done → DB status/completed_at", doneRes.status === 200 && dbDone[0]?.status === "done" && Boolean(dbDone[0]?.completed_at));
const snoozeRes = await patch({ status: "snoozed" });
const snoozeBody = await snoozeRes.json();
check("PATCH snoozed → 기본 연기일(다음날 9시 KST)", snoozeRes.status === 200 && Boolean(snoozeBody.snoozeUntil), snoozeBody.snoozeUntil);
await patch({ status: "pending" });

// 6) 무효 토큰 401
const bad = await fetch(`${BASE}/api/widget/agenda`, { headers: { authorization: "Bearer pbw_invalid" } });
check("무효 토큰 → 401", bad.status === 401, `status ${bad.status}`);

// 7) 정리 — 임시 일정·디바이스·코드 삭제
if (apptId) await rest(`pb_circle_appointments?id=eq.${apptId}`, { method: "DELETE" });
await rest(`pb_widget_devices?id=eq.${pair.deviceId}`, { method: "DELETE" });
await rest(`pb_widget_pairing_codes?user_id=eq.${owner.id}`, { method: "DELETE" });
const gone = await fetch(`${BASE}/api/widget/agenda`, { headers: { authorization: `Bearer ${pair.token}` } });
check("폐기(행 삭제) 후 토큰 → 401", gone.status === 401, `status ${gone.status}`);
console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} PASS`);
