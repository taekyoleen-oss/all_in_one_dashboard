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
| `image-slider` | 이미지 슬라이드 | core | static | config | – | – | `{ images[], intervalSec }` — Compact=자동전환 썸네일, Expanded=대형 뷰어(prev/next·키보드·dot). `prefers-reduced-motion` 시 자동전환 정지. **Storage 업로드 보류** → 현재 URL/`createObjectURL` 미리보기. `// TODO(storage)`: pb-images `{user_id}/{instance_id}/{file}` 업로드 후 signed-URL 저장 |

**접근성/모션**: 모든 위젯 색상 단독신호 금지(기호/라벨 병기), 키보드 조작, masked 값은 명시적 reveal, 슬라이더 `prefers-reduced-motion` 준수.
**위젯 추가 파일**: 각 `{type}/` = `index.ts`·`types.ts`·`CompactView.tsx`·`ExpandedView.tsx`·`ConfigEditor.tsx`(+ `*Manager.tsx`/helper). 공용: `lib/utils/useCopy.ts`(custom copy 피드백), favorites `FaviconImg.tsx`, image-slider `useAutoAdvance.ts`.

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

## 불변 규칙 (모든 위젯)
- **인스턴스 격리**: 모든 상태/구독은 `instanceId`로 키. 같은 종류 2개는 독립 config·독립 구독.
- **shape import**: API 연동 위젯(Batch 3)은 응답 타입을 `output/api-shapes.ts`에서 import(로컬 재선언 금지).
- **컨트랙트 준수**: `CompactView(config, instanceId, density)` / `ExpandedView(config, instanceId)` / `ConfigEditor(config, onChange)`. 영속화는 상위(ConfigDialog→page→pb_widgets)가 담당.
- **접근성**: 색상은 단독 신호 금지(기호/라벨 병기), 키보드 조작 가능, `prefers-reduced-motion` 준수.
