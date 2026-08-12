-- 009 pb_members: 관리자 승인 기반 접근 허용 목록 (소규모 공유 대시보드)
--
--  ALLOWED_EMAIL(= 관리자/소유자)은 env에 그대로 남겨 **부트스트랩**을 보장한다.
--  표가 비어 있어도 관리자는 항상 들어올 수 있고, 재배포 없이 여기에 승인만 쌓으면
--  다른 사용자가 사용할 수 있다.
--
--  왜 email이 PK인가: 승인은 auth.users 행이 만들어지기 **전에** 일어난다.
--  (요청 → 관리자 승인 → 그때 비로소 계정 생성. 미승인자는 auth 계정 자체가 없다.)
--
--  RLS: enable하되 **정책을 만들지 않는다** = anon/authenticated 전면 차단
--  (deny-by-default). 읽기·쓰기는 서버의 service-role 경로(lib/auth/members.ts)로만.

create table if not exists pb_members (
  email        text primary key check (email = lower(email) and email <> ''),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'blocked')),
  note         text,
  requested_at timestamptz not null default now(),
  decided_at   timestamptz
);

alter table pb_members enable row level security;
