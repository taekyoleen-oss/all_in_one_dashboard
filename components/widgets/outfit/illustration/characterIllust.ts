import type { GenderType, TempZone } from './types'

const CHAR_BASE = '/outfit/characters'

/**
 * 체감 구간 → 베이스 슬롯.
 * `public/outfit/characters/{female|male}-{slot}-v1.png` — 슬롯을 합치려면 여기서 동일 문자열로 매핑.
 *
 * - warm(23~27℃) → `warm-shirt`: 얇은 긴팔 셔츠 (28℃+ 반팔과 구분)
 * - cool(12~17℃) → `cool-layered`: 맨투맨/가디건 + 얇은 점퍼 레이어드
 *   (캐논 male-cool-v1을 보존하기 위해 별도 슬롯 사용)
 */
const SLOT_BY_ZONE: Record<TempZone, string> = {
  hot: 'hot',
  warm: 'warm-shirt',
  mild: 'mild',
  cool: 'cool-layered',
  cold: 'cold',
  freezing: 'freezing',
}

/**
 * 등록된 **상황 슬롯**. PNG가 `public/outfit/characters/`에 존재할 때만 추가하세요.
 * 등록되지 않은 슬롯이 선택되면 자동으로 온도 슬롯으로 폴백합니다.
 *
 * 1차 권장 PNG: `rain-light`, `rain-heavy`, `snow` (남·여 총 6장)
 * 2차 권장 PNG: `sunny-uv`, `windy` (남·여 총 4장)
 *
 * 온도-zone 변형(2026-05): rain-light는 온도에 따라 의상이 크게 달라지므로
 * `rain-light-{mild|cool|cold}` 변형을 별도 등록. resolver가 zone-suffix를 먼저 시도하고
 * 없으면 base 슬롯으로 폴백한다. (rain-heavy·snow는 보온/방수 위주라 변형 불필요)
 */
const AVAILABLE_SITUATION_SLOTS = new Set<string>([
  'rain-light',
  'rain-light-hot',
  'rain-light-warm',
  'rain-light-mild',
  'rain-light-cool',
  'rain-light-cold',
  'rain-heavy',
  'snow',
  'sunny-uv',
  'windy',
])

export interface CharacterSlotContext {
  tempZone: TempZone
  ptyCode?: string
  precipitation?: number
  showSunshine?: boolean
  windAlert?: boolean
}

/**
 * 날씨·체감 조건 → 캐릭터 슬롯.
 * 우선순위: 강설 > 강수(강/약) > 강한 햇빛(여름·봄가을 더위) > 강풍 > 온도 폴백.
 *
 * Zone-aware 매칭: 후보 슬롯에 대해 `{slot}-{zone}` 변형이 등록되어 있으면 우선 사용,
 * 없으면 base 슬롯으로 폴백. 예) mild + 약한 비 → 'rain-light-mild' → 없으면 'rain-light'.
 * 미등록 슬롯은 온도 슬롯으로 자동 폴백.
 */
export function pickCharacterSlot(ctx: CharacterSlotContext): string {
  const { tempZone, ptyCode, precipitation = 0, showSunshine, windAlert } = ctx
  const candidates: string[] = []
  if (ptyCode === '3' || ptyCode === '2') candidates.push('snow')
  if (ptyCode === '1' || ptyCode === '4') {
    candidates.push(precipitation >= 3 ? 'rain-heavy' : 'rain-light')
  }
  if (showSunshine && (tempZone === 'hot' || tempZone === 'warm')) candidates.push('sunny-uv')
  if (windAlert) candidates.push('windy')
  for (const slot of candidates) {
    const zoneVariant = `${slot}-${tempZone}`
    if (AVAILABLE_SITUATION_SLOTS.has(zoneVariant)) return zoneVariant
    if (AVAILABLE_SITUATION_SLOTS.has(slot)) return slot
  }
  return SLOT_BY_ZONE[tempZone]
}

/** 슬롯 문자열로 PNG URL 생성. 외부에서 `pickCharacterSlot`을 먼저 호출 권장. */
export function outfitCharacterImageSrc(gender: GenderType, slot: TempZone | string): string {
  const resolved = typeof slot === 'string' && slot in SLOT_BY_ZONE
    ? SLOT_BY_ZONE[slot as TempZone]
    : slot
  const file = gender === 'female' ? `female-${resolved}-v1.webp` : `male-${resolved}-v1.webp`
  return `${CHAR_BASE}/${file}`
}
