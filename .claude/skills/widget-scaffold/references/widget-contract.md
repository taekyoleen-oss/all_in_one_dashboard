# 위젯 컨트랙트 (WidgetDefinition) — §9.4

모든 위젯이 구현하는 공통 인터페이스. 실제 타입 본체는 ui-builder가 `lib/widgets/contract.ts` → `output/contract.ts`로 동결한다. widget-engineer는 이를 import해 사용한다.

```ts
// 구조 (실제 코드는 output/contract.ts 동결본 기준)
interface WidgetDefinition<C = unknown> {
  type: string;                 // registry 키와 동일
  displayName: string;
  icon: LucideIcon | string;
  category: 'core' | 'extended';
  defaultConfig: C;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  CompactView: React.FC<{ config: C; instanceId: string; density: Density }>;
  ExpandedView: React.FC<{ config: C; instanceId: string }>;
  ConfigEditor: React.FC<{ config: C; onChange: (next: C) => void }>;
  copyBehavior: 'config' | 'content' | 'custom';
  dataMode?: 'static' | 'poll' | 'stream';   // 주식=stream, 환율/날씨/뉴스=poll
  refreshInterval?: number;                   // poll 위젯만
  sensitive?: boolean;                        // essential-info, card-usage
  needsGoogleScope?: boolean;                 // calendar
}

// widgetRegistry: Record<string /*type*/, WidgetDefinition>
```

## 15종 type 키
**핵심 9**: `stock`, `memo`, `favorites`, `image-slider`, `contacts`, `essential-info`, `weather`, `calculator`, `card-usage`
**확장 6**: `fx`, `todo`, `dday`, `world-clock`, `news`, `calendar`

## 뷰 책임
- **CompactView**: 캔버스 축소 표시. `@container` 기준 reflow, `density`로 밀도 조절.
- **ExpandedView**: 포커스 모드 전체 기능.
- **ConfigEditor**: 편집 다이얼로그. `onChange`로 상위에 config 전달(상위가 영속화).

> config/layout은 `pb_widgets`의 jsonb로 저장된다. config 타입 C는 위젯별로 정의하되, DB 저장 형태는 `output/types/database.ts`의 jsonb와 호환되어야 한다.
