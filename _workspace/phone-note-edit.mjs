// 폰 역할 시뮬레이션 — 디바이스 토큰으로 /api/widget/notes를 호출한다.
// 사용: node _workspace/phone-note-edit.mjs <edit|add|delete> "<값>" [baseUrl]
import { readFileSync } from "node:fs";
import { createHash, randomInt } from "node:crypto";

const OP = process.argv[2] ?? "edit";
const VALUE = process.argv[3] ?? "폰에서 고친 내용";
const BASE = process.argv[4] ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const { id } = JSON.parse(readFileSync(new URL("./out/test-account.json", import.meta.url), "utf8"));
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const rest = (p, i = {}) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${p}`, {
  ...i,
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json", prefer: "return=representation", ...(i.headers ?? {}),
  },
});

const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
await rest(`pb_widget_pairing_codes?user_id=eq.${id}`, { method: "DELETE" });
await rest("pb_widget_pairing_codes", {
  method: "POST",
  body: JSON.stringify({ code_hash: sha256(code), user_id: id, expires_at: new Date(Date.now() + 300_000).toISOString() }),
});
const pair = await (await fetch(`${BASE}/api/widget/pair`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ code, label: "phone-sim" }),
})).json();
const T = { authorization: `Bearer ${pair.token}`, "content-type": "application/json" };

const list = await (await fetch(`${BASE}/api/widget/notes`, { headers: T })).json();
console.log("폰이 받은 소제목:", list.items.map((m) => `${m.title}${m.rich ? " 🖼" : ""}`).join(" | ") || "(없음)");

const first = list.items[0];
if (OP === "add") {
  const r = await fetch(`${BASE}/api/widget/notes`, {
    method: "POST", headers: T, body: JSON.stringify({ title: VALUE, text: "폰에서 추가한 내용" }),
  });
  console.log(`추가 ${r.status}:`, JSON.stringify(await r.json()));
} else if (OP === "delete") {
  const r = await fetch(`${BASE}/api/widget/notes/${first.noteId}/${first.sectionId}`, {
    method: "DELETE", headers: T,
  });
  console.log(`삭제 ${r.status}:`, JSON.stringify(await r.json()));
} else {
  const r = await fetch(`${BASE}/api/widget/notes/${first.noteId}/${first.sectionId}`, {
    method: "POST", headers: T, body: JSON.stringify({ title: VALUE, text: "폰에서 고친 본문" }),
  });
  console.log(`수정 ${r.status}:`, JSON.stringify(await r.json()));
}
await rest(`pb_widget_devices?id=eq.${pair.deviceId}`, { method: "DELETE" });
await rest(`pb_widget_pairing_codes?user_id=eq.${id}`, { method: "DELETE" });
