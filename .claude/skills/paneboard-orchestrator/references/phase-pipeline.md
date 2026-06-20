# PaneBoard 빌드 파이프라인 상세

오케스트레이터가 Phase별 팀을 재구성하며 진행하는 4단계 파이프라인의 상세. 각 Phase는 독립된 팀(빌더 + qa)으로 실행하고, 산출물을 `output/`에 동결한 뒤 TeamDelete한다.

## 목차
1. Phase 1 — db-architect
2. Phase 2 — ui-builder
3. Phase 3 — api-designer
4. Phase 4 — widget-engineer
5. 팀 재구성 규칙

---

## Phase 1 — db-architect (+ qa)
- **입력**: 설계서 §5, 실 Supabase 프로젝트(link 대상 ref).
- **작업**: 마이그레이션 001~008 작성 → `db push` 라이브 적용 → `gen types`. (`supabase-schema` 스킬)
- **qa 게이트**: `rls-verify`로 경계쌍 #8(RLS↔강제uid 격리) + 불변식 위반 테스트.
- **산출**: `output/schema.sql`, `output/types/database.ts`, `output/db-handoff.md`.
- **경계**: qa verdict 통과 → TeamDelete. types는 P2~P4의 공통 입력.

## Phase 2 — ui-builder (+ qa)
- **입력**: `output/types/database.ts`(`pb_widgets.layout`), 설계서 §6.1–6.3/§8, `docs/references/rgl-guide.md`.
- **작업**: GridCanvas(RGL)·WidgetFrame(@container)·FocusOverlay·Palette·BoardTabs·Toolbar·useBackStack·TweakCN 토큰. (`tweakcn-theme` 스킬)
- **qa 게이트**: 경계쌍 #5(라우트그룹↔href), #7(layout↔RGL). 백스택은 **사람 검증 필수** 항목으로 표시.
- **산출**: `components/canvas/*`, `output/contract.ts`(동결).
- **경계**: 컨트랙트 동결 통지 → TeamDelete. contract는 P4 입력.

## Phase 3 — api-designer (+ qa)
- **입력**: `output/types/database.ts` + `output/db-handoff.md`, 설계서 §6.4/§6.5, `docs/references/kis-api.md`·`kma-api.md`, `docs/domain/card-formats.md`.
- **작업**: `/api/stocks/{route,stream}`(KIS→SSE), `/api/{weather,fx,news,calendar}` 프록시, `/api/cards/{import,ingest}`, `lib/api/**` 파서·클라이언트. (런타임 클라이언트는 스킬 아닌 앱 코드)
- **qa 게이트**: 경계쌍 #1(SSE↔stock훅), #2(인제스트행↔스키마). KIS/Google 라이브 스모크는 키 준비 후 별도.
- **산출**: `app/api/**`, `lib/api/**`, `output/api-shapes.ts`(동결).
- **경계**: api-shapes 동결 → TeamDelete. api-shapes는 P4 입력.

## Phase 4 — widget-engineer (+ qa)
- **입력**: `output/contract.ts`, `output/api-shapes.ts`, `output/types/database.ts`, 설계서 §2.
- **작업**: 위젯 15종(Compact/Expanded/Config) + `registry.ts`. **핵심 9종 먼저, 확장 6종 이후.** (`widget-scaffold` 스킬)
- **qa 게이트**: **위젯별 incremental** — #1(stock), #3(card-usage 집계), #4(fx/weather/news), #6(컨트랙트↔registry). 모듈 완성 즉시 검증.
- **산출**: `components/widgets/**`, `output/widget-manifest.md`.
- **shape 변경 대응**: P4 중 api-shapes 갭 발견 시 오케스트레이터가 api-designer를 포함한 소규모 팀을 일시 재구성해 shape를 갱신한 뒤 P4 팀 복귀.

---

## 팀 재구성 규칙
- 세션당 1팀만 활성 → Phase 전환 시 반드시 **이전 팀 TeamDelete 후 새 TeamCreate**.
- 이전 팀 산출물은 `output/`·`_workspace/`에 보존되므로 새 팀이 Read로 접근.
- 팀 크기는 2명(빌더+qa) 기본. P4는 작업 수가 많으나 역할이 단일하므로 팀원은 유지하고 TaskCreate로 위젯별 작업을 분할한다.
