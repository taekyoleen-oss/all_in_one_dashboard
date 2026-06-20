-- 005 pb_cards (카드 마스터). 끝 4자리만 — 전체 카드번호 저장 구조적 불가(§5.2)

create table if not exists pb_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nickname    text not null,
  last4       text check (last4 ~ '^[0-9]{4}$'),       -- 정확히 4자리 숫자만 허용
  issuer      text,
  billing_day int check (billing_day between 1 and 31),
  color       text
);

alter table pb_cards enable row level security;

create index if not exists pb_cards_user_idx on pb_cards(user_id);
