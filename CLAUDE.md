@AGENTS.md

# PaneBoard

개인 모듈형 캔버스 대시보드. **단일 진실 원천(설계서)**: `../PaneBoard_웹개발_설계서_v1.3.md`(파일명은 v1.3 유지, 내부 버전 v1.4). 구현 결정·범위·검증 기준은 설계서를 따른다.

- **스택**: Next.js **16** (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/TweakCN(미초기화 — 현재 토큰 기반 커스텀 컴포넌트) · Supabase(Postgres+RLS+Storage+Auth) · Vercel
- **테이블 프리픽스**: `pb_`
- **데이터 핸드오프**: `output/`(영속 산출물: schema.sql, types/database.ts, contract.ts, api-shapes.ts, widget-manifest.md), `_workspace/`(오케스트레이션 스크래치)
- **⚠ Next.js 버전 주의**: 위 `@AGENTS.md`대로, 이 Next.js는 학습 데이터와 다른 breaking change가 있다. **Next.js 코드(라우트 핸들러·middleware·레이아웃 등) 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 읽는다.**

## 하네스: PaneBoard 빌드

**목표:** 5인 에이전트 팀(db-architect·ui-builder·api-designer·widget-engineer·qa)으로 설계서를 구현한다.

**트리거:** PaneBoard 빌드/구현/이어서/phase 진행/위젯·캔버스·API·DB 작업 요청 시 `paneboard-orchestrator` 스킬을 사용한다. 단순 질문은 직접 응답 가능. (에이전트·스킬 목록은 `.claude/agents/`·`.claude/skills/`에서 관리 — 여기 중복 기재하지 않음)

## 불변 가드레일 (모든 세션 준수)
- **보안**: 모든 `pb_*` 테이블 RLS(`user_id = auth.uid()`). 외부 API 키·**KIS 자격증명은 서버 전용**(클라이언트 미노출). 인제스트는 per-user 토큰.
- **주식**: KIS는 **읽기 전용 시세만** — 주문/잔고 엔드포인트 **사용 금지**. 시세는 개인 본인 용도(재배포 금지).
- **민감정보**: 주민번호·카드번호 전체·비밀번호 **저장 금지**. 법인등록번호·주소 등 중간 수준만 평문(RLS). 민감값 서버 로그·에러 노출 금지.
- **인증**: 본인 전용 — Google OAuth + 이메일 매직링크(둘 다 패스워드리스), `ALLOWED_EMAIL` 1개만 통과.

## 변경 이력
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-20 | 초기 하네스 구성(에이전트 5 + 스킬 5 + 오케스트레이터) | 전체 | 설계서 §9 하네스 청사진 실체화, 실행모드=에이전트 팀, QA·rls-verify 추가 |
| 2026-06-20 | Phase 1(DB) 라이브 적용 + 게이트 통과 | supabase/migrations, output/types | pb_* 5테이블·RLS·Storage → all_in_one_board(nsedndrdykeujribqyqx), RLS 10/10 PASS |
| 2026-06-20 | Phase 2(캔버스 셸) 구현 — 빌드 그린 | lib/, components/canvas/, app/ | 컨트랙트 동결·백스택(§6.3)·GridCanvas(RGL v2)·팔레트·보드탭·툴바·포커스, Playwright QA 통과 |
| 2026-06-20 | Phase 4 위젯 9종(무외부의존) 구현 | components/widgets/ | 메모·계산기·세계시계·D-Day·할일·즐겨찾기·연락처·필수정보·이미지슬라이드 + 실 레지스트리, 라이브 렌더 확인 |
| 2026-06-20 | 인증(매직링크) + DB 영속화 | proxy.ts, app/(auth), lib/persistence | **Next 16 Proxy**(=middleware) 가드·ALLOWED_EMAIL 단일사용자 게이트·pb_* 낙관적 디바운스 저장. proxy 리다이렉트→/login·로그인 UI 런타임 확인. 잔여: 사용자 Supabase redirect 설정 + 매직링크 로그인으로 영속화 런타임 검증 |
| 2026-06-20 | Phase 3 데이터 계층 + 위젯 15종 완성 | app/api/*, lib/api/*, output/api-shapes.ts, components/widgets/* | 주식(KIS/SSE+공개지수 fallback)·날씨·환율·뉴스 프록시·카드 인제스트/CSV/파서·캘린더 + api-shapes 단일소스. 결합 빌드 그린. keyless fallback로 즉시 동작, KIS/KMA/Naver/Google 키 시 라이브 전환. 잔여(라이브): 키 입력 + Supabase Google provider 설정 |
