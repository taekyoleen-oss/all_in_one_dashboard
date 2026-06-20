-- =====================================================================
-- rls-verify: PaneBoard 단일 사용자 RLS 격리 증명
-- 실행: psql "$DATABASE_URL" -f isolation-queries.sql
--       또는 Supabase SQL Editor에 붙여넣어 섹션별로 실행.
-- 전제: postgres/service-role로 실행. 격리 테스트는 set local role authenticated로 권한을 낮춰 수행.
-- 모든 데이터 변경은 begin...rollback 안에서만 일어나며 영속되지 않는다.
-- =====================================================================

-- =====================================================================
-- Section 1) 정책 완전성 (read-only) — 항상 실행 가능, 1차 증거
-- =====================================================================

-- 1a. 모든 pb_* 테이블의 RLS on 여부  (expect: rowsecurity = t, 5건)
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'pb\_%'
order by tablename;

-- 1b. pb_* 정책 목록 + with_check 존재  (expect: 각 테이블 정책 >=1, 쓰기 정책 has_check = t)
select tablename, policyname, cmd,
       (qual is not null)       as has_using,
       (with_check is not null) as has_check
from pg_policies
where schemaname = 'public' and tablename like 'pb\_%'
order by tablename, policyname;

-- 1c. RLS off 이거나 정책이 전혀 없는 pb_*  (expect: 0건)
select t.tablename, t.rowsecurity, count(p.policyname) as n_policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.tablename like 'pb\_%'
group by t.tablename, t.rowsecurity
having t.rowsecurity = false or count(p.policyname) = 0;

-- =====================================================================
-- Section 2) 격리 증명 — 실제 사용자 1명 이상 필요(로그인 후 실행)
--   uid A = 기존 실제 사용자, uid B = 미가입 임의 uuid 가장
-- =====================================================================

select set_config('myapp.uid_a',
       coalesce((select id::text from auth.users order by created_at limit 1), ''), false) as uid_a;
select set_config('myapp.uid_b', '00000000-0000-0000-0000-0000000000b0', false) as uid_b;
-- uid_a 가 빈 문자열이면 아직 사용자가 없는 것 → 앱에 1회 로그인 후 재실행.

begin;
  -- A 소유 dashboard 1건 삽입 (postgres 권한, RLS 우회)
  insert into pb_dashboards (id, user_id, name, is_default)
  values ('00000000-0000-0000-0000-0000000000a1',
          current_setting('myapp.uid_a')::uuid, 'rls-test-A', false);

  -- B로 가장 + 권한 강등(RLS 적용)
  select set_config('request.jwt.claims',
         json_build_object('sub', current_setting('myapp.uid_b'))::text, true);
  set local role authenticated;

  -- (i) B에게 A의 dashboard가 보이면 안 됨  (expect: 0)
  select count(*) as a_rows_visible_to_b
  from pb_dashboards
  where id = '00000000-0000-0000-0000-0000000000a1';

  reset role;
rollback;

-- (ii) 쓰기 격리: B가 A의 dashboard에 위젯 삽입 시 with_check 위반으로 실패해야 함.
--      아래를 별도로 실행하라(에러가 나면 PASS). begin...rollback 안에서:
--   begin;
--     select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000b0')::text, true);
--     set local role authenticated;
--     insert into pb_widgets (dashboard_id, user_id, type)
--     values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b0','memo');
--     -- expect: ERROR (new row violates row-level security policy)
--     reset role;
--   rollback;

-- =====================================================================
-- Section 3) 불변식 위반 — 모두 거부되어야 PASS (begin...rollback, 영속 안 함)
--   결과는 NOTICE로 PASS/FAIL 출력.
-- =====================================================================

begin;
  -- 전제: A 소유 카드 1건(중복 테스트 부모)
  insert into pb_cards (id, user_id, nickname, last4)
  values ('00000000-0000-0000-0000-0000000000c1',
          current_setting('myapp.uid_a')::uuid, 'rls-test-card', '4242');

  -- 3a. single-default: 같은 user에 is_default=true 둘 → unique 위반
  do $$
  begin
    begin
      insert into pb_dashboards (user_id, name, is_default)
        values (current_setting('myapp.uid_a')::uuid, 'def1', true);
      insert into pb_dashboards (user_id, name, is_default)
        values (current_setting('myapp.uid_a')::uuid, 'def2', true);
      raise notice '3a single-default: FAIL (second default allowed)';
    exception when unique_violation then
      raise notice '3a single-default: PASS';
    end;
  end $$;

  -- 3b. raw_hash dedupe: 동일 (user_id, raw_hash) 둘 → unique 위반
  do $$
  begin
    begin
      insert into pb_card_transactions (card_id, user_id, txn_date, amount, source, raw_hash)
        values ('00000000-0000-0000-0000-0000000000c1', current_setting('myapp.uid_a')::uuid, current_date, 1000, 'manual', 'hash-x');
      insert into pb_card_transactions (card_id, user_id, txn_date, amount, source, raw_hash)
        values ('00000000-0000-0000-0000-0000000000c1', current_setting('myapp.uid_a')::uuid, current_date, 1000, 'manual', 'hash-x');
      raise notice '3b raw_hash dedupe: FAIL (duplicate allowed)';
    exception when unique_violation then
      raise notice '3b raw_hash dedupe: PASS';
    end;
  end $$;

  -- 3c. last4 check: 5자리 → check 위반
  do $$
  begin
    begin
      insert into pb_cards (user_id, nickname, last4)
        values (current_setting('myapp.uid_a')::uuid, 'bad', '12345');
      raise notice '3c last4 check: FAIL (5 digits allowed)';
    exception when check_violation then
      raise notice '3c last4 check: PASS';
    end;
  end $$;
rollback;

-- 판정: Section1 = (1a 5건 t, 1c 0건), Section2(i) = 0, Section3 = 3a/3b/3c 모두 PASS → 통과.
