---
name: paneboard-orchestrator
description: "PaneBoard(개인 모듈형 캔버스 대시보드) 빌드 에이전트 팀을 단계별로 조율하는 오케스트레이터. 'PaneBoard 빌드/구현/이어서 만들어줘', '대시보드 앱 만들어줘', 'phase N 실행', 'db/캔버스/API/위젯 단계 진행' 시 반드시 사용. 후속 작업도 포함: 재실행/이어서/업데이트/수정/보완/특정 phase만 다시/이전 결과 기반으로 개선. 단순 질문은 직접 응답 가능."
---

# PaneBoard Orchestrator — 빌드 에이전트 팀 조율

PaneBoard의 5인 에이전트 팀(db-architect · ui-builder · api-designer · widget-engineer · qa)을 설계서(`PaneBoard_웹개발_설계서_*.md`)에 따라 단계별 파이프라인으로 조율한다. 실행 모드는 **에이전트 팀**이며, **Phase마다 팀을 재구성**한다(세션당 1팀만 활성).

## 에이전트 구성

| 팀원 | 타입 | 역할 | 사용 스킬 | 핵심 출력 |
|------|------|------|----------|----------|
| db-architect | 커스텀 | 스키마·RLS·Storage·타입생성 | supabase-schema, rls-verify | `output/schema.sql`, `output/types/database.ts` |
| ui-builder | 커스텀 | 캔버스·백스택·토큰·반응형·컨트랙트 | tweakcn-theme | `output/contract.ts` |
| api-designer | 커스텀 | Route Handler·KIS SSE·인제스트·프록시·파서 | — | `output/api-shapes.ts` |
| widget-engineer | 커스텀 | 위젯 15종 + registry | widget-scaffold | `output/widget-manifest.md` |
| qa | 커스텀(실행가능) | 경계면 교차 검증·incremental QA | rls-verify | `_workspace/{phase}_qa_report.md` |

> 모든 팀원은 `model: "opus"`로 스폰한다.

## 두 파일 평면
- **`output/`** — Phase 간 영속 핸드오프(schema.sql, types/database.ts, contract.ts, api-shapes.ts, widget-manifest.md). 팀 해체에도 보존되어 다음 Phase 팀이 Read.
- **`_workspace/`** — 오케스트레이션 스크래치·감사(`00_input/`, phase별 qa 리포트, 컨텍스트 상태). 보존(삭제 금지).

## 워크플로우

### Phase 0: 컨텍스트 확인 (매 호출, 팀 구성 전)
`.claude/agents/`, `output/`, `_workspace/`, `package.json`, `supabase/migrations/` 존재를 확인해 실행 모드를 분기한다:
- **초기**: `output/`·`_workspace/` 미존재 → 하네스/스캐폴딩 후 Phase 1부터.
- **이어서/재실행**: 둘 다 존재 → 직전 산출물을 읽고 **다음 미완료 Phase부터 재개**. 완료 판정은 산출물 존재로(예: `output/types/database.ts` 있으면 P1 완료, `output/contract.ts` 있으면 P2 완료, `output/api-shapes.ts` 있으면 P3 완료).
- **부분 수정**: 사용자가 특정 phase/에이전트를 지명 → 해당 팀만 재구성, 그 phase의 기존 `output/` 산출물을 읽고 대상만 덮어씀. 교체된 `_workspace/`는 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동.

드리프트 감지: `.claude/agents/` 목록과 위 구성표를 대조해 불일치를 보고한다.

### Phase 1~4: 빌드 파이프라인 (설계서 §11.2 순서, qa 각 팀에 합류)

각 Phase는 **팀 재구성 → 작업 등록 → 자체 조율 → qa 게이트 → 팀 해체** 사이클을 따른다. 상세 phase별 작업·데이터 흐름·재구성 경계는 `references/phase-pipeline.md` 참조.

| Phase | 팀(재구성) | 산출 | 다음으로의 의존 | 경계 |
|-------|-----------|------|----------------|------|
| **P1 db** | db-architect + qa | 5테이블·RLS·`pb-images`·`output/{schema.sql,types/database.ts}` | types → 전 Phase | qa가 RLS 격리 증명 후 **TeamDelete** |
| **P2 ui** | ui-builder + qa | 캔버스·백스택·토큰·`output/contract.ts` | contract → P4 | 컨트랙트 동결 후 TeamDelete (qa 경계쌍 #5,#7) |
| **P3 api** | api-designer + qa | `app/api/**`·`lib/api/**`·파서·`output/api-shapes.ts` | api-shapes → P4 | api-shapes 동결 후 TeamDelete (qa 경계쌍 #1,#2) |
| **P4 widgets** | widget-engineer + qa | 위젯 15종·`registry.ts`·`output/widget-manifest.md` | — | 위젯별 incremental qa(#1,#3,#4,#6), 핵심 9 → 확장 6 |

**팀 구성·작업 등록 패턴(각 Phase 공통):**
```
TeamCreate(team_name: "paneboard-p{N}", members: [
  { name: "{builder}", agent_type: "{builder}", model: "opus", prompt: "{phase 작업 지시 + output 경로}" },
  { name: "qa", agent_type: "qa", model: "opus", prompt: "{이 phase의 경계쌍 검증 지시}" }
])
TaskCreate(tasks: [ {builder 모듈 작업들}, {qa 검증 작업은 builder 모듈 완료에 depends_on} ])
```
팀원은 SendMessage로 자체 조율하고, 리더(오케스트레이터)는 유휴 알림을 모니터링하며 qa verdict를 수집한다.

**왜 §11.2 순서인가(엄격 파이프라인 대신):** P2(컨트랙트)가 P3보다 먼저인 이유는 컨트랙트의 `dataMode` 필드가 api-designer의 stream/poll 범위를 규정하기 때문. P4는 P2(contract)+P3(api-shapes) **둘 다**에 의존 → widget-engineer는 api-designer의 shape 변경 채널을 구독한다.

### Phase 5: 정리 + 보고
각 Phase 종료 시 TeamDelete, `_workspace/` 보존, 사용자에 산출물·qa verdict·다음 Phase 요약 보고.

## 데이터 전달 프로토콜
- **태스크 기반**(TaskCreate/Update): phase별 작업 + `depends_on`. qa 검증 작업은 빌더 모듈 완료에 의존.
- **파일 기반**(`output/`): 5개 영속 산출물.
- **메시지 기반**(SendMessage): 실시간 shape 브로드캐스트(api-designer→widget-engineer), 컨트랙트 동결, qa 수정 요청. `to:"all"`은 드물게.

## 에러 핸들링
| 상황 | 전략 |
|------|------|
| 빌더 실패 | 리더 감지 → 상태 확인 → 1회 재시도 → 실패 시 누락 명시하고 진행. **단 P1 스키마 실패는 에스컬레이션**(전 다운스트림 하드 의존) |
| 데이터 충돌(api shape ≠ db 컬럼) | 양쪽 출처 병기, qa가 재조정 작업 등록, 임의 덮어쓰기 금지 |
| 외부 의존 장애(P3 KIS/Google) | provider 폴러+stale 배지로 폴백, 라이브 키 스모크는 후속 |
| 빌드/타입 실패 | 자동 재시도 최대 3회 후 에스컬레이션 |

## 테스트 시나리오
**정상:** "PaneBoard phase 1 진행" → Phase 0이 `output/` 부재 확인 → 초기 → (하네스/스캐폴딩 완료 상태에서) TeamCreate(db-architect+qa) → 마이그레이션 라이브 push → qa가 RLS 격리 증명 → `output/types/database.ts` 생성 → 체크포인트 보고. 기대: 5테이블+RLS+버킷 라이브, 타입 생성.

**에러:** P4에서 widget-engineer가 SSE payload를 로컬 타이핑해 `output/api-shapes.ts`와 드리프트 → qa 경계쌍#1이 필드 불일치 포착 → widget-engineer(수정: export import)와 api-designer(shape 확인) **양쪽**에 통지 → 재import → qa 재검증 → phase 계속, 리포트에 포착된 드리프트 명시.
