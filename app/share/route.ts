/**
 * ============================================================================
 *  /share — mobile Web Share Target landing (GET) → append into the "공유 받기" 노트
 * ============================================================================
 *
 *  Registered via the PWA manifest `share_target` (app/manifest.ts). When the
 *  installed app is chosen from the phone's share sheet, the OS navigates here
 *  with the shared `title` / `text` / `url` as query params (GET, no service
 *  worker needed). We:
 *    1. Confirm the owner session (proxy already gated; this is defense-in-depth).
 *    2. Find the single note flagged `config.shareTarget === true` (falling back
 *       to the user's earliest note — "처음 노트는 기본 공유 대상").
 *    3. Append the shared content as a SAFE HTML block (the snippet is built from
 *       HTML-escaped plain text + a scheme-validated link — never the raw share
 *       string), self-heal the chosen note's shareTarget flag, and persist.
 *    4. Redirect to /share/done for a confirmation screen.
 *
 *  RLS scopes every query/write to auth.uid(), so a share can only ever touch
 *  the owner's own notes. Route Handlers run once per request (unlike RSC render),
 *  so the append is not duplicated.
 *
 *  NOTE: the open-in-another-tab desktop session keeps an optimistic in-memory
 *  copy of this note; its next flush could overwrite a concurrent share. In the
 *  normal mobile flow the share opens the app cold (this redirect reloads it), so
 *  the appended content is read back fresh — the race only matters with a second
 *  session held open simultaneously (rare for a personal board).
 * ============================================================================
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth/members";

/** Minimal HTML-escape for untrusted plain text destined for innerHTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Return the URL only if it is a safe http(s) link, else null. */
function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* not a URL */
  }
  return null;
}

/** Build the sanitized HTML block appended to the note for one shared item. */
function buildSharedBlock(title: string, text: string, url: string | null): string {
  const parts: string[] = ["<hr/>"];
  const heading = title.trim() || "공유 받은 내용";
  parts.push(`<p><strong>${escapeHtml(heading)}</strong></p>`);
  if (text.trim()) {
    parts.push(`<p>${escapeHtml(text.trim()).replace(/\n/g, "<br/>")}</p>`);
  }
  if (url) {
    // 공유받은 웹페이지는 한눈에 '링크'로 보여야 한다(요구) — 🔗 + 사이트 이름 +
    // 전체 주소. 노트 본문 스타일이 <a>에 색·밑줄을 주고, sanitize가 새 탭을
    // 강제한다. (본문 text 안에 섞여 온 주소는 렌더 시 자동 링크로 처리된다.)
    const safe = escapeHtml(url);
    let host = "";
    try {
      host = escapeHtml(new URL(url).host.replace(/^www\./i, ""));
    } catch {
      /* URL은 이미 검증됨 — 방어적 처리 */
    }
    parts.push(
      `<p>🔗 <a href="${safe}" target="_blank" rel="noopener noreferrer">${host ? `${host} — ` : ""}${safe}</a></p>`,
    );
  }
  return parts.join("");
}

function doneUrl(req: NextRequest, status: string, title?: string): URL {
  const u = new URL("/share/done", req.url);
  u.searchParams.set("status", status);
  if (title) u.searchParams.set("title", title);
  return u;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get("title") ?? "";
  const text = params.get("text") ?? "";
  const urlParam = params.get("url") ?? "";

  // Some apps pack the link into `text` and leave `url` empty — recover it.
  const url = safeHttpUrl(urlParam) ?? (text ? safeHttpUrl(text) : null);

  // Nothing to save → confirmation with an "empty" notice (no write).
  if (!title.trim() && !text.trim() && !url) {
    return NextResponse.redirect(doneUrl(request, "empty"));
  }

  const supabase = await createClient();

  // Defense-in-depth auth (proxy already gates /share, preserving params through
  // login). A foreign/missing session → bounce to login carrying the share back.
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined)?.toLowerCase();
  if (!(await isAllowedEmail(email))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  // Find the destination note: prefer the flagged one (latest updated_at), else
  // fall back to the earliest note ("first note").
  const { data: notes, error } = await supabase
    .from("pb_widgets")
    .select("id,config,updated_at")
    .eq("type", "note")
    .order("updated_at", { ascending: false });

  if (error) {
    // 에러 객체 전체가 아닌 message/code만 — 로그에 불필요한 내부정보 미노출.
    console.error("[share] note lookup failed:", error.message, error.code ?? "");
    return NextResponse.redirect(doneUrl(request, "error"));
  }
  if (!notes || notes.length === 0) {
    return NextResponse.redirect(doneUrl(request, "nonote"));
  }

  const flagged = notes.find(
    (n) => (n.config as { shareTarget?: boolean } | null)?.shareTarget,
  );
  // Fallback = earliest note: the list is newest-first, so the last row is oldest.
  const target = flagged ?? notes[notes.length - 1];

  const cfg = (target.config ?? {}) as {
    title?: string;
    html?: string;
    shareTarget?: boolean;
  };
  const block = buildSharedBlock(title, text, url);
  const nextConfig = {
    ...cfg,
    html: (cfg.html ?? "") + block,
    // Self-heal: make the chosen note the explicit single share target.
    shareTarget: true,
    updatedAt: Date.now(),
  };

  const { error: updErr } = await supabase
    .from("pb_widgets")
    .update({ config: nextConfig })
    .eq("id", target.id);

  if (updErr) {
    console.error("[share] note update failed:", updErr.message, updErr.code ?? "");
    return NextResponse.redirect(doneUrl(request, "error"));
  }

  return NextResponse.redirect(doneUrl(request, "ok", cfg.title || "노트"));
}
