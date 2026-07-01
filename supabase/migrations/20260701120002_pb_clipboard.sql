-- 클립보드 기록을 기기 간 동기화(요구): 기존 localStorage(기기 전용) → Supabase 테이블.
--
--  같은 계정으로 모바일·PC에서 로그인하면 같은 위젯 인스턴스(instance_id = pb_widgets.id,
--  기기 무관 동일)의 기록을 공유한다. `device`로 어느 기기에서 복사됐는지 구분(뷰에서 색 표시).
--  RLS로 본인만 접근하고, 실시간(supabase_realtime)으로 기기 간 즉시 반영한다.
--
--  ⚠ 참고: 클립보드 텍스트가 서버에 저장된다(전엔 기기 로컬 유지였음 — 사용자 요청으로 변경).
--     RLS로 보호되지만 비밀번호 등 민감값 복사는 주의.

create table if not exists pb_clipboard (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  instance_id text not null,   -- 위젯 인스턴스 id(pb_widgets.id) — 기기 간 동일
  text        text not null,
  device      text not null default 'pc' check (device in ('mobile', 'pc')),
  created_at  timestamptz not null default now()
);
alter table pb_clipboard enable row level security;
create index if not exists pb_clipboard_user_instance_idx
  on pb_clipboard(user_id, instance_id, created_at desc);

grant select, insert, update, delete on pb_clipboard to authenticated;

drop policy if exists pb_clipboard_all on pb_clipboard;
create policy pb_clipboard_all on pb_clipboard
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 실시간 DELETE 이벤트에 instance_id가 포함되도록(클라이언트 필터용) 전체 old-row 게시.
alter table pb_clipboard replica identity full;

-- supabase_realtime 퍼블리케이션에 테이블 추가(이미 있으면 건너뜀 — 멱등).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pb_clipboard'
  ) then
    alter publication supabase_realtime add table pb_clipboard;
  end if;
end $$;
