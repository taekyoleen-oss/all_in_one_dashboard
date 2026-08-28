# P0 사전 점검 결과 — 안드로이드 홈 화면 위젯 (PLAN-android-widget.md)

작성일: 2026-08-28 · 대상: PaneBoard(이 저장소). 계획서의 일반 명칭 ↔ 실제 매핑:
`appointments`/`targets` → **`pb_circle_appointments` / `pb_circle_targets`** (지인 일정 정리 위젯 데이터),
신규 테이블도 저장소 규칙대로 **`pb_` 프리픽스**(`pb_widget_devices`, `pb_widget_pairing_codes`)를 쓴다.

## 1. PWA manifest 점검 (`app/manifest.ts`)

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| manifest 자체 | ✅ 있음 | Next `app/manifest.ts` file convention (`/manifest.webmanifest`) |
| 아이콘 192×192 PNG | ❌ 없음 | 현재 `/icon.svg`(sizes: any) + `/apple-icon`(180×180 PNG)뿐 |
| 아이콘 512×512 PNG | ❌ 없음 | Bubblewrap `init`이 512×512 PNG를 요구 |
| `purpose: maskable` 아이콘 | ❌ 없음 | |
| `share_target` | ✅ 있음 | 기존 기능 — TWA와 충돌 없음 |

→ **P2 착수 시** 192/512 PNG(+maskable)를 추가해야 한다. SVG 원본(`app/icon.svg` 계열)이
있으므로 PNG 파생 생성으로 해결 가능. P0에서는 기록만 남긴다.

## 2. `/.well-known/assetlinks.json` 서빙 경로

- `public/.well-known/` 디렉터리 **없음** (파일 미존재).
- Next.js는 `public/` 아래 파일을 경로 그대로 정적 서빙하므로 `public/.well-known/assetlinks.json`에
  두면 된다(추가 설정 불요). proxy(=middleware)는 페이지 가드만 하므로 간섭 없음.
- 실제 파일은 **P2에서 서명 키 SHA-256 지문 확보 후** 생성한다(지문 없는 자리표시자는 무의미).

## 3. 현재 스키마 덤프

- `docs/schema-before.sql`에 기록. 출처는 append-only 마이그레이션 원본
  (`20260701120001_pb_circle_schedule.sql`) — supabase CLI가 이 PC의 **다른 Supabase 계정**으로
  로그인된 403 상태(2026-07-11·2026-08-12와 동일)라 라이브 `db dump`는 불가했다.
  과거 `migration list`에서 local=remote 일치가 확인된 이력이 있어 마이그레이션 원본을 스냅샷으로 쓴다.

## 4. 환경 점검 (계획서 §2)

| 항목 | 상태 |
| --- | --- |
| Node.js 20+ | ✅ v22 |
| supabase CLI | ⚠ 설치됨(v2.75.0)이나 **다른 계정 로그인 403** → 마이그레이션은 SQL Editor 수동 실행 경로 |
| JDK 17 / Android SDK / Bubblewrap | 미점검 — **P2 착수 시** 점검(P1까지는 웹/DB만 필요) |

## 5. 계획서 대비 결정 사항 (§6.6 문서화)

1. **설정 화면 위치**: `/settings/widget` 신규 페이지 대신 기존 **설정 다이얼로그(⚙)의 '위젯' 탭**으로
   구현한다 — 저장소에 settings 라우트가 없고 모든 설정이 SettingsDialog 탭 패턴이기 때문.
2. **`DELETE /api/widget/devices/[id]` 라우트 생략**: `pb_widget_devices`에 본인 select/delete RLS
   정책을 두고 설정 UI가 Supabase 클라이언트로 직접 삭제한다(useCircleData와 동일 패턴).
   보안 경계는 동일(RLS)하고 라우트 하나가 준다. 나머지 4개 라우트는 계획서대로.
3. **소유자 컬럼명**: 계획서의 `owner_id` 대신 저장소 전 테이블 규칙인 **`user_id`**.
