-- 007 RLS 정책 + grants. 모든 pb_*: 소유자 CRUD. 자식 테이블: 부모 소유권 with_check 이중검증(§5.3)
-- 멱등: drop policy if exists 후 재생성

-- authenticated 역할 권한(접근은 RLS가 게이트)
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

-- pb_widgets: 소유 + 부모(dashboard) 소유권 이중검증
drop policy if exists pb_widgets_all on pb_widgets;
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

-- pb_card_transactions: 소유 + 부모(card) 소유권 이중검증
drop policy if exists pb_card_txn_all on pb_card_transactions;
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
