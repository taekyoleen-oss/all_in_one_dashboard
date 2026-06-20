---
name: tweakcn-theme
description: "PaneBoard의 TweakCN/shadcn 테마 토큰 작업 시 사용. --background/--card/--border/--primary/--accent/--muted 표면 토큰, --positive(상승)/--negative(하락) 시맨틱 토큰(한국식 상승=red/하락=blue, 토글), --density-gap/--density-pad/--radius 밀도 토큰을 다크 기본으로 구성한다. 후속: 테마 수정/토큰 추가/다크라이트 보완/등락색 토글 작업 시에도 사용."
---

# tweakcn-theme — 디자인 토큰 (Calm Dashboard)

ui-builder가 TweakCN(shadcn) 위에 PaneBoard의 토큰 체계를 구성하는 가이드. 컨셉은 **미니멀 + 소프트 테크(Calm Dashboard)** — 비자극·가독성·집중, 강력한 다크 모드(§8.1).

## 원칙 (왜)
매일 장시간 보는 정보 허브이므로 저채도 중립 표면 + 절제된 보더 + 차분한 액센트로 피로를 줄인다. 정보 전달은 **색만으로 하지 않는다**(상승/하락은 색 + 기호 동시) — 색각 접근성(WCAG, §1.6).

## 토큰 군 (§8.2)
- **표면**: `--background` `--card` `--border` `--primary` `--accent` `--muted` `--foreground` `--muted-foreground`
- **시맨틱**: `--positive`(상승) `--negative`(하락) — 한국식 기본 상승=red, 하락=blue. `data-updown="kr|us"` 토글로 반전.
- **밀도**: `--density-gap` `--density-pad` `--radius` — 위젯 크기 파생 density와 연동.

구체 값·라이트/다크 매핑·shadcn 변수 연결은 `references/token-reference.md` 참조.

## Tailwind v4 주의
이 프로젝트는 Tailwind v4(`@tailwindcss/postcss`)다. 토큰은 `globals.css`의 `@theme`/`:root`/`.dark`에 정의하고, **컨테이너 쿼리는 v4 내장**(`@container`, 별도 플러그인 불필요). 다크가 기본이므로 `<html class="dark">` 또는 테마 프로바이더 기본값을 dark로 둔다.

## 적용
1. `npx shadcn@latest init`로 기반 변수 생성(다크 기본 선택).
2. `globals.css`에 위 토큰군을 `:root`(라이트) / `.dark`(다크)로 정의, `--positive/--negative`와 토글 셀렉터 추가.
3. shadcn 컴포넌트(Card=위젯 프레임, Button(icon), DropdownMenu, Dialog/Sheet, Tabs, Command, Badge, Skeleton, Toggle, ScrollArea)를 §8.3 방향으로 커스터마이즈.

> TweakCN에서 테마를 시각적으로 잡은 뒤 변수를 globals.css로 가져오면 빠르다. 단 최종 변수는 위 토큰 군 이름으로 정규화한다.
