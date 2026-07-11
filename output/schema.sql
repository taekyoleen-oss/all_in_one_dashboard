-- output/schema.sql - applied migrations mirror (audit only; do NOT re-apply)
-- source: supabase/migrations/  target: all_in_one_board (nsedndrdykeujribqyqx)

-- ========== 20260620120001_extensions_and_helpers.sql ==========
-- 001 extensions + helper trigger function
-- 硫깅벑: ?ъ떎???덉쟾

create extension if not exists pgcrypto;  -- gen_random_uuid()

create or replace function pb_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========== 20260620120002_pb_user_settings.sql ==========
-- 002 pb_user_settings (1:1 auth.users)
-- default_dashboard_id FK??pb_dashboards ?앹꽦 ??003?먯꽌 異붽?(?쒗솚 ?뚰뵾)

create table if not exists pb_user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  ingest_token         text unique,                          -- per-user 鍮꾨? ?좏겙(諛쒓툒 ??null)
  theme                text not null default 'dark',
  default_dashboard_id uuid,                                 -- FK??003?먯꽌
  stock_config         jsonb not null default '{}'::jsonb,
  google_connected     boolean not null default false,
  updated_at           timestamptz not null default now()
);

alter table pb_user_settings enable row level security;     -- deny-by-default

drop trigger if exists pb_user_settings_set_updated_at on pb_user_settings;
create trigger pb_user_settings_set_updated_at
  before update on pb_user_settings
  for each row execute function pb_set_updated_at();

-- ========== 20260620120003_pb_dashboards.sql ==========
-- 003 pb_dashboards (蹂대뱶/?? + single-default 蹂댁옣 + 吏??FK ?곌껐

create table if not exists pb_dashboards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  is_default boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table pb_dashboards enable row level security;

-- ?ъ슜?먮떦 湲곕낯 蹂대뱶 <=1媛?(遺遺??좊땲???몃뜳??
create unique index if not exists pb_dashboards_one_default
  on pb_dashboards(user_id) where is_default;
create index if not exists pb_dashboards_user_idx on pb_dashboards(user_id);

drop trigger if exists pb_dashboards_set_updated_at on pb_dashboards;
create trigger pb_dashboards_set_updated_at
  before update on pb_dashboards
  for each row execute function pb_set_updated_at();

-- pb_dashboards 議댁옱 ??pb_user_settings.default_dashboard_id FK ?곌껐
alter table pb_user_settings
  drop constraint if exists pb_user_settings_default_dashboard_fk;
alter table pb_user_settings
  add constraint pb_user_settings_default_dashboard_fk
  foreign key (default_dashboard_id) references pb_dashboards(id) on delete set null;

-- ========== 20260620120004_pb_widgets.sql ==========
-- 004 pb_widgets (?꾩젽 ?몄뒪?댁뒪). config + layout(jsonb). user_id 鍮꾩젙洹쒗솕(RLS 遺紐④?利앹슜)

create table if not exists pb_widgets (
  id           uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references pb_dashboards(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null,                          -- 15醫?type ??(registry? ?쇱튂)
  config       jsonb not null default '{}'::jsonb,
  layout       jsonb not null default '{}'::jsonb,     -- ?곗뒪?ы넲 x,y,w,h,minW/minH/maxW/maxH (紐⑤컮??誘몄???
  updated_at   timestamptz not null default now()
);

alter table pb_widgets enable row level security;

create index if not exists pb_widgets_dashboard_idx on pb_widgets(dashboard_id);
create index if not exists pb_widgets_user_idx on pb_widgets(user_id);

drop trigger if exists pb_widgets_set_updated_at on pb_widgets;
create trigger pb_widgets_set_updated_at
  before update on pb_widgets
  for each row execute function pb_set_updated_at();

-- ========== 20260620120005_pb_cards.sql ==========
-- 005 pb_cards (移대뱶 留덉뒪??. ??4?먮━留????꾩껜 移대뱶踰덊샇 ???援ъ“??遺덇?(짠5.2)

create table if not exists pb_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nickname    text not null,
  last4       text check (last4 ~ '^[0-9]{4}$'),       -- ?뺥솗??4?먮━ ?レ옄留??덉슜
  issuer      text,
  billing_day int check (billing_day between 1 and 31),
  color       text
);

alter table pb_cards enable row level security;

create index if not exists pb_cards_user_idx on pb_cards(user_id);

-- ========== 20260620120006_pb_card_transactions.sql ==========
-- 006 pb_card_transactions (移대뱶 嫄곕옒: CSV/?몄젣?ㅽ듃/?섍린). raw_hash濡?以묐났 李⑤떒(짠5.4)

create table if not exists pb_card_transactions (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references pb_cards(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,  -- 遺紐④?利앹슜 鍮꾩젙洹쒗솕
  txn_date  date not null,
  merchant  text,
  amount    numeric(14,2) not null,
  category  text,
  source    text not null,                              -- 'csv' | 'sms' | 'email' | 'manual'
  raw_hash  text not null,                              -- ?쇱떆+湲덉븸+媛留뱀젏 ?댁떆
  unique (user_id, raw_hash)                            -- CSV/?몄젣?ㅽ듃 以묐났 李⑤떒
);

alter table pb_card_transactions enable row level security;

create index if not exists pb_card_txn_card_date_idx on pb_card_transactions(card_id, txn_date);

-- ========== 20260620120007_rls_policies.sql ==========
-- 007 RLS ?뺤콉 + grants. 紐⑤뱺 pb_*: ?뚯쑀??CRUD. ?먯떇 ?뚯씠釉? 遺紐??뚯쑀沅?with_check ?댁쨷寃利?짠5.3)
-- 硫깅벑: drop policy if exists ???ъ깮??
-- authenticated ??븷 沅뚰븳(?묎렐? RLS媛 寃뚯씠??
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  pb_user_settings, pb_dashboards, pb_widgets, pb_cards, pb_card_transactions
  to authenticated;

-- pb_user_settings (user_id = PK)
drop policy if exists pb_user_settings_all on pb_user_settings;
create policy pb_user_settings_all on pb_user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pb_dashboards
drop policy if exists pb_dashboards_all on pb_dashboards;
create policy pb_dashboards_all on pb_dashboards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pb_cards
drop policy if exists pb_cards_all on pb_cards;
create policy pb_cards_all on pb_cards
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pb_widgets: ?뚯쑀 + 遺紐?dashboard) ?뚯쑀沅??댁쨷寃利?drop policy if exists pb_widgets_all on pb_widgets;
create policy pb_widgets_all on pb_widgets
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from pb_dashboards d
      where d.id = dashboard_id and d.user_id = auth.uid()
    )
  );

-- pb_card_transactions: ?뚯쑀 + 遺紐?card) ?뚯쑀沅??댁쨷寃利?drop policy if exists pb_card_txn_all on pb_card_transactions;
create policy pb_card_txn_all on pb_card_transactions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from pb_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  );

-- ========== 20260620120008_storage_pb_images.sql ==========
-- 008 Storage: pb-images 鍮꾧났媛?踰꾪궥 + 寃쎈줈 prefix 寃⑸━(짠5.2/짠5.3)
-- 寃쎈줈: {user_id}/{instance_id}/{file}. ?대씪?댁뼵?몃뒗 ?쒕챸 URL濡쒕쭔 ?묎렐.

insert into storage.buckets (id, name, public)
values ('pb-images', 'pb-images', false)
on conflict (id) do nothing;

-- storage.objects??Supabase媛 RLS瑜??대? ?쒖꽦?? 踰꾪궥 + 寃쎈줈 1踰덉㎏ ?멸렇癒쇳듃 = uid ?쇱튂 ?쒕쭔 ?덉슜.
drop policy if exists pb_images_rw on storage.objects;
create policy pb_images_rw on storage.objects
  for all
  using (
    bucket_id = 'pb-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'pb-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ========== 20260711120001_pb_clipboard_fav.sql ==========
-- 클립보드 즐겨찾기: 즐겨찾기 항목은 목록 맨 위 고정 + 파란색 강조(2단계 큰 글씨·bold).
-- fav는 기록처럼 기기 간 동기화 — pb_clipboard 컬럼(RLS는 기존 테이블 정책 그대로).

alter table pb_clipboard
  add column if not exists fav boolean not null default false;
