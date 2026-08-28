"use client";

/**
 * useTasks — 작업 위젯의 pb_tasks 데이터 계층(인스턴스별, 기기·모바일 위젯 간 동기화).
 *
 *  useClipboardHistory와 같은 골격: RLS 직접 CRUD + realtime 구독 + 포커스 복귀
 *  재조회. 안드로이드 홈 화면 위젯이 /api/widget/tasks(service-role)로 같은 행을
 *  추가·삭제하면 realtime 이벤트로 이 훅이 즉시 다시 읽는다(양방향 동기화의 웹 절반).
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { TaskRowSchema, type TaskRow } from "@/output/api-shapes";

const MAX_TITLE_LEN = 500;

export interface Tasks {
  rows: TaskRow[];
  /** 맨 아래에 추가(빈 문자열 no-op). dueOn은 "YYYY-MM-DD"(선택). */
  add: (title: string, dueOn?: string | null) => void;
  toggle: (id: string, done: boolean) => void;
  remove: (id: string) => void;
}

export function useTasks(instanceId: string): Tasks {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<TaskRow[]>([]);
  const [nonce, setNonce] = React.useState(0);
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);
  // 타일+전체보기 동시 마운트 대비 훅별 유니크 채널 토픽(클립보드 선례).
  const channelUid = React.useId();

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setRows([]);
        return;
      }
      const { data } = await supabase
        .from("pb_tasks")
        .select("id, user_id, instance_id, title, done, due_on, created_at")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: true });
      if (!alive) return;
      setRows(
        (data ?? []).flatMap((r) => {
          const parsed = TaskRowSchema.safeParse(r);
          return parsed.success ? [parsed.data] : [];
        }),
      );
    };
    void load();

    // realtime은 best-effort — 실패해도 포커스 재조회로 동기화된다.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase.channel(`pb_tasks:${instanceId}:${channelUid}`);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pb_tasks",
            filter: `instance_id=eq.${instanceId}`,
          },
          () => void load(),
        )
        .subscribe();
    } catch {
      channel = null;
    }

    const onFocus = () => void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, instanceId, nonce, channelUid]);

  const add = React.useCallback(
    async (title: string, dueOn?: string | null) => {
      const t = title.trim().slice(0, MAX_TITLE_LEN);
      if (!t) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("pb_tasks").insert({
        user_id: user.id,
        instance_id: instanceId,
        title: t,
        due_on: dueOn || null,
      });
      refresh();
    },
    [supabase, instanceId, refresh],
  );

  const toggle = React.useCallback(
    async (id: string, done: boolean) => {
      await supabase.from("pb_tasks").update({ done }).eq("id", id);
      refresh();
    },
    [supabase, refresh],
  );

  const remove = React.useCallback(
    async (id: string) => {
      await supabase.from("pb_tasks").delete().eq("id", id);
      refresh();
    },
    [supabase, refresh],
  );

  return { rows, add, toggle, remove };
}
