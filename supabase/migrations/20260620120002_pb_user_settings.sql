-- 002 pb_user_settings (1:1 auth.users)
-- default_dashboard_id FK는 pb_dashboards 생성 후 003에서 추가(순환 회피)

create table if not exists pb_user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  ingest_token         text unique,                          -- per-user 비밀 토큰(발급 전 null)
  theme                text not null default 'dark',
  default_dashboard_id uuid,                                 -- FK는 003에서
  stock_config         jsonb not null default '{}'::jsonb,
  google_connected     boolean not null default false,
  updated_at           timestamptz not null default now()
);

alter table pb_user_settings enable row level security;     -- deny-by-default

drop trigger if exists pb_user_settings_set_updated_at on pb_user_settings;
create trigger pb_user_settings_set_updated_at
  before update on pb_user_settings
  for each row execute function pb_set_updated_at();
