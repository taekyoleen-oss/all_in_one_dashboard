---
name: supabase-schema
description: "PaneBoard Supabase 스키마·RLS·Storage·마이그레이션·타입생성 작업 시 반드시 사용. pb_* 테이블 생성, RLS 정책(부모 소유권 이중검증 포함), pb-images 버킷, supabase db push, gen types를 다룬다. 후속: 스키마 수정/컬럼 추가/RLS 보완/마이그레이션 재실행/타입 재생성 시에도 사용. 원시 CLI 절차는 전역 supabase-sync 스킬을 따른다."
---

# supabase-schema — pb_* 스키마·RLS·마이그레이션

db-architect가 설계서 §5를 멱등 마이그레이션으로 변환·적용하는 절차적 가이드. 원시 CLI 명령(`migration new`/`db push`/`gen types`)은 전역 `supabase-sync` 스킬을 재사용하고, 여기서는 **PaneBoard 고유의 스키마·RLS·불변식**을 다룬다.

## 마이그레이션 순서 (멱등·append-only)
이미 push된 파일은 편집하지 않고 새 번호 파일을 추가한다.

| # | 파일 | 내용 |
|---|------|------|
| 001 | `extensions_and_helpers` | `create extension if not exists pgcrypto`; `pb_set_updated_at()` 트리거 함수 |
| 002 | `pb_user_settings` | 1:1, `ingest_token` 등. `default_dashboard_id` FK는 003 이후 `alter table`로 추가(순환 회피) |
| 003 | `pb_dashboards` | + single-default 부분 유니크 인덱스 |
| 004 | `pb_widgets` | `config`/`layout` jsonb, `user_id` 비정규화(RLS 부모검증용) |
| 005 | `pb_cards` | `last4` 체크(`^[0-9]{4}$`) — 전체 PAN 저장 구조적 불가 |
| 006 | `pb_card_transactions` | `unique (user_id, raw_hash)` 중복 차단, `source` text |
| 007 | `rls_policies` | 5테이블 정책(소유자 CRUD + 부모 이중검증) |
| 008 | `storage_pb_images` | 비공개 버킷 + 경로 prefix RLS |

> **deny-by-default**: 각 테이블 생성 마이그레이션 안에서 `create table` 직후 `alter table ... enable row level security`를 켠다. 정책 본체는 007에 모은다.

## 불변식은 DB에서 강제
- single-default: `create unique index if not exists pb_dashboards_one_default on pb_dashboards(user_id) where is_default;`
- dedupe: `unique (user_id, raw_hash)` — `raw_hash`=일시+금액+가맹점 해시.
- last4: `check (last4 ~ '^[0-9]{4}$')`.
- updated_at: `before update` 트리거로 `pb_set_updated_at()`.

## RLS 패턴
모든 `pb_*`는 소유자 CRUD, 자식 테이블은 부모 소유권 이중검증. 정확한 정책 SQL은 `references/rls-patterns.md` 참조.

## 적용 & 타입
1. `supabase link --project-ref <ref>` (1회)
2. `supabase db push` → `supabase migration list`로 적용 확인
3. `supabase gen types typescript --project-id <ref> > output/types/database.ts`
4. 적용본을 `output/schema.sql`에 미러(감사용, 재적용하지 않음)

> 라이브 적용 대상 프로젝트 ref는 **반드시 사용자에게 확정**받는다(되돌리기 어려운 작업). 잘못된 프로젝트에 pb_* 적용 금지.

## 검증
적용 후 `rls-verify` 스킬로 RLS 격리·`pg_policies` 완전성·불변식 위반을 증명한 뒤 완료로 본다.
