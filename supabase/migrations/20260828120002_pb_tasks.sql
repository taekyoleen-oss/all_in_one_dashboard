-- 작업(tasks) 위젯 — 웹 캔버스 ↔ 안드로이드 홈 화면 위젯 양방향 동기화 저장소.
--
--  config(jsonb)가 아닌 행 기반 테이블인 이유: 안드로이드(디바이스 토큰, service-role
--  경유)와 웹(세션, RLS)이 **동시에 쓰기** 때문 — config 통저장은 디바운스 저장이
--  상대 쪽 추가분을 되덮는다. 행 단위 insert/delete/update는 충돌이 없다.
--
--  instance_id = pb_widgets.id(text, pb_clipboard 선례) — 작업 위젯 인스턴스마다
--  독립 목록. 모바일에 어느 목록을 보일지는 위젯 config의 mobileSync/mobileSyncAt
--  플래그로 지정한다(서버가 최근 켠 인스턴스 1개를 해석).
--  realtime: 안드로이드에서 추가/삭제 시 웹 위젯이 즉시 갱신(pb_clipboard 패턴).

create table if not exists pb_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  instance_id text not null,   -- 위젯 인스턴스 id(pb_widgets.id) — 기기 간 동일
  title       text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table pb_tasks enable row level security;
create index if not exists pb_tasks_user_instance_idx
  on pb_tasks(user_id, instance_id, created_at);

grant select, insert, update, delete on pb_tasks to authenticated;

drop policy if exists pb_tasks_all on pb_tasks;
create policy pb_tasks_all on pb_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 실시간 DELETE 이벤트에 instance_id가 포함되도록(클라이언트 필터용) 전체 old-row 게시.
alter table pb_tasks replica identity full;

-- supabase_realtime 퍼블리케이션에 테이블 추가(이미 있으면 건너뜀 — 멱등).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pb_tasks'
  ) then
    alter publication supabase_realtime add table pb_tasks;
  end if;
end $$;
