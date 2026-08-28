// 작업(tasks) 브리지 DoD 검증: 지정 인스턴스 해석 → 추가/토글/삭제 → ETag → no_target.
//
//  전제: ① 20260828120002_pb_tasks.sql 라이브 적용, ② dev 서버 실행 중.
//  사용: node _workspace/verify-tasks-api.mjs [baseUrl]
//  만든 행(위젯·작업·디바이스·코드)은 끝에서 전부 삭제한다.
import { readFileSync } from "node:fs";
import { createHash, randomInt, randomUUID } from "node:crypto";

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
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const rest = (path, init = {}) =>
  fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
let pass = 0, total = 0;
const check = (name, ok, detail = "") => {
  total++; if (ok) pass++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
};

// 0) DDL + 소유자
{
  const r = await rest("pb_tasks?limit=0");
  if (!r.ok) { console.error("⛔ pb_tasks 없음 — 마이그레이션 SQL을 먼저 실행하세요."); process.exit(2); }
  check("DDL: pb_tasks 존재", true);
}
const users = (await (await fetch(`${SUPA}/auth/v1/admin/users?per_page=100`, { headers: H })).json()).users ?? [];
const owner = users.find((u) => (u.email ?? "").toLowerCase() === OWNER_EMAIL);
if (!owner) throw new Error("소유자 계정 없음");

// 1) 임시 '작업' 위젯 인스턴스(mobileSync ON) 생성
const dash = await rest(`pb_dashboards?user_id=eq.${owner.id}&select=id&limit=1`).then((r) => r.json());
const widgetId = randomUUID();
const mk = await rest("pb_widgets", {
  method: "POST",
  body: JSON.stringify({
    id: widgetId, dashboard_id: dash[0].id, user_id: owner.id, type: "tasks",
    config: { mobileSync: true, mobileSyncAt: Date.now() }, layout: { x: 0, y: 99, w: 6, h: 8 },
  }),
});
check("임시 tasks 위젯 생성(mobileSync ON)", mk.ok, mk.ok ? widgetId.slice(0, 8) : await mk.text());

// 2) 페어링 → 토큰
const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
await rest(`pb_widget_pairing_codes?user_id=eq.${owner.id}`, { method: "DELETE" });
await rest("pb_widget_pairing_codes", {
  method: "POST",
  body: JSON.stringify({ code_hash: sha256(code), user_id: owner.id, expires_at: new Date(Date.now() + 300_000).toISOString() }),
});
const pair = await (await fetch(`${BASE}/api/widget/pair`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code, label: "tasks-verify" }),
})).json();
check("pair → 토큰", typeof pair.token === "string");
const AUTH = { authorization: `Bearer ${pair.token}`, "content-type": "application/json" };

// 3) GET — 지정 인스턴스 해석 + 빈 목록 + ETag
let res = await fetch(`${BASE}/api/widget/tasks`, { headers: AUTH });
let body = await res.json();
const etag0 = res.headers.get("etag");
check("GET tasks: instanceId=지정 위젯, items 0", res.status === 200 && body.instanceId === widgetId && body.items.length === 0);
res = await fetch(`${BASE}/api/widget/tasks`, { headers: { ...AUTH, "if-none-match": etag0 } });
check("If-None-Match → 304", res.status === 304);

// 4) POST 추가(모바일 → 웹 방향) → DB 행 확인
res = await fetch(`${BASE}/api/widget/tasks`, { method: "POST", headers: AUTH, body: JSON.stringify({ title: "모바일에서 추가한 작업" }) });
const added = await res.json();
check("POST 추가 → 201", res.status === 201 && added.id, added.title);
const dbRow = await rest(`pb_tasks?id=eq.${added.id}&select=title,done,instance_id`).then((r) => r.json());
check("DB 행 생성(웹 위젯이 realtime으로 보게 될 행)", dbRow[0]?.title === "모바일에서 추가한 작업" && dbRow[0]?.instance_id === widgetId);

// 5) 웹 → 모바일 방향: 서비스 롤로 직접 insert(웹 위젯의 RLS insert와 동일 행) 후 GET에 포함되는지
const webAdd = await rest("pb_tasks", {
  method: "POST", headers: { prefer: "return=representation" },
  body: JSON.stringify({ user_id: owner.id, instance_id: widgetId, title: "웹에서 추가한 작업" }),
}).then((r) => r.json());
body = await (await fetch(`${BASE}/api/widget/tasks`, { headers: AUTH })).json();
check("웹 추가분이 모바일 GET에 포함(2건)", body.items.length === 2 && body.items.some((i) => i.title === "웹에서 추가한 작업"));

// 6) PATCH done → DELETE
res = await fetch(`${BASE}/api/widget/tasks/${added.id}`, { method: "PATCH", headers: AUTH, body: JSON.stringify({ done: true }) });
const afterPatch = await rest(`pb_tasks?id=eq.${added.id}&select=done`).then((r) => r.json());
check("PATCH done → DB 반영", res.status === 200 && afterPatch[0]?.done === true);
res = await fetch(`${BASE}/api/widget/tasks/${added.id}`, { method: "DELETE", headers: AUTH });
const afterDel = await rest(`pb_tasks?id=eq.${added.id}&select=id`).then((r) => r.json());
check("DELETE → DB 행 삭제", res.status === 200 && afterDel.length === 0);

// 7) no_target: mobileSync OFF → POST 409
await rest(`pb_widgets?id=eq.${widgetId}`, { method: "PATCH", body: JSON.stringify({ config: { mobileSync: false } }) });
res = await fetch(`${BASE}/api/widget/tasks`, { method: "POST", headers: AUTH, body: JSON.stringify({ title: "x" }) });
check("지정 해제 후 POST → 409 no_target", res.status === 409);
body = await (await fetch(`${BASE}/api/widget/tasks`, { headers: AUTH })).json();
check("지정 해제 후 GET → instanceId null", body.instanceId === null && body.items.length === 0);

// 8) 정리
await rest(`pb_tasks?instance_id=eq.${widgetId}`, { method: "DELETE" });
await rest(`pb_widgets?id=eq.${widgetId}`, { method: "DELETE" });
await rest(`pb_widget_devices?id=eq.${pair.deviceId}`, { method: "DELETE" });
await rest(`pb_widget_pairing_codes?user_id=eq.${owner.id}`, { method: "DELETE" });
console.log(`\n${pass}/${total} PASS (임시 데이터 정리 완료)`);
