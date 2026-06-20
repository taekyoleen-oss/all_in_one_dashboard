# Phase 1 QA 리포트 — DB 보안/불변식 게이트

생성: rls_check.cjs (카탈로그 기반, 로그인 불필요)

## RLS 상태
- pb_card_transactions: rowsecurity=true
- pb_cards: rowsecurity=true
- pb_dashboards: rowsecurity=true
- pb_user_settings: rowsecurity=true
- pb_widgets: rowsecurity=true

## 정책 (pb_*)
- pb_card_transactions.pb_card_txn_all [ALL] using=true check=true
- pb_cards.pb_cards_all [ALL] using=true check=true
- pb_dashboards.pb_dashboards_all [ALL] using=true check=true
- pb_user_settings.pb_user_settings_all [ALL] using=true check=true
- pb_widgets.pb_widgets_all [ALL] using=true check=true

## 게이트 판정
- PASS — RLS on (5 테이블)
- PASS — 각 테이블 with_check 정책
- PASS — pb_widgets 부모검증(exists+auth.uid)
- PASS — pb_card_transactions 부모검증(exists+auth.uid)
- PASS — single-default 부분유니크 인덱스
- PASS — raw_hash (user_id) 유니크
- PASS — last4 체크 제약
- PASS — user_id → auth.users FK (전 테이블)
- PASS — pb-images 버킷 비공개
- PASS — storage 경로 prefix 정책

## 결과: ✅ 전체 통과 (Phase 1 게이트 OPEN)

> 행동형 격리/위반 insert 테스트(타 uid 차단, 불변식 위반 거부)는 첫 로그인 후 `.claude/skills/rls-verify/references/isolation-queries.sql`로 수행한다(auth.users에 실제 사용자 필요).