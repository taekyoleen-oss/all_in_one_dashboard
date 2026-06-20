---
name: widget-scaffold
description: "PaneBoard 위젯 15종 중 하나를 추가/수정할 때 반드시 사용. Compact/Expanded/Config 뷰 + WidgetDefinition + registry 등록을 위젯 컨트랙트(§9.4) 준수로 스캐폴딩하고, API shape는 output/api-shapes.ts에서 import(재선언 금지)하도록 강제한다. 후속: 위젯 추가/수정/새 위젯 종류/컨트랙트 변경 반영/특정 위젯만 다시 작업 시에도 사용."
---

# widget-scaffold — 위젯 컨트랙트 준수 스캐폴딩

widget-engineer가 위젯을 컨트랙트에 맞춰 일관되게 만들기 위한 절차. 핵심은 **인스턴스 격리**와 **shape import 강제**(드리프트 차단)다.

## 위젯 1종 추가 절차
1. `components/widgets/{type}/` 생성: `CompactView.tsx`, `ExpandedView.tsx`, `ConfigEditor.tsx`, `index.ts`(WidgetDefinition export).
2. `WidgetDefinition`을 컨트랙트(`output/contract.ts`)에 맞춰 작성 — 시그니처/필드는 `references/widget-contract.md` 참조.
3. `components/widgets/registry.ts`의 `widgetRegistry`에 `[type]: definition` 등록. **registry 키 = `type` 문자열과 정확히 일치**.
4. API 연동 위젯이면 응답 타입을 `output/api-shapes.ts`에서 **import**(로컬 재선언 금지). 정적/로컬 위젯(calculator, world-clock 등)은 외부 타입 불필요.
5. `output/widget-manifest.md`에 type·dataMode·sensitive·needsGoogleScope 한 줄 추가.

## 불변 규칙 (왜)
- **shape는 import만**: API 응답을 위젯에서 다시 타이핑하면 snake/camel·래퍼·필드 누락 드리프트가 들어온다. 단일 소스(`output/api-shapes.ts`)를 import해야 api-designer의 변경이 타입으로 전파된다.
- **인스턴스 격리**: 모든 상태/구독은 `instanceId`로 키. 같은 종류 2개가 서로 간섭하면 안 된다(주식 2개 = 독립 종목·독립 구독).
- **dataMode 준수**: stream(stock)·poll(fx/weather/news)·static/local(memo/calculator/world-clock/dday/todo)·읽기전용 스냅샷(card-usage). refreshInterval은 poll에만.
- **민감/스코프**: `sensitive`(essential-info, card-usage)는 경고 노출, `needsGoogleScope`(calendar)는 연결 버튼.

## 검증
스캐폴딩 후 `references/scaffold-checklist.md`로 자가 점검하고, qa의 경계쌍 #6(컨트랙트↔registry)·#1/#3/#4(shape)를 통과해야 완료.
