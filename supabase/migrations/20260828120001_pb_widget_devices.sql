-- 안드로이드 홈 화면 위젯 백엔드 (PLAN-android-widget.md P1) — 일정 상태 + 디바이스 토큰.
--
--  - pb_circle_appointments.status/completed_at/snooze_until : 위젯에서의 완료/연기.
--  - pb_widget_devices       : 위젯 디바이스 토큰. 원문은 저장하지 않고 SHA-256 해시만.
--  - pb_widget_pairing_codes : 1회용 6자리 페어링 코드(해시 저장, 5분 만료, 1인 1코드).
--
--  RLS:
--  - devices는 본인 select/delete만 클라이언트 허용(설정 UI의 목록·폐기).
--    발급(insert)은 서버 service-role 전용이라 정책을 두지 않는다.
--  - pairing_codes는 정책 없음(deny-by-default) = service-role 전용 — pb_members 패턴.

-- ── 일정 상태 컬럼 (기존 컬럼 무변경, add only) ────────────────────────────
alter table pb_circle_appointments
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'done', 'snoozed')),
  add column if not exists completed_at timestamptz,
  add column if not exists snooze_until timestamptz;

-- ── 위젯 디바이스 토큰 ──────────────────────────────────────────────────────
create table if not exists pb_widget_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token_hash   text not null unique,        -- sha256(token) — 토큰 원문 미저장
  label        text,                        -- 예: "갤럭시 S24"
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz                  -- soft-revoke 여지(현재 UI는 행 삭제=폐기)
);
alter table pb_widget_devices enable row level security;
create index if not exists pb_widget_devices_user_idx
  on pb_widget_devices(user_id) where revoked_at is null;

-- ── 1회용 페어링 코드 ───────────────────────────────────────────────────────
create table if not exists pb_widget_pairing_codes (
  code_hash   text primary key,             -- sha256(6자리 코드)
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz
);
alter table pb_widget_pairing_codes enable row level security;

-- ── 권한 + RLS 정책 ─────────────────────────────────────────────────────────
grant select, delete on pb_widget_devices to authenticated;

drop policy if exists pb_widget_devices_select_own on pb_widget_devices;
create policy pb_widget_devices_select_own on pb_widget_devices
  for select using (auth.uid() = user_id);

drop policy if exists pb_widget_devices_delete_own on pb_widget_devices;
create policy pb_widget_devices_delete_own on pb_widget_devices
  for delete using (auth.uid() = user_id);

-- pb_widget_pairing_codes: 정책 없음(deny-by-default) — service-role 경로로만 접근.
