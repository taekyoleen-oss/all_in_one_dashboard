# 토큰 레퍼런스 (값은 출발점, TweakCN로 미세조정)

다크 기본의 Calm Dashboard 팔레트 예시. HSL/oklch는 TweakCN 결과로 대체 가능하되 토큰 이름은 유지한다.

## 표면 (다크 `.dark` / 라이트 `:root`)
| 토큰 | 다크(기본) | 라이트 | 용도 |
|------|-----------|--------|------|
| `--background` | 매우 어두운 중립 | 매우 밝은 중립 | 캔버스 바탕 |
| `--card` | background보다 살짝 밝게 | 흰색 근처 | 위젯 프레임 |
| `--border` | 저대비 중립 | 저대비 중립 | 미묘한 보더 |
| `--foreground` | 밝은 회백 | 어두운 회 | 본문 |
| `--muted` / `--muted-foreground` | 보조 표면/텍스트 | 〃 | 라벨·캡션 |
| `--primary` / `--accent` | 차분한 액센트(예: teal/indigo 계열) | 〃 | 강조·링크 |

## 시맨틱 등락색 (§8.2, §2.1)
```css
:root        { --positive: <red>;  --negative: <blue>; }   /* 한국식 기본: 상승=red, 하락=blue */
[data-updown="us"] { --positive: <green>; --negative: <red>; } /* 미국식 토글 */
```
> 사용처: 주가 등락, 실시간 시세 변동 플래시(미묘). 반드시 기호(▲▼ 등)와 병기.

## 밀도 (§8.2, §4.1)
```css
:root {
  --density-gap: 0.5rem;   /* 위젯 내부 간격 */
  --density-pad: 0.75rem;  /* 위젯 패딩 */
  --radius: 0.75rem;       /* 적당한 라운딩 */
}
```
위젯 크기에서 파생한 `density`(compact|cozy|comfortable)에 따라 위 값을 스케일. `@container` 쿼리로 컨테이너 폭 구간별 조정.

## shadcn 연결
shadcn 기본 변수(`--background`,`--card`,`--primary`,`--radius` 등)와 이름이 겹치므로 그대로 쓰되, `--positive/--negative/--density-*`만 추가한다. 컴포넌트는 이 변수를 참조하도록 둔다(하드코딩 색 금지).
