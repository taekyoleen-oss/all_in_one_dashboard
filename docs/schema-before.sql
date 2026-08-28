-- =============================================================================
-- P0 스냅샷 (PLAN-android-widget.md) — 위젯 백엔드 확장 **이전**의 일정 스키마
-- =============================================================================
-- 작성일: 2026-08-28
-- 출처: supabase/migrations/20260701120001_pb_circle_schedule.sql (append-only
--       마이그레이션 = 적용본과 동일. supabase CLI가 다른 계정 로그인 상태(403,
--       2026-07-11·08-12와 동일)라 라이브 pg_dump 대신 마이그레이션 원본을 기록).
-- 참고: 계획서의 targets/appointments는 이 저장소에서 pb_circle_targets /
--       pb_circle_appointments (pb_ 프리픽스 규칙)에 해당한다.

-- ── 대상(구분) ──────────────────────────────────────────────────────────────
create table if not exists pb_circle_targets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  email      text,          -- 향후 대상별 공유용(현재 UI 미노출·미사용)
  color      text,          -- 배지 색상(선택)
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
alter table pb_circle_targets enable row level security;
create index if not exists pb_circle_targets_user_idx on pb_circle_targets(user_id);

-- ── 약속 ────────────────────────────────────────────────────────────────────
create table if not exists pb_circle_appointments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  target_id  uuid references pb_circle_targets(id) on delete set null,  -- 미지정 허용
  content    text not null,   -- 예: "할머니 생신 가족 모임 (6/28 오후 2시)"
  when_at    timestamptz,     -- 정렬용(없으면 null)
  source     text,            -- 추출 근거 원본(선택)
  created_at timestamptz not null default now()
);
alter table pb_circle_appointments enable row level security;
create index if not exists pb_circle_appointments_user_idx on pb_circle_appointments(user_id);
create index if not exists pb_circle_appointments_target_idx on pb_circle_appointments(target_id);

-- ── 권한 + RLS 정책 ─────────────────────────────────────────────────────────
grant select, insert, update, delete on
  pb_circle_targets, pb_circle_appointments
  to authenticated;

drop policy if exists pb_circle_targets_all on pb_circle_targets;
create policy pb_circle_targets_all on pb_circle_targets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 자식 테이블: 본인 소유 + (대상 미지정이거나) 대상도 본인 소유일 때만 쓰기 허용.
drop policy if exists pb_circle_appointments_all on pb_circle_appointments;
create policy pb_circle_appointments_all on pb_circle_appointments
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      target_id is null
      or exists (
        select 1 from pb_circle_targets t
        where t.id = target_id and t.user_id = auth.uid()
      )
    )
  );
