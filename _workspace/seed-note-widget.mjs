// 검증용: 소제목이 든 노트 위젯을 테스트 계정 보드에 심는다.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const api = (p, i = {}) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}${p}`, {
  ...i,
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json", prefer: "return=representation", ...(i.headers ?? {}),
  },
});

const { email, id } = JSON.parse(readFileSync(new URL("./out/test-account.json", import.meta.url), "utf8"));
const boards = await (await api(`/rest/v1/pb_dashboards?user_id=eq.${id}&select=id&limit=1`)).json();
if (!boards.length) { console.error("보드 없음 — 먼저 로그인해 부트스트랩을 돌리세요"); process.exit(1); }

const wid = randomUUID();
const r = await api("/rest/v1/pb_widgets", {
  method: "POST",
  body: JSON.stringify({
    id: wid, dashboard_id: boards[0].id, user_id: id, type: "note",
    config: {
      title: "강의 노트",
      html: "<p>머리말</p>",
      attachments: [],
      shareTarget: true,
      sections: [
        { id: randomUUID(), title: "1주차", html: "<p>첫 주 내용</p>" },
        { id: randomUUID(), title: "2주차", html: "<p>둘째 주 내용</p>" },
      ],
    },
    layout: { x: 0, y: 0, w: 8, h: 10, gv: 2 },
  }),
});
console.log(r.ok ? `seeded note ${wid.slice(0, 8)} for ${email}` : `FAILED ${await r.text()}`);
