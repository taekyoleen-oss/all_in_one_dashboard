// 실브라우저 검증용 임시 승인 계정 만들기/지우기.
//   node _workspace/test-account.mjs create   → 이메일·비밀번호 출력
//   node _workspace/test-account.mjs drop <email>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const api = (p, i = {}) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}${p}`, {
  ...i,
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json", ...(i.headers ?? {}) },
});
const STORE = new URL("./out/test-account.json", import.meta.url);
const cmd = process.argv[2];

if (cmd === "create") {
  const email = `pb-e2e-${Date.now()}@example.com`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-7xQ`;
  const m = await api("/rest/v1/pb_members", { method: "POST", body: JSON.stringify({ email, status: "approved" }) });
  if (!m.ok) { console.error("member insert failed", await m.text()); process.exit(1); }
  const u = await api("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
  const j = await u.json();
  if (!u.ok) { console.error("user create failed", JSON.stringify(j)); process.exit(1); }
  writeFileSync(STORE, JSON.stringify({ email, password, id: j.id }, null, 2));
  console.log(`EMAIL=${email}`);
  console.log(`PASSWORD=${password}`);
} else if (cmd === "drop") {
  if (!existsSync(STORE)) { console.log("no stored account"); process.exit(0); }
  const { email, id } = JSON.parse(readFileSync(STORE, "utf8"));
  if (id) await api(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
  await api(`/rest/v1/pb_members?email=eq.${encodeURIComponent(email)}`, { method: "DELETE" });
  const left = await (await api(`/rest/v1/pb_members?email=eq.${encodeURIComponent(email)}&select=email`)).json();
  console.log(`dropped ${email} — 잔여 ${Array.isArray(left) ? left.length : "?"}행`);
} else {
  console.error("usage: create | drop");
  process.exit(1);
}
