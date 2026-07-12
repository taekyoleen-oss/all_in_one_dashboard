# PaneBoard 위젯 매니페스트

위젯별 `type` · `category` · `dataMode` · `copyBehavior` · `sensitive` · `needsGoogleScope` 요약.
출처: 각 `components/widgets/{type}/index.ts`의 `WidgetDefinition`. 레지스트리: `components/widgets/registry.ts`.

## Batch 1 (구현 완료 — Phase 4)

| type | displayName | category | dataMode | copyBehavior | sensitive | needsGoogleScope | config 요약 |
|------|-------------|----------|----------|--------------|-----------|------------------|-------------|
| `memo` | 메모 | core | static | content | – | – | `{ text, color, size }` — 본문·강조색·글자크기. **config-driven**(편집 시 타일 재렌더) |
| `calculator` | 계산기 | core | static | custom | – | – | `{ display }` — 표시 밀도만. 평가는 제한된 `mathjs/number` 스코프(사칙+log/ln/√/x^y/x²/eˣ/π/e/괄호). 복사=마지막 결과 |
| `world-clock` | 세계시계 | extended | static | config | – | – | `{ zones[], hour12, showSeconds }` — 클라이언트 IANA TZ(`Intl`), 외부 API 불필요 |
| `dday` | D-Day | extended | static | config | – | – | `{ entries[] }` — 라벨+날짜+매년반복, `date-fns` 카운트다운(D-N/D+N/D-Day) |

## Batch 2 (구현 완료 — Phase 4)

| type | displayName | category | dataMode | copyBehavior | sensitive | needsGoogleScope | config 요약 |
|------|-------------|----------|----------|--------------|-----------|------------------|-------------|
| `todo` | 할 일 | extended | static | config | – | – | `{ title, items[] }` — 체크리스트+진행률. Compact/Expanded 체크박스는 읽기전용(컨트랙트상 onChange 없음), 토글·추가·순서변경은 ConfigEditor. `// TODO(persist)`: 현재 config, 추후 `pb_todos`-style 테이블 옵션 |
| `favorites` | 즐겨찾기 | core | static | config | – | – | `{ links[] }`(label+url+optional group) — 파비콘 그리드(DuckDuckGo ip3) → onError 시 **글자 아바타 폴백**(API 키·네트워크 불필요). Expanded는 그룹별 목록 |
| `contacts` | 연락처 | core | static | **custom** | – | – | `{ contacts[] }`(name/phone/email/memo/favorite) — Compact=즐겨찾기, Expanded=전체+검색+`tel:`/`mailto:`+필드별 복사. 개인 연락처는 D5 허용(비민감) |
| `essential-info` | 필수정보 | core | static | **custom** | **true** | – | `{ items[] }`(label+value+masked) — 행별 마스킹(명시적 reveal). ConfigEditor에 **D5 경고 배너**(주민번호·카드전체·비밀번호·계좌비번 저장 금지, 중간수준만; 차단 아닌 경고). 값 단위 복사 |
| `image-slider` | 이미지 슬라이드 | core | static | config | – | – | `{ images[], intervalSec }` — Compact=자동전환 썸네일(+마우스 드래그 패닝, 마지막 본 슬라이드·위치 localStorage 복원), Expanded=대형 뷰어(prev/next·키보드·dot, 마지막 본 슬라이드에서 시작). `prefers-reduced-motion` 시 자동전환 정지. 파일 추가는 dataURL 인라인(상한 **40장·총 ~4MB**). `// TODO(storage)`: pb-images `{user_id}/{instance_id}/{file}` 업로드 후 signed-URL 저장 |

**접근성/모션**: 모든 위젯 색상 단독신호 금지(기호/라벨 병기), 키보드 조작, masked 값은 명시적 reveal, 슬라이더 `prefers-reduced-motion` 준수.
**위젯 추가 파일**: 각 `{type}/` = `index.ts`·`types.ts`·`CompactView.tsx`·`ExpandedView.tsx`·`ConfigEditor.tsx`(+ `*Manager.tsx`/helper). 공용: `lib/utils/useCopy.ts`(custom copy 피드백), favorites `FaviconImg.tsx`, image-slider `useAutoAdvance.ts`·`useSlideView.ts`(마지막 본 화면 localStorage)·`imageFiles.ts`(dataURL 파이프라인·상한).

## Batch 3 (API 연동 — 예정)

| type | displayName | category | dataMode | refreshInterval | 비고 |
|------|-------------|----------|----------|-----------------|------|
| `stock` | 주식 뷰어 | core | stream | – | KIS 시세 SSE 중계, 읽기 전용 |
| `weather` | 날씨 | core | poll | (TBD) | 무료 날씨 API 프록시 |
| `card-usage` | 카드 사용현황 | core | poll/snapshot | – | **sensitive** — 읽기 전용 스냅샷 |
| `fx` | 환율 | extended | poll | (TBD) | 무료 FX API 프록시 |
| `news` | 뉴스/RSS | extended | poll | (TBD) | Naver News/RSS 프록시 |
| `calendar` | 캘린더 | extended | poll | (TBD) | **needsGoogleScope** — Google Calendar |

## 추가 유틸 위젯

| type | displayName | category | dataMode | sensitive | needsGoogleScope | 비고 |
|------|-------------|----------|----------|-----------|------------------|------|
| `clipboard` | 클립보드 기록 | extended | static(local) | – | – | 페이지 복사 자동 기록(`copy` 이벤트) + 수동 추가(readText/붙여넣기). 항목 클릭 시 재복사. 기록은 기기 localStorage(인스턴스별). OS 전역 감시는 브라우저 한계로 불가. |

## Batch 4 (추가 위젯 7종)

| type | displayName | category | dataMode | refreshInterval | sensitive | 비고 |
|------|-------------|----------|----------|-----------------|-----------|------|
| `air-quality` | 대기질 | extended | poll | 30분 | – | Open-Meteo Air-Quality(키리스). PM2.5/PM10/O₃/NO₂/SO₂/CO + EU/US AQI. 환경부 4등급(좋음·보통·나쁨·매우나쁨). 위치=LocationPicker 공용. |
| `subscriptions` | 구독 관리 | extended | static(config) | – | – | 정기결제 + 다음 결제일(앵커→롤포워드) + 월/연 합계(추정환율). 항목은 config jsonb. |
| `unit-converter` | 단위 변환 | extended | static | – | – | 길이·무게·온도·넓이·부피·속도·시간·데이터 + 한국단위(평·근·돈·되). 타일 즉시 변환, 확장 시 전체 환산표. |
| `timer` | 타이머 | extended | static(local) | – | – | 타이머/스톱워치/뽀모도로. 절대시각 기반(드리프트 無), 런타임은 instance별 localStorage. 종료 시 비프(WebAudio)+브라우저 알림(선택). |
| `sun-moon` | 일출·일몰/달 | extended | static | – | – | 순수 로컬 천문계산: 일출/일몰(NOAA)·낮길이·달 위상(삭망월). 위치=LocationPicker. API 無(오프라인 동작). |
| `translate` | 번역기 | extended | static(on-demand) | – | – | /api/translate. 키리스(Google gtx→MyMemory), DEEPL_API_KEY 시 DeepL 전환. auto 감지·언어 스왑·복사. |
| `vehicle` | 차량 관리 | extended | static(config) | – | – | 주유(연비 km/L 자동)·정비·갱신만기(D-day). 항목은 config jsonb. |

**Batch 4 공용 추가**: `components/widgets/shared/LocationPicker.tsx`(위치 설정 4-방법 — 검색/현재위치/지역/직접입력, 대기질·일출달 공용). 신규 라우트 `/api/air-quality`·`/api/translate`, 클라이언트 `lib/api/airQualityClient.ts`·`translateClient.ts`. api-shapes 추가: `AirQualitySchema`·`TranslateSchema`. 모두 키리스 즉시동작.

## Batch 5 (노트 — 리치 텍스트 다기능 위젯)

| type | displayName | category | dataMode | copyBehavior | 비고 |
|------|-------------|----------|----------|--------------|------|
| `note` | 노트 | extended | static(config) | config | 강의 기록용 리치 텍스트 노트. 굵게·기울임·밑줄·취소선·글자색·형광펜·글자크기(px)·제목(H2/H3)·글머리/번호목록·정렬·인용·구분선·링크·**이미지(자동축소)**·**표(삽입+행/열 추가삭제)**·**파일 첨부**(인라인 base64, ≤5MB). `contentEditable`+execCommand 엔진(의존성 0). 붙여넣기/드롭 HTML·이미지 **살균**(allowlist sanitizer — script/onerror/javascript: 제거) 후 저장·렌더. CompactView=읽기전용 미리보기(하이드레이션 가드), ExpandedView=전체 에디터. 본문·첨부 모두 config jsonb. |

**Batch 5 파일**: `note/{types,sanitize,media,richText,Toolbar,NoteEditor,Attachments,CompactView,ExpandedView,ConfigEditor,index}`. 살균기는 SSR 폴백(정규식 strip) + 클라 DOMParser allowlist 2중. 첨부는 인라인 저장(사용자 선택), Storage 업로드는 향후 업그레이드 여지.

## 불변 규칙 (모든 위젯)
- **인스턴스 격리**: 모든 상태/구독은 `instanceId`로 키. 같은 종류 2개는 독립 config·독립 구독.
- **shape import**: API 연동 위젯(Batch 3)은 응답 타입을 `output/api-shapes.ts`에서 import(로컬 재선언 금지).
- **컨트랙트 준수**: `CompactView(config, instanceId, density)` / `ExpandedView(config, instanceId)` / `ConfigEditor(config, onChange)`. 영속화는 상위(ConfigDialog→page→pb_widgets)가 담당.
- **접근성**: 색상은 단독 신호 금지(기호/라벨 병기), 키보드 조작 가능, `prefers-reduced-motion` 준수.
