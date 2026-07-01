"use client";

/**
 * useCircleData — 지인 일정 정리 위젯의 Supabase 데이터 계층.
 *
 *  pb_circle_targets(구분) + pb_circle_appointments(약속)을 클라이언트에서 직접
 *  읽고 쓴다. 스코핑은 RLS(auth.uid()=user_id)에 맡기고, 쓰기 시에는 user_id를
 *  명시로 채워 with-check를 통과시킨다(card-usage 위젯과 동일 패턴).
 *
 *  모든 위젯 인스턴스가 같은 사용자 데이터를 공유하므로(테이블 기반), 타일을 여러
 *  개 두어도 하나의 목록을 본다. 저장 후에는 refresh()로 다시 읽는다.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CircleAppointmentSchema,
  CircleTargetSchema,
  type CircleAppointment,
  type CircleTarget,
} from "@/output/api-shapes";

type Status = "loading" | "signed-out" | "ready" | "error";

/** 저장할 약속 초안(검토 UI에서 대상 지정 후). */
export interface AppointmentDraft {
  content: string;
  when_at: string | null;
  source?: string | null;
  target_id: string | null;
}

export interface CircleData {
  status: Status;
  targets: CircleTarget[];
  appointments: CircleAppointment[];
  error: string | null;
  refresh: () => void;
  addTarget: (name: string, color?: string | null) => Promise<CircleTarget | null>;
  updateTarget: (
    id: string,
    patch: { name?: string; color?: string | null },
  ) => Promise<void>;
  removeTarget: (id: string) => Promise<void>;
  /** 검토를 통과한 약속들을 일괄 저장. 저장된 개수를 반환. */
  saveAppointments: (items: AppointmentDraft[]) => Promise<number>;
  updateAppointment: (
    id: string,
    patch: { content?: string; target_id?: string | null; when_at?: string | null },
  ) => Promise<void>;
  removeAppointment: (id: string) => Promise<void>;
}

/** 정렬: 시간이 있는 약속을 시간 오름차순으로 먼저, 없는 약속은 최근 등록순으로 뒤에. */
function sortAppointments(list: CircleAppointment[]): CircleAppointment[] {
  return [...list].sort((a, b) => {
    const aw = a.when_at ? Date.parse(a.when_at) : NaN;
    const bw = b.when_at ? Date.parse(b.when_at) : NaN;
    const aHas = !Number.isNaN(aw);
    const bHas = !Number.isNaN(bw);
    if (aHas && bHas) return aw - bw;
    if (aHas) return -1;
    if (bHas) return 1;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

export function useCircleData(): CircleData {
  const supabase = React.useMemo(() => createClient(), []);
  const [status, setStatus] = React.useState<Status>("loading");
  const [targets, setTargets] = React.useState<CircleTarget[]>([]);
  const [appointments, setAppointments] = React.useState<CircleAppointment[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  // 현재 로그인 사용자 id(쓰기 시 user_id 명시용). 미로그인이면 null.
  const uid = React.useCallback(async (): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  }, [supabase]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setStatus("signed-out");
        return;
      }
      const [tRes, aRes] = await Promise.all([
        supabase
          .from("pb_circle_targets")
          .select("id,user_id,name,email,color,sort_order,created_at")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("pb_circle_appointments")
          .select("id,user_id,target_id,content,when_at,source,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (!alive) return;
      if (tRes.error || aRes.error) {
        setError("데이터를 불러오지 못했습니다.");
        setStatus("error");
        return;
      }
      const t = (tRes.data ?? [])
        .map((r) => CircleTargetSchema.safeParse(r))
        .filter((r) => r.success)
        .map((r) => (r as { data: CircleTarget }).data);
      const a = (aRes.data ?? [])
        .map((r) => CircleAppointmentSchema.safeParse(r))
        .filter((r) => r.success)
        .map((r) => (r as { data: CircleAppointment }).data);
      setTargets(t);
      setAppointments(sortAppointments(a));
      setError(null);
      setStatus("ready");
    })();
    return () => {
      alive = false;
    };
  }, [supabase, nonce]);

  const addTarget = React.useCallback(
    async (name: string, color?: string | null): Promise<CircleTarget | null> => {
      const id = await uid();
      if (!id) return null;
      const clean = name.trim();
      if (!clean) return null;
      const sort = targets.length;
      const { data, error: err } = await supabase
        .from("pb_circle_targets")
        .insert({ user_id: id, name: clean, color: color ?? null, sort_order: sort })
        .select("id,user_id,name,email,color,sort_order,created_at")
        .single();
      if (err || !data) {
        setError("구분을 추가하지 못했습니다.");
        return null;
      }
      const parsed = CircleTargetSchema.safeParse(data);
      refresh();
      return parsed.success ? parsed.data : null;
    },
    [supabase, uid, targets.length, refresh],
  );

  const updateTarget = React.useCallback(
    async (id: string, patch: { name?: string; color?: string | null }) => {
      const next: { name?: string; color?: string | null } = {};
      if (patch.name !== undefined) next.name = patch.name.trim();
      if (patch.color !== undefined) next.color = patch.color;
      if (Object.keys(next).length === 0) return;
      const { error: err } = await supabase
        .from("pb_circle_targets")
        .update(next)
        .eq("id", id);
      if (err) setError("구분을 수정하지 못했습니다.");
      refresh();
    },
    [supabase, refresh],
  );

  const removeTarget = React.useCallback(
    async (id: string) => {
      // 약속의 target_id는 on delete set null → 약속은 '미지정'으로 남는다.
      const { error: err } = await supabase
        .from("pb_circle_targets")
        .delete()
        .eq("id", id);
      if (err) setError("구분을 삭제하지 못했습니다.");
      refresh();
    },
    [supabase, refresh],
  );

  const saveAppointments = React.useCallback(
    async (items: AppointmentDraft[]): Promise<number> => {
      const id = await uid();
      if (!id) return 0;
      const rows = items
        .filter((it) => it.content.trim())
        .map((it) => ({
          user_id: id,
          target_id: it.target_id,
          content: it.content.trim(),
          when_at: it.when_at,
          source: it.source ?? null,
        }));
      if (rows.length === 0) return 0;
      const { data, error: err } = await supabase
        .from("pb_circle_appointments")
        .insert(rows)
        .select("id");
      if (err) {
        setError("약속을 저장하지 못했습니다.");
        return 0;
      }
      refresh();
      return data?.length ?? rows.length;
    },
    [supabase, uid, refresh],
  );

  const updateAppointment = React.useCallback(
    async (
      id: string,
      patch: { content?: string; target_id?: string | null; when_at?: string | null },
    ) => {
      const next: {
        content?: string;
        target_id?: string | null;
        when_at?: string | null;
      } = {};
      if (patch.content !== undefined) next.content = patch.content.trim();
      if (patch.target_id !== undefined) next.target_id = patch.target_id;
      if (patch.when_at !== undefined) next.when_at = patch.when_at;
      if (Object.keys(next).length === 0) return;
      const { error: err } = await supabase
        .from("pb_circle_appointments")
        .update(next)
        .eq("id", id);
      if (err) setError("약속을 수정하지 못했습니다.");
      refresh();
    },
    [supabase, refresh],
  );

  const removeAppointment = React.useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from("pb_circle_appointments")
        .delete()
        .eq("id", id);
      if (err) setError("약속을 삭제하지 못했습니다.");
      refresh();
    },
    [supabase, refresh],
  );

  return {
    status,
    targets,
    appointments,
    error,
    refresh,
    addTarget,
    updateTarget,
    removeTarget,
    saveAppointments,
    updateAppointment,
    removeAppointment,
  };
}

export default useCircleData;
