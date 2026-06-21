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
| 2026-06-21 | 모바일/태블릿 반응형 + UX 보강 | GridCanvas, WidgetMenu, CanvasShell, calculator/*, app/icon·apple-icon·manifest | ① 반응형 그리드: lg(>1024,12col,영속)·md(>640,6col flow)·sm(≤640,1col) 브레이크포인트 재도입, 비-lg는 lg에서 파생·flow-pack(가로 가득), 비-lg 드래그/리사이즈/드롭 비활성 → 모바일 배치 변경이 PC 미반영(추가/삭제/설정은 영속 경로로 반영). ② 모바일 ⋮ 메뉴: pointer-coarse opacity-100로 터치 기기 상시 노출. ③ 헤더 한 줄(제목\|보드탭 스크롤\|툴바). ④ 계산기 CompactView에 √·x²·xʸ·eˣ·ln·log·π·e 추가(evaluate.ts 기존 지원). ⑤ 앱 아이콘(패널 마크) svg/apple-icon(PNG)/manifest. tsc·build 그린 |
| 2026-06-21 | KIS 토큰 영속 캐시 강건화 + 전체 종목 검색 + 연락처 CSV | lib/api/stock/{tokenStore,kisClient,kisWebSocket,symbols,krx-catalog.generated}, scripts/gen-krx-catalog.mjs, contacts/{csv,ContactManager} | ① KIS 토큰 캐시: tmpdir→프로젝트 .cache 고정 경로(mkdir 보장), 발급 시 console.warn 진단 로그(외부 동일 appkey 사용 시 충돌 안내), 캐시 쓰기 실패 가시화, 접속키 self-heal 무효화 제거(churn 방지). ② 전체 종목 검색: KRX KIND 코스피+코스닥 2,639종목 카탈로그 자동생성(gen-krx-catalog.mjs)→searchKrStocks가 전체 검색, 큐레이션은 빈검색 추천으로 유지. ③ 연락처 CSV 가져오기(구글/아웃룩/네이버) 추가 + 안내문구 보강(아이폰 vCard·구글 CSV). tsc·build 그린 |
| 2026-06-21 | 주식 새로고침/시각 · 드롭다운 포털 · 날씨 지역/예보 | stock/{useStockQuotes,RefreshBar,Compact/Expanded,format}, ui/primitives, ConfigDialog, weather/{types,CompactView,ConfigEditor} | ① 주식 위젯 새로고침 버튼+결과 시각(useStockQuotes에 refresh()/lastUpdated, RefreshBar; 캐시 토큰 재사용→발급 없음). ② **KIS 토큰 캐시 실측 검증**: 새 서버 프로세스가 .cache 파일 토큰 재사용→발급 0회 확인(증상은 옛 코드 서버 미재시작 탓; 재시작 필요). ③ ⋮ 메뉴(속성) 위젯 overflow-hidden에 잘리던 문제 → DropdownMenuContent를 body로 portal+고정좌표+상하 flip(화면 안에 전체 표시), ConfigDialog 60→75dvh. ④ 날씨: 지역 선택 33개로 확대(3열), 타일 표시 내용 현재/시간별/주간 선택(WeatherConfig.view; 데이터는 기존 hourly/daily 활용). tsc·build 그린 |
| 2026-06-21 | 날씨 위치 주소/장소 검색(동·골프장) | lib/api/geocodeClient.ts, app/api/geocode/route.ts, weather/ConfigEditor | 지오코딩 검색 추가: 동 단위 주소·골프장·랜드마크 이름으로 위치 지정. /api/geocode(서버 전용, KAKAO_REST_API_KEY 있으면 카카오 우선 → 골프장/동 정확도↑, 없으면 무료 Nominatim/OSM 폴백). 날씨 ConfigEditor에 검색창+결과목록. Nominatim 실측: 역삼동·정자동·스카이72 OK(일부 골프장은 카카오 키 필요). tsc·build 그린 |
| 2026-06-21 | 위젯 최소높이↓ · 클립보드 위젯 · 날씨/환율 새로고침 · 팔레트 드롭 | widgets/*/index.ts(minSize.h=1), widgets/clipboard/*, registry, widgets/shared/RefreshBar, weather/{useWeather,CompactView}, fx/CompactView, GridCanvas | ① 전 위젯 minSize.h=1(메모 수준 축소 허용). ② 신규 clipboard 위젯: 페이지 copy 자동기록+수동추가(readText/붙여넣기), 클릭 재복사, localStorage 인스턴스별(OS 전역감시 불가 명시). ③ 공용 RefreshBar로 날씨·환율 타일에 새로고침+갱신시각; 날씨 자동주기 10→30분. ④ 팔레트 드롭: 그리드에 min-h-[70vh] 부여해 빈 공간 드롭 가능(옆에만 붙던 문제 해소). **calendar 구글연결 'provider is not enabled'는 코드 아닌 Supabase 대시보드에서 Google provider 활성화 필요(설정 안내).** tsc·build 그린 |
| 2026-06-21 | 리사이즈 '다른 앱 밀기' · 환율 전일대비 | GridCanvas(compactor/resize/PushPrompt), fx/{useFxRates,FxRateRow,format}, fxClient, output/api-shapes(FxRates.changePct) | ① 리사이즈 충돌 처리: 컴팩터가 리사이즈 중 타일을 이웃에 닿도록 클램프(겹침 방지), 늘려서 막히면 '다른 앱 밀기' 버튼(dwell 450ms, 타일 SE에 portal) → 클릭 시 desired 크기로 키우고 겹치는 타일을 아래로 밀기(pushResolveDown, x 보존). 드래그/드롭/줌 동작은 불변. ② 환율 전일 대비 증감: Frankfurter 타임시리즈로 최신+전일 1콜 조회→changePct 계산(api-shapes에 옵션 필드 추가), FxRateRow에 +/−%·전일대비 표시, 방향색은 changePct 기준. tsc·build 그린 |
