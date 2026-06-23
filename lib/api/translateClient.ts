/**
 * ============================================================================
 *  Translate client — keyless first, DeepL when keyed (번역기)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes a translation into the shared `Translate` shape
 *  (output/api-shapes.ts — the anti-drift single source).
 *
 *    • DeepL    : used when `DEEPL_API_KEY` is set. Supports source "auto"
 *                 (auto-detect) and reports the detected source language.
 *    • Google   : the **keyless** public `translate_a/single` endpoint. Supports
 *                 sl=auto and returns the detected language. Works today, no key.
 *    • MyMemory : **keyless** secondary fallback. Needs an explicit source, so
 *                 when source is "auto" we infer ko↔en from the script.
 *
 *  All three produce the SAME normalized shape. The route never throws raw
 *  upstream errors and never serializes the key.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/translate/route.ts.
import type { Translate } from "@/output/api-shapes";

const FETCH_TIMEOUT_MS = 9_000;
/** MyMemory anonymous calls cap at ~500 chars/segment; keep inputs sane. */
export const MAX_TRANSLATE_CHARS = 2000;

export function hasDeeplKey(): boolean {
  return Boolean(process.env.DEEPL_API_KEY?.trim());
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Rough script guess so "auto" still works on the keyless MyMemory path. */
function guessSource(text: string, target: string): string {
  const hasHangul = /[가-힣]/.test(text);
  if (hasHangul) return "ko";
  // No Hangul → assume English unless the target itself is English.
  return target === "en" ? "ko" : "en";
}

/* --------------------------------- DeepL ---------------------------------- */

async function translateDeepl(
  text: string,
  source: string,
  target: string,
): Promise<Translate | null> {
  const key = process.env.DEEPL_API_KEY?.trim();
  if (!key) return null;
  // Free keys end with ":fx" and use the free host.
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const body = new URLSearchParams({
    text,
    target_lang: target.toUpperCase(),
  });
  if (source !== "auto") body.set("source_lang", source.toUpperCase());

  const res = await fetchWithTimeout(`${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res || !res.ok) return null;
  const json = (await res.json()) as {
    translations?: Array<{
      text?: string;
      detected_source_language?: string;
    }>;
  };
  const t = json.translations?.[0];
  if (!t?.text) return null;
  return {
    translatedText: t.text,
    source,
    target,
    detectedSource: t.detected_source_language?.toLowerCase(),
    provider: "deepl",
  };
}

/* ------------------------- Google (keyless gtx) --------------------------- */

async function translateGoogle(
  text: string,
  source: string,
  target: string,
): Promise<Translate | null> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: source === "auto" ? "auto" : source,
    tl: target,
    dt: "t",
    q: text,
  });
  const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!res || !res.ok) return null;
  // Shape: [ [ ["translated","orig",...], ... ], null, "en", ... ]
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) return null;
  const segments = json[0];
  if (!Array.isArray(segments)) return null;
  let out = "";
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0];
  }
  if (!out) return null;
  const detected = typeof json[2] === "string" ? json[2] : undefined;
  return {
    translatedText: out,
    source,
    target,
    detectedSource: detected,
    provider: "mymemory", // normalized below — see translate()
  };
}

/* -------------------------------- MyMemory -------------------------------- */

async function translateMyMemory(
  text: string,
  source: string,
  target: string,
): Promise<Translate | null> {
  const realSource = source === "auto" ? guessSource(text, target) : source;
  const params = new URLSearchParams({
    q: text,
    langpair: `${realSource}|${target}`,
  });
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!res || !res.ok) return null;
  const json = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };
  const out = json.responseData?.translatedText;
  if (!out) return null;
  return {
    translatedText: out,
    source,
    target,
    detectedSource: realSource,
    provider: "mymemory",
  };
}

/**
 * Translate `text` from `source` ("auto" allowed) to `target`. Tries DeepL
 * (keyed) → keyless Google → keyless MyMemory. Returns null only if all fail.
 */
export async function translate(
  text: string,
  source: string,
  target: string,
): Promise<Translate | null> {
  const trimmed = text.slice(0, MAX_TRANSLATE_CHARS);
  if (!trimmed.trim()) return null;
  if (source !== "auto" && source === target) {
    return {
      translatedText: trimmed,
      source,
      target,
      detectedSource: source,
      provider: "mymemory",
      note: "원문과 번역 언어가 같습니다.",
    };
  }

  if (hasDeeplKey()) {
    const d = await translateDeepl(trimmed, source, target);
    if (d) return d;
  }

  const g = await translateGoogle(trimmed, source, target);
  if (g) return { ...g, provider: "mymemory" };

  const m = await translateMyMemory(trimmed, source, target);
  if (m) return m;

  return null;
}
