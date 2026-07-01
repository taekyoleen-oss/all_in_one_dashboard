-- 지인 일정 정리 위젯(circle-schedule) — 대상(구분) + 약속 테이블.
--
--  가드레일 준수: 모든 pb_* 테이블은 RLS(user_id = auth.uid())로 본인만 접근한다.
--  - pb_circle_targets      : 사용자가 미리 만드는 구분(가족·친구 등). email은 향후
--                             '대상별 이메일 공유'용으로 스키마에만 두고 지금은 미사용.
--  - pb_circle_appointments : 한 문장 약속(content, 시간 있으면 문장 뒤 괄호). when_at은
--                             정렬용(없으면 null). target_id로 대상에 귀속(미지정 허용).
--
--  민감정보 금지(설계서): 주민번호·카드번호 전체·계좌 비밀번호 등은 저장하지 않는다.

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
