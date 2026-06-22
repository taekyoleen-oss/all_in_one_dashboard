/**
 * verify-overtime.mjs — KIS 시간외 단일가 반영 재검증(로컬 전용).
 *
 *  목적: 평일 16:00~18:00(KST) 시간외 단일가 매매 중, 실제로 시간외 체결이 있는
 *  종목에 대해 kisClient의 반영 로직(ovtm_untp_vol>0 일 때만 시간외가 채택, 등락은
 *  전일종가 대비)이 기대대로 동작하는지 KIS 응답으로 직접 확인한다.
 *
 *  - SERVER/LOCAL ONLY: .env.local의 KIS 자격증명을 읽는다(클라우드 불가).
 *  - 토큰: .cache/kis-token-cache.json에 유효 토큰이 있으면 재사용, 없으면 1회 발급
 *    (KIS가 카카오톡 1건 발송 가능) 후 파일 캐시에 저장.
 *  - 읽기 전용 시세만 호출(주문/잔고 없음 — 가드레일).
 *
 *  실행: node scripts/verify-overtime.mjs   (PaneBoard 루트에서)
 *  결과: 콘솔 + 인자로 받은 로그 파일(있으면)에 append.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");
const CACHE_FILE =
  process.env.KIS_TOKEN_CACHE_FILE?.trim() ||
  path.join(ROOT, ".cache", "kis-token-cache.json");
const KIS_BASE = "https://openapi.koreainvestment.com:9443";

const LOG_FILE = process.argv[2] || null;
const lines = [];
function out(s = "") {
  console.log(s);
  lines.push(s);
}
function flush() {
  if (!LOG_FILE) return;
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, lines.join("\n") + "\n");
  } catch (e) {
    console.error("log write failed:", e?.message ?? e);
  }
}

/** Parse KEY=VALUE pairs out of .env.local (no quotes handling beyond trim). */
function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(ENV_FILE, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return env;
}

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    str: d.toISOString().replace("T", " ").slice(0, 16) + " KST",
    hour: d.getUTCHours(),
    dow: d.getUTCDay(), // 0=Sun..6=Sat (KST)
  };
}
function inOvertimeWindow(hour) {
  return hour >= 16 || hour < 9;
}

async function getToken(env) {
  // Reuse a still-valid cached token from the file layer (avoids a new KakaoTalk).
  try {
    if (existsSync(CACHE_FILE)) {
      const cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      const e = cache?.access_token;
      if (e && typeof e.token === "string" && Date.now() < e.expiresAt) {
        out(`토큰: 파일 캐시 재사용 (만료 ${new Date(e.expiresAt).toLocaleString("ko-KR")})`);
        return e.token;
      }
    }
  } catch {
    /* fall through to issue */
  }
  out("토큰: 캐시 없음/만료 → 신규 발급(카카오톡 1건 발송될 수 있음)");
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`token failed: ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("no access_token");
  const ttl = typeof json.expires_in === "number" ? json.expires_in : 23 * 3600;
  const expiresAt = Date.now() + Math.max(60, ttl - 600) * 1000;
  try {
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    const prev = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
    prev.access_token = { token: json.access_token, expiresAt };
    writeFileSync(CACHE_FILE, JSON.stringify(prev));
  } catch {
    /* best effort */
  }
  return json.access_token;
}

function headers(env, token, trId) {
  return {
    authorization: `Bearer ${token}`,
    appkey: env.KIS_APP_KEY,
    appsecret: env.KIS_APP_SECRET,
    tr_id: trId,
    custtype: "P",
    "content-type": "application/json; charset=utf-8",
  };
}
function signFactor(s) {
  if (s === "1" || s === "2") return 1;
  if (s === "4" || s === "5") return -1;
  return 0;
}

/** fetch JSON with one retry on failure (KIS '초당 거래건수 초과' is transient). */
async function kisFetch(url, hdrs) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: hdrs });
      if (res.ok) return await res.json();
    } catch {
      /* network — retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function regular(env, token, code) {
  const p = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code });
  const json = await kisFetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?${p}`,
    headers(env, token, "FHKST01010100"),
  );
  const o = json?.output;
  if (!o || o.stck_prpr === undefined) return null;
  const f = signFactor(o.prdy_vrss_sign);
  return {
    name: o.hts_kor_isnm?.trim(),
    price: Number(o.stck_prpr),
    changePct: Math.abs(Number(o.prdy_ctrt ?? 0)) * (f === 0 ? 1 : f),
  };
}

async function overtime(env, token, code) {
  const p = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: "J", FID_INPUT_ISCD: code });
  const json = await kisFetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-overtime-price?${p}`,
    headers(env, token, "FHPST02300000"),
  );
  const o = json?.output;
  if (!o) return { ok: false, status: "no output" };
  const f = signFactor(o.ovtm_untp_prdy_vrss_sign);
  return {
    ok: true,
    price: Number(o.ovtm_untp_prpr),
    vol: Number(o.ovtm_untp_vol ?? 0),
    changePct: Math.abs(Number(o.ovtm_untp_prdy_ctrt ?? 0)) * (f === 0 ? 1 : f),
  };
}

const SYMBOLS = [
  ["005930", "삼성전자"],
  ["000660", "SK하이닉스"],
  ["035720", "카카오"],
  ["035420", "NAVER"],
  ["005380", "현대차"],
];

async function main() {
  const env = loadEnv();
  const t = kstNow();
  out("============================================================");
  out(`[시간외 단일가 재검증] ${t.str}`);
  out(`시간외 창(16~18시 단일가 매매; 16시 이후/9시 이전 반영 대상): ${inOvertimeWindow(t.hour) ? "예" : "아니오"}`);
  if (t.dow === 0 || t.dow === 6) out("⚠ 주말 — 직전 거래일 시간외 종가가 표시될 수 있음");
  if (!env.KIS_APP_KEY || !env.KIS_APP_SECRET) {
    out("✖ KIS 자격증명(.env.local) 없음 — 중단");
    flush();
    process.exit(1);
  }
  let token;
  try {
    token = await getToken(env);
  } catch (e) {
    out(`✖ 토큰 발급 실패: ${e?.message ?? e}`);
    flush();
    process.exit(1);
  }
  out("");
  out("종목            | 정규장가 / 등락 | 시간외가 / 등락 / 거래량 | 위젯 반영");
  out("----------------|-----------------|--------------------------|----------");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let engaged = 0;
  for (const [code, label] of SYMBOLS) {
    let reg, ot;
    try {
      // 순차 호출 + 간격: KIS '초당 거래건수 초과'(EGW00201)로 일부 종목이 누락되는 것 방지.
      reg = await regular(env, token, code);
      await sleep(200);
      ot = await overtime(env, token, code);
      await sleep(200);
    } catch (e) {
      out(`${label.padEnd(8)} | 오류: ${e?.message ?? e}`);
      continue;
    }
    const regStr = reg ? `${reg.price} / ${reg.changePct.toFixed(2)}%` : "—";
    let otStr = "—";
    let verdict = "정규장 유지";
    if (ot?.ok) {
      otStr = `${ot.price} / ${ot.changePct.toFixed(2)}% / vol ${ot.vol}`;
      // kisClient 로직: 시간외 창 + vol>0 일 때만 시간외가 반영.
      if (inOvertimeWindow(t.hour) && Number.isFinite(ot.price) && ot.price > 0 && ot.vol > 0) {
        verdict = "✅ 시간외 반영";
        engaged++;
      } else if (ot.vol <= 0) {
        verdict = "정규장 유지(시간외 미거래)";
      } else if (!inOvertimeWindow(t.hour)) {
        verdict = "정규장 유지(창 밖)";
      }
    }
    out(`${label.padEnd(8)} | ${regStr.padEnd(15)} | ${otStr.padEnd(24)} | ${verdict}`);
  }
  out("");
  if (engaged > 0) {
    out(`✅ PASS — ${engaged}개 종목에서 시간외 단일가가 정규장 위에 반영됨(vol>0).`);
  } else if (inOvertimeWindow(t.hour)) {
    out("ℹ 현재 시간외 창이지만 위 종목에 시간외 체결(vol>0)이 아직 없음 → 정규장 유지(정상).");
    out("  체결이 생기는 16:10 이후 다시 실행하면 반영을 확인할 수 있습니다.");
  } else {
    out("ℹ 시간외 창(16~18시)이 아니라 정규장가가 유지됨(정상). 평일 16~18시에 실행하세요.");
  }
  out("============================================================");
  flush();
}

main().catch((e) => {
  out(`✖ 예외: ${e?.stack ?? e}`);
  flush();
  process.exit(1);
});
