"use client";

/**
 * useClipboardHistory — 위젯 인스턴스별 클립보드 기록(Supabase 백엔드).
 *
 *  요구: 같은 계정으로 모바일·PC에서 로그인하면 같은 위젯(instance_id = pb_widgets.id,
 *  기기 무관 동일)의 기록을 **기기 간 동기화**한다. 저장소를 localStorage(기기 전용)에서
 *  pb_clipboard(RLS)로 옮기고, Supabase Realtime으로 즉시 반영 + 포커스 복귀 시 재조회로
 *  보완한다. 각 기록의 `device`(모바일/PC)로 어느 기기에서 복사됐는지 구분한다.
 *
 *  ⚠ 클립보드 텍스트가 서버에 저장된다(RLS 보호). 비밀번호 등 민감값 복사는 주의.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clampMaxItems,
  detectDevice,
  type ClipItem,
  type DeviceKind,
} from "./types";

/** 한 항목 텍스트 상한(거대한 붙여넣기 방지). */
const MAX_TEXT_LEN = 100_000;

interface Row {
  id: string;
  text: string;
  device: string;
  created_at: string;
}

function toItem(r: Row): ClipItem {
  const device: DeviceKind = r.device === "mobile" ? "mobile" : "pc";
  return { id: r.id, text: r.text, ts: Date.parse(r.created_at) || 0, device };
}

export interface ClipboardHistory {
  items: ClipItem[];
  /** Add text to the top (dedupes; trims; caps to maxItems). No-op if blank. */
  add: (text: string) => void;
  /** Remove one entry by id. */
  remove: (id: string) => void;
  /** Clear all entries. */
  clear: () => void;
}

export function useClipboardHistory(
  instanceId: string,
  maxItems: number,
): ClipboardHistory {
  const supabase = React.useMemo(() => createClient(), []);
  const cap = clampMaxItems(maxItems);
  const [items, setItems] = React.useState<ClipItem[]>([]);
  const [nonce, setNonce] = React.useState(0);
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  // 조회 + 실시간 구독 + 포커스/가시성 복귀 재조회(기기 간 동기화).
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setItems([]);
        return;
      }
      const { data } = await supabase
        .from("pb_clipboard")
        .select("id,text,device,created_at")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false })
        .limit(cap);
      if (!alive) return;
      setItems((data ?? []).map((r) => toItem(r as Row)));
    };
    void load();

    const channel = supabase
      .channel(`pb_clipboard:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pb_clipboard",
          filter: `instance_id=eq.${instanceId}`,
        },
        () => void load(),
      )
      .subscribe();

    const onFocus = () => void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, instanceId, cap, nonce]);

  const add = React.useCallback(
    async (text: string) => {
      const t = text.trim().slice(0, MAX_TEXT_LEN);
      if (!t) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // 같은 텍스트는 위로 올림: 기존 동일 텍스트 삭제 후 새로 삽입.
      await supabase
        .from("pb_clipboard")
        .delete()
        .eq("instance_id", instanceId)
        .eq("text", t);
      await supabase.from("pb_clipboard").insert({
        user_id: user.id,
        instance_id: instanceId,
        text: t,
        device: detectDevice(),
      });
      // cap 초과분(오래된 것) 정리.
      const { data } = await supabase
        .from("pb_clipboard")
        .select("id")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false });
      const ids = (data ?? []).map((r) => (r as { id: string }).id);
      if (ids.length > cap) {
        await supabase.from("pb_clipboard").delete().in("id", ids.slice(cap));
      }
      refresh();
    },
    [supabase, instanceId, cap, refresh],
  );

  const remove = React.useCallback(
    async (id: string) => {
      await supabase.from("pb_clipboard").delete().eq("id", id);
      refresh();
    },
    [supabase, refresh],
  );

  const clear = React.useCallback(async () => {
    await supabase.from("pb_clipboard").delete().eq("instance_id", instanceId);
    refresh();
  }, [supabase, instanceId, refresh]);

  return { items, add, remove, clear };
}

/**
 * Capture text copied ON the page (the `copy` event). Reads the current
 * selection, falling back to the selected range of a focused input/textarea.
 * Shared by Compact + Expanded views; the history's add() dedupes overlaps.
 */
export function useCopyCapture(
  enabled: boolean,
  onText: (text: string) => void,
): void {
  const ref = React.useRef(onText);
  ref.current = onText;
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const handler = () => {
      let text = "";
      try {
        text = window.getSelection()?.toString() ?? "";
      } catch {
        /* ignore */
      }
      if (!text) {
        const el = document.activeElement;
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          const s = el.selectionStart ?? 0;
          const e = el.selectionEnd ?? 0;
          if (e > s) text = el.value.slice(s, e);
        }
      }
      if (text && text.trim()) ref.current(text);
    };
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [enabled]);
}

/** Re-copy helper: writes text to the OS clipboard, returns success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Read the current OS clipboard text (requires a user gesture + permission). */
export async function readClipboardText(): Promise<string | null> {
  try {
    const t = await navigator.clipboard.readText();
    return t && t.trim() ? t : null;
  } catch {
    return null;
  }
}

/**
 * Auto-capture the OS clipboard when the app REGAINS focus — the closest a web
 * app can get to "Ctrl+C anywhere → shows up here": copy in another program,
 * switch back to this tab, and the new text is recorded. Reads on window focus +
 * tab-visible (both follow a user gesture, which browsers require for
 * clipboard-read). Stops trying after repeated permission denials so it can't
 * nag. Best-effort — never throws.
 */
export function useClipboardAutoCapture(
  enabled: boolean,
  onText: (text: string) => void,
): void {
  const ref = React.useRef(onText);
  ref.current = onText;
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let denials = 0;
    let busy = false;
    const tryRead = async () => {
      if (busy || denials >= 3 || document.hidden) return;
      busy = true;
      try {
        const t = await navigator.clipboard.readText();
        if (t && t.trim()) ref.current(t);
        denials = 0;
      } catch {
        denials += 1; // permission denied / not focused — back off
      } finally {
        busy = false;
      }
    };
    const onFocus = () => void tryRead();
    const onVisible = () => {
      if (!document.hidden) void tryRead();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    // One attempt on mount (the tile is already focused after the user added it).
    void tryRead();
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
