// P4 검증용: 길찾기 위젯을 출발·도착이 설정된 상태로 시드한다(UI 경로는 P3에서 증명 완료).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const api = (p, i = {}) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}${p}`, { ...i, headers: {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json", prefer: "return=representation", ...(i.headers ?? {}) } });

const { email, id } = JSON.parse(readFileSync(new URL("./out/test-account.json", import.meta.url), "utf8"));
const boards = await (await api(`/rest/v1/pb_dashboards?user_id=eq.${id}&select=id&limit=1`)).json();
if (!boards.length) { console.error("보드 없음 — 먼저 로그인해 부트스트랩을 돌리세요"); process.exit(1); }

const wid = randomUUID();
const r = await api("/rest/v1/pb_widgets", { method: "POST", body: JSON.stringify({
  id: wid, dashboard_id: boards[0].id, user_id: id, type: "walk-route",
  config: {
    start: { label: "이태원역", lat: 37.53454, lon: 126.99461 },
    end: { label: "N서울타워", lat: 37.55130, lon: 126.98817 },
    avoidStairs: false,
  },
  layout: { x: 0, y: 0, w: 8, h: 16, gv: 2 },
}) });
console.log(r.ok ? `seeded ${wid.slice(0,8)} for ${email}` : `FAILED ${await r.text()}`);
