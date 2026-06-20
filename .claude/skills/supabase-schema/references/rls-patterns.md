# PaneBoard RLS 정책 패턴

설계서 §5.3 기준. 모든 `pb_*`는 소유자 CRUD, 자식 테이블(`pb_widgets`, `pb_card_transactions`)은 부모 소유권을 `with check`로 이중검증한다. 정책은 `drop policy if exists` 후 재생성(멱등).

## 소유자 CRUD (pb_user_settings, pb_dashboards, pb_cards)
```sql
alter table pb_dashboards enable row level security;

drop policy if exists pb_dashboards_select on pb_dashboards;
create policy pb_dashboards_select on pb_dashboards
  for select using (auth.uid() = user_id);

drop policy if exists pb_dashboards_modify on pb_dashboards;
create policy pb_dashboards_modify on pb_dashboards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
> `pb_user_settings`는 PK가 `user_id`이므로 동일 패턴에서 `user_id`를 PK로 사용.

## 자식: 부모 소유권 이중검증
**pb_widgets** (부모 = pb_dashboards):
```sql
drop policy if exists pb_widgets_modify on pb_widgets;
create policy pb_widgets_modify on pb_widgets
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from pb_dashboards d
      where d.id = dashboard_id and d.user_id = auth.uid()
    )
  );
```
**pb_card_transactions** (부모 = pb_cards):
```sql
drop policy if exists pb_card_txn_modify on pb_card_transactions;
create policy pb_card_txn_modify on pb_card_transactions
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from pb_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  );
```
> select 정책은 `using (auth.uid() = user_id)`로 충분(부모검증은 쓰기 경로의 위조 방지가 핵심).

## 인제스트 경로
`/api/cards/ingest`는 세션이 아니라 `pb_user_settings.ingest_token` 매칭 후 **service-role**로 기록한다(RLS 우회). 따라서 별도 정책이 아니라, service-role insert 시 **명시적 `user_id`**를 항상 지정해 탈취된 토큰이 해당 user에만 기록되도록 한다(api-designer 책임).

## Storage `pb-images` (storage.objects)
경로 `{user_id}/{instance_id}/{file}`, prefix 일치 격리:
```sql
drop policy if exists pb_images_rw on storage.objects;
create policy pb_images_rw on storage.objects
  for all
  using (bucket_id = 'pb-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pb-images' and (storage.foldername(name))[1] = auth.uid()::text);
```
버킷은 비공개. 클라이언트는 서버 발급 **서명 URL**로만 접근.
