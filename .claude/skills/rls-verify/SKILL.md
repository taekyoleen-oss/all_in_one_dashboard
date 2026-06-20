---
name: rls-verify
description: "Supabase RLS 격리를 단일 사용자 환경에서 증명할 때 반드시 사용. 강제 uid(SET LOCAL request.jwt.claims) 교체로 타 사용자 데이터 차단을 증명하고, pg_policies/rowsecurity 완전성과 불변식(single-default, raw_hash 중복, last4)을 점검한다. 후속: RLS 재검증/정책 추가 후 재확인/격리 회귀 점검 시에도 사용. db-architect와 qa가 공용."
---

# rls-verify — 단일 사용자 RLS 격리 증명

두 번째 사용자를 만들지 않고도 RLS가 실제로 격리함을 증명하는 절차. PaneBoard는 본인 전용(1인)이라 통상적인 "다른 계정으로 접근" 테스트가 불가하므로, **세션 GUC를 강제로 교체**해 다른 uid를 시뮬레이션한다.

## 왜 이 방식인가
RLS 정책은 `auth.uid()`에 의존한다. Postgres에서 `auth.uid()`는 `request.jwt.claims`의 `sub`를 읽는다. 트랜잭션 안에서 `set local role authenticated; set local request.jwt.claims = '{"sub":"<UID>"}'`로 임의 사용자를 가장하면, 실제 가입 없이 격리를 검증할 수 있다.

## 절차
1. **정책 완전성**: 모든 `pb_*` 테이블이 `rowsecurity = true`이고 쓰기 정책에 `with_check`가 있는지 `pg_policies`·`pg_tables`로 확인.
2. **격리 증명**: 실제 데이터를 소유한 uid A로 1행 삽입 → 트랜잭션에서 uid B로 가장 → `select`가 0행, uid B로 A의 dashboard에 자식 삽입 시 `with check` 위반으로 실패하는지 확인.
3. **불변식 위반**: 두 번째 `is_default=true`(유니크 위반), 중복 `(user_id, raw_hash)`(유니크 위반), `last4='12345'`(체크 위반)이 모두 거부되는지 확인.

실행 쿼리 전문은 `references/isolation-queries.sql`을 그대로 사용(psql 또는 Supabase SQL Editor). 출력에서 기대값과 다른 행이 나오면 **실패**로 보고하고 db-architect가 새 마이그레이션으로 수정한다.

## 적용 방법
- psql 연결 가능 시: `psql "$DATABASE_URL" -f .claude/skills/rls-verify/references/isolation-queries.sql`
- 아니면 Supabase SQL Editor에 붙여넣어 섹션별 실행.
- service-role 연결로 실행하면 RLS가 우회되므로, 격리 테스트 섹션은 반드시 `set local role authenticated`로 권한을 낮춘 뒤 수행한다.

## 판정
- 섹션 1: RLS off이거나 `with_check` 없는 `pb_*`가 0건 → 통과.
- 섹션 2: uid B의 select 0행 + 자식 삽입 실패 → 통과.
- 섹션 3: 세 위반 모두 에러 → 통과.
세 섹션 모두 통과해야 Phase 1 체크포인트 게이트를 연다.
