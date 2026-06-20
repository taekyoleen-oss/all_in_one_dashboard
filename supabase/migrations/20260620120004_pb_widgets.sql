-- 004 pb_widgets (위젯 인스턴스). config + layout(jsonb). user_id 비정규화(RLS 부모검증용)

create table if not exists pb_widgets (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references pb_dashboards(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,                          -- 15종 type 키 (registry와 일치)
  config       jsonb not null default '{}'::jsonb,
  layout       jsonb not null default '{}'::jsonb,     -- 데스크톱 x,y,w,h,minW/minH/maxW/maxH (모바일 미저장)
  updated_at   timestamptz not null default now()
);

alter table pb_widgets enable row level security;

create index if not exists pb_widgets_dashboard_idx on pb_widgets(dashboard_id);
create index if not exists pb_widgets_user_idx on pb_widgets(user_id);

drop trigger if exists pb_widgets_set_updated_at on pb_widgets;
create trigger pb_widgets_set_updated_at
  before update on pb_widgets
  for each row execute function pb_set_updated_at();
