// 폰 '작업' 위젯이 **새로 쓴 것을 맨 위**로 주는가 — 실서버 검증.
// 사용: node _workspace/verify-tasks-order.mjs [baseUrl]
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

const EMAIL = `pb-taskorder-${Date.now()}@example.com`;
let userId = null;
try {
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

  // 모바일 표시로 지정된 작업 위젯
  const w = (await (await rest("pb_widgets", {
    method: "POST",
    body: JSON.stringify({
      dashboard_id: boardId, user_id: userId, type: "tasks",
      config: { mobileSync: true, mobileSyncAt: Date.now() },
      layout: { x: 0, y: 0, w: 8, h: 8, gv: 2 },
    }),
  })).json())[0];

  // 오래된 → 새것 순으로 3건(created_at을 명시해 순서를 확정한다)
  const base = Date.now() - 3 * 60_000;
  for (const [i, title] of ["가장 오래된", "중간", "가장 새로운"].entries()) {
    await rest("pb_tasks", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId, instance_id: w.id, title,
        created_at: new Date(base + i * 60_000).toISOString(),
      }),
    });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await rest("pb_widget_pairing_codes", {
    method: "POST",
    body: JSON.stringify({ code_hash: sha256(code), user_id: userId, expires_at: new Date(Date.now() + 3e5).toISOString() }),
  });
  const pair = await (await fetch(`${BASE}/api/widget/pair`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, label: "verify-order" }),
  })).json();
  const T = { authorization: `Bearer ${pair.token}`, "content-type": "application/json" };

  const list = await (await fetch(`${BASE}/api/widget/tasks`, { headers: T })).json();
  const titles = list.items.map((t) => t.title);
  console.log("   폰이 받은 순서:", titles.join(" → "));
  check("새로 쓴 것이 맨 위", titles[0] === "가장 새로운", titles[0]);
  check("오래된 것이 맨 아래", titles.at(-1) === "가장 오래된", titles.at(-1));

  // 폰에서 추가한 것도 맨 위에 와야 한다.
  await fetch(`${BASE}/api/widget/tasks`, {
    method: "POST", headers: T, body: JSON.stringify({ title: "폰에서 방금 추가" }),
  });
  const after = (await (await fetch(`${BASE}/api/widget/tasks`, { headers: T })).json()).items.map((t) => t.title);
  console.log("   추가 후:", after.join(" → "));
  check("폰에서 추가한 것도 맨 위", after[0] === "폰에서 방금 추가", after[0]);
} finally {
  if (userId) await adminAuth(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}`, { method: "DELETE" });
  const rows = await (await rest(`pb_members?email=eq.${encodeURIComponent(EMAIL)}&select=email`)).json();
  console.log(`\n정리: pb_members 잔여 ${Array.isArray(rows) ? rows.length : "?"}행`);
  console.log(`\n${pass}/${total} PASS`);
}
