-- 003 pb_dashboards (보드/탭) + single-default 보장 + 지연 FK 연결

create table if not exists pb_dashboards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table pb_dashboards enable row level security;

-- 사용자당 기본 보드 <=1개 (부분 유니크 인덱스)
create unique index if not exists pb_dashboards_one_default
  on pb_dashboards(user_id) where is_default;
create index if not exists pb_dashboards_user_idx on pb_dashboards(user_id);

drop trigger if exists pb_dashboards_set_updated_at on pb_dashboards;
create trigger pb_dashboards_set_updated_at
  before update on pb_dashboards
  for each row execute function pb_set_updated_at();

-- pb_dashboards 존재 후 pb_user_settings.default_dashboard_id FK 연결
alter table pb_user_settings
  drop constraint if exists pb_user_settings_default_dashboard_fk;
alter table pb_user_settings
  add constraint pb_user_settings_default_dashboard_fk
  foreign key (default_dashboard_id) references pb_dashboards(id) on delete set null;
