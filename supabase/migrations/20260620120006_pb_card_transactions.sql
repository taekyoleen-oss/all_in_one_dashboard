-- 006 pb_card_transactions (카드 거래: CSV/인제스트/수기). raw_hash로 중복 차단(§5.4)

create table if not exists pb_card_transactions (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references pb_cards(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,  -- 부모검증용 비정규화
  txn_date  date not null,
  merchant  text,
  amount    numeric(14,2) not null,
  category  text,
  source    text not null,                              -- 'csv' | 'sms' | 'email' | 'manual'
  raw_hash  text not null,                              -- 일시+금액+가맹점 해시
  unique (user_id, raw_hash)                            -- CSV/인제스트 중복 차단
);

alter table pb_card_transactions enable row level security;

create index if not exists pb_card_txn_card_date_idx on pb_card_transactions(card_id, txn_date);
