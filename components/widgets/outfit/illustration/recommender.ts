import type { OutfitInput, OutfitResult, OutfitItem, DangerLevel } from './types'
import type { ActivityType } from './types'
import {
  getTempZone,
  TEMP_ZONE_LABELS,
  LAYER_LEVELS,
  getBaseItems,
  getActivityItems,
  pickHeroIllust,
  generateTips,
  getMicroclimateOffset,
  getMicroclimateItems,
  getMicroclimateNote,
} from './rules'

// 활동별 낙뢰·강풍·호우 취소 여부 (기상청 낙뢰·강풍·호우 행동요령 기준)
const LIGHTNING_CANCEL_ACTIVITIES: ActivityType[] = ['golf', 'hiking', 'river', 'beach', 'running', 'cycling', 'tennis', 'picnic']
const STRONG_WIND_CANCEL_ACTIVITIES: ActivityType[] = ['golf', 'hiking', 'cycling', 'beach', 'tennis']
const HEAVY_RAIN_CANCEL_ACTIVITIES: ActivityType[] = ['hiking', 'river', 'picnic', 'beach']

interface DangerResult {
  dangerLevel: DangerLevel
  dangerReasons: string[]
  cancelActivity: boolean
}

function assessDanger(input: OutfitInput): DangerResult {
  const reasons: string[] = []
  let dangerLevel: DangerLevel = 'none'
  let cancelActivity = false

  // 우선순위 1: 낙뢰 (번개·천둥 동반 강수 — ptyCode '4'=소나기 또는 precipitation 높음 시 경고)
  const lightningRisk = input.ptyCode === '4' || (input.ptyCode === '1' && input.precipitation >= 5)
  if (lightningRisk && LIGHTNING_CANCEL_ACTIVITIES.includes(input.activity)) {
    reasons.push('⚡ 낙뢰 위험: 골프채·등산스틱·라켓 등 긴 물체를 즉시 내려놓고 안전한 건물이나 차량으로 대피하세요. (기상청 낙뢰 행동요령)')
    dangerLevel = 'cancel'
    cancelActivity = true
  }

  // 우선순위 1: 강풍경보 수준 (풍속 21m/s 이상)
  if (input.windSpeed >= 21 && STRONG_WIND_CANCEL_ACTIVITIES.includes(input.activity)) {
    reasons.push('🌪️ 강풍경보 수준 (21m/s 이상): 야외 스포츠 활동을 취소하세요. (기상청 강풍 행동요령)')
    dangerLevel = 'cancel'
    cancelActivity = true
  }

  // 우선순위 1: 호우경보 수준 (강수 + 특정 활동)
  if (input.precipitation >= 15 && HEAVY_RAIN_CANCEL_ACTIVITIES.includes(input.activity)) {
    reasons.push('🌧️ 호우 위험: 등산·강변·야영·해변 활동을 중단하고 안전한 곳으로 이동하세요. (기상청 호우 행동요령)')
    dangerLevel = 'cancel'
    cancelActivity = true
  }

  // 우선순위 2: 미세먼지·오존 매우나쁨
  if (input.dustGrade === '4') {
    if (dangerLevel === 'none') dangerLevel = 'warning'
    reasons.push('😷 미세먼지 매우나쁨: 야외 운동·장시간 실외활동을 제한하고 실내로 대체하세요. (에어코리아 미세먼지 행동요령)')
    if (['running', 'cycling', 'hiking', 'tennis'].includes(input.activity)) cancelActivity = true
  }

  // 우선순위 3: 강풍주의보 수준 (14m/s 이상) — 취소까지는 아님
  if (input.windSpeed >= 14 && input.windSpeed < 21) {
    if (dangerLevel === 'none') dangerLevel = 'warning'
    reasons.push('💨 강풍주의보 수준 (14m/s 이상): 야외활동을 자제하고 낙하물 위험 구역을 피하세요. (기상청 강풍 행동요령)')
  }

  // 우선순위 3: 폭염 경고 (체감 38°C 이상)
  if (input.feelsLike >= 38) {
    if (dangerLevel === 'none') dangerLevel = 'warning'
    reasons.push('🥵 폭염 경고: 체감온도 38°C 이상입니다. 한낮 야외활동을 멈추고 충분히 쉬세요. (기상청 폭염 특보 기준)')
  } else if (input.feelsLike >= 33) {
    if (dangerLevel === 'none') dangerLevel = 'caution'
    reasons.push('☀️ 폭염 주의: 체감온도 33°C 이상입니다. 수시 수분 섭취와 장시간 야외활동 자제가 필요합니다. (기상청 생활기상지수)')
  }

  // 우선순위 4: 자외선 매우높음 이상 (UV 8 이상)
  if (input.uvIndex >= 8) {
    if (dangerLevel === 'none') dangerLevel = 'caution'
    reasons.push('☀️ 자외선 매우높음 (UV ' + input.uvIndex + '): 오전 10시~오후 3시 외출을 피하고 긴팔·모자·선글라스·선크림이 필수입니다. (기상청 생활기상지수)')
  } else if (input.uvIndex >= 6) {
    if (dangerLevel === 'none') dangerLevel = 'caution'
    reasons.push('🌡️ 자외선 높음 (UV ' + input.uvIndex + '): 한낮에는 그늘에 머물고 긴팔·모자·선글라스·선크림을 갖추세요. (기상청 생활기상지수)')
  }

  // 미세먼지 나쁨 (취소까지는 아님)
  if (input.dustGrade === '3') {
    if (dangerLevel === 'none') dangerLevel = 'caution'
    reasons.push('😷 미세먼지 나쁨 (PM10 81~150 ㎍/㎥): 보건용 마스크(KF80 이상)를 착용하고 조깅·등산·자전거 등 호흡량 많은 운동을 줄이세요. (에어코리아 미세먼지 행동요령)')
  }

  // 오존 매우나쁨 (0.151ppm↑) — 에어코리아 오존 행동요령
  if (input.o3Grade === '4') {
    if (dangerLevel === 'none' || dangerLevel === 'caution') dangerLevel = 'warning'
    reasons.push('⚗️ 오존 매우나쁨 (0.151ppm↑): 실외활동을 최소화하세요. 민감군·노약자·어린이는 가급적 실내에 머무세요. (에어코리아 오존 행동요령)')
    if (['running', 'cycling', 'golf', 'hiking', 'tennis'].includes(input.activity)) cancelActivity = true
  } else if (input.o3Grade === '3') {
    if (dangerLevel === 'none') dangerLevel = 'caution'
    reasons.push('⚗️ 오존 나쁨 (0.091~0.150ppm): 오전 10시~오후 4시 격한 운동을 피하고 이른 아침·저녁 시간대로 조정하세요. (에어코리아 오존 행동요령)')
  }

  return { dangerLevel, dangerReasons: reasons, cancelActivity }
}

// 오존 피크 시간대(오전 10시~오후 4시)에 고강도 호흡 활동 시 표시하는 경고
// grade '3'/'4'는 assessDanger()에서 이미 처리; 이 함수는 '1'/'2' 또는 미수신 시 시간대 안내
const O3_HIGH_RESP_ACTIVITIES: ActivityType[] = ['running', 'cycling', 'hiking', 'golf', 'tennis']

function getOzoneTimeWarning(hour: number, activity: ActivityType, o3Grade?: string): string | null {
  if (hour < 10 || hour >= 16) return null
  if (!O3_HIGH_RESP_ACTIVITIES.includes(activity)) return null
  if (o3Grade === '3' || o3Grade === '4') return null  // assessDanger()에서 이미 경고 처리

  if (o3Grade === '2') {
    return '⚗️ 오존 피크 시간대 (오전 10시~오후 4시)\n현재 오존은 "보통"이지만, 이 시간대에는 지표 오존이 자연적으로 상승합니다. 달리기·등산 등 호흡량이 많은 활동은 오전 10시 이전이나 오후 4시 이후로 조정하면 더 안전합니다. (에어코리아 오존 행동요령)'
  }

  // o3Grade '1'(좋음) 또는 미수신
  return '⚗️ 오존 피크 시간대 (오전 10시~오후 4시)\n현재 오존 수치는 양호합니다. 다만 이 시간대에는 햇빛·고온 조건에서 오존이 생성될 수 있어, 장시간 고강도 야외 운동 시 참고하세요. (에어코리아 오존 행동요령)'
}

export function recommendOutfit(input: OutfitInput): OutfitResult {
  // 위험 우선순위 판단 (참고: weather-outdoor-clothing-guide.md 라. 복장 추천 로직 §1)
  const danger = assessDanger(input)

  // 장소 미기후 보정: 강바람·고도·해풍 등을 반영해 체감온도 조정
  const microOffset = getMicroclimateOffset(input.activity)
  const flZone = microOffset !== 0 ? input.feelsLike + microOffset : input.feelsLike
  const baseZone = getTempZone(input.feelsLike)
  const zone = getTempZone(flZone)

  // Collect all items
  const baseItems = getBaseItems(zone, input.gender, input.activity, flZone, input.uvIndex)
  const activityItems = getActivityItems(input.activity, zone, input.gender, input.uvIndex)
  const microclimateItems = getMicroclimateItems(input.activity, baseZone, input.gender)

  // Deduplicate by id
  const seen = new Set<string>()
  const allItems: OutfitItem[] = []
  for (const item of [...baseItems, ...activityItems, ...microclimateItems]) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      allItems.push(item)
    }
  }

  const pushCorr = (item: OutfitItem) => {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      allItems.push(item)
    }
  }

  // 가이드 다.3: UV 6↑ — 긴팔·팔토시, 모자 (28℃+는 getBaseItems에 모자·선글라스 있음)
  if (input.uvIndex >= 6 && !['beach', 'ski'].includes(input.activity)) {
    pushCorr({
      id: 'corr-uv-sleeves',
      name: '긴팔 겉옷',
      icon: '👕',
      category: 'top',
      required: input.uvIndex >= 8,
      condition: 'UV ' + input.uvIndex + ' — 기상청 생활기상지수(높음 이상)',
    })
    if (zone !== 'hot') {
      pushCorr({
        id: 'corr-uv-widehat',
        name: '모자',
        icon: '👒',
        category: 'acc',
        required: false,
        condition: 'UV 6 이상',
      })
    }
  }

  // 가이드 다.3·라.2: 풍속 5m/s↑ 방풍 외피 (강변·등산은 getMicroclimateItems에서 이미 방풍 권장)
  const skipFiveMWindOuter =
    (input.activity === 'river' && ['hot', 'warm', 'mild'].includes(baseZone)) ||
    (input.activity === 'hiking' && ['hot', 'warm', 'mild'].includes(baseZone))
  if (input.windSpeed >= 5 && !skipFiveMWindOuter && ['warm', 'mild'].includes(zone)) {
    pushCorr({
      id: 'corr-wind-fives',
      name: '얇은 바람막이',
      icon: '💨',
      category: 'outer',
      required: false,
      condition: zone === 'mild' ? '풍속 5m/s 이상 — 가이드 라.2(18~22℃) 방풍 외피 권장' : '풍속 5m/s 이상 — 가이드 다.3',
    })
  }

  // 가이드 라.2: 6~11℃ + 바람 강하면 목도리·장갑·비니
  if (zone === 'cold' && input.windSpeed >= 5 && input.activity !== 'ski') {
    pushCorr({ id: 'corr-cold-wind-scarf', name: '목도리', icon: '🧣', category: 'acc', required: false, condition: '바람 강함 + 추운 구간' })
    pushCorr({ id: 'corr-cold-wind-gloves', name: '장갑', icon: '🧤', category: 'acc', required: false, condition: '바람 강함 + 추운 구간' })
    pushCorr({ id: 'corr-cold-wind-beanie', name: '비니 / 니트 모자', icon: '🎓', category: 'acc', required: false, condition: '바람 강함 + 추운 구간' })
  }

  // 가이드 라.2: 0~5℃ 장시간 야외 시 방한화·귀마개
  if (zone === 'freezing' && flZone >= 0 && flZone < 6 && input.duration >= 2 && input.activity !== 'ski') {
    pushCorr({
      id: 'corr-freeze-duration-boots',
      name: '방한화',
      icon: '🥾',
      category: 'foot',
      required: false,
      condition: '장시간 야외(2시간↑) — 가이드 라.2',
    })
    pushCorr({
      id: 'corr-freeze-duration-ear',
      name: '귀마개 / 이어워머',
      icon: '🎓',
      category: 'acc',
      required: false,
      condition: '장시간 야외(2시간↑) — 가이드 라.2',
    })
  }

  // Rain / snow items
  // 기상청 강우 강도 분류(시간당 강수량): 약한 비 <3mm, 보통 비 3~15mm, 강한 비 ≥15mm
  // 사용자 피드백 반영(2026-05): 약한~보통 비 초반(<7mm/h)에서는 우산만으로 충분.
  //  - 우의(비옷)·방수 신발 옵션은 보통 비 후반(≥7mm/h)부터 권장
  //  - 낙뢰 위험 우의 필수(우산 사용 자제) 임계도 강수 ≥10mm/h로 상향
  const RAIN_GEAR_THRESHOLD_MMH = 7
  const LIGHTNING_PRECIP_MMH = 10
  const rainAlert = input.ptyCode !== '0'
  if (rainAlert) {
    if (input.ptyCode === '1' || input.ptyCode === '4') {
      // 낙뢰 위험 시 우산보다 비옷 권장 (기상청 낙뢰 행동요령)
      // ptyCode '4'(소나기) 자체로는 낙뢰가 즉시 위험하지 않음 — 강수 ≥10mm/h 또는 강한 비일 때만 우의 필수
      const lightningRisk = input.precipitation >= LIGHTNING_PRECIP_MMH
      if (lightningRisk) {
        allItems.push({ id: 'rain-coat', name: '우의', icon: '🌂', category: 'rain', required: true, condition: `강한 비(${LIGHTNING_PRECIP_MMH}mm/h↑)·낙뢰 위험 시 우산 사용 자제` })
      } else {
        allItems.push({ id: 'rain-umbrella', name: '우산', icon: '☂️', category: 'rain', required: true })
        if (input.precipitation >= RAIN_GEAR_THRESHOLD_MMH) {
          allItems.push({ id: 'rain-coat', name: '우의', icon: '🌂', category: 'rain', required: false, condition: `보통 비 후반(${RAIN_GEAR_THRESHOLD_MMH}mm/h↑) — 우산만으론 부족할 때 선택` })
        }
      }
      if (input.precipitation >= RAIN_GEAR_THRESHOLD_MMH) {
        allItems.push({ id: 'rain-shoes', name: '방수 신발', icon: '🥾', category: 'foot', required: false, condition: `보통 비 후반(${RAIN_GEAR_THRESHOLD_MMH}mm/h↑) — 젖은 노면 안전` })
      }
    } else if (input.ptyCode === '3' || input.ptyCode === '2') {
      allItems.push({ id: 'rain-boots', name: '방수 신발', icon: '🥾', category: 'foot', required: true })
    }
  }

  // Mask items — 자료 기준: PM10 81↑(나쁨)=KF80, 매우나쁨=KF94
  const dustAlert = input.dustGrade === '3' || input.dustGrade === '4'
  if (dustAlert) {
    allItems.push({
      id: 'mask-dust',
      name: '보건용 마스크',
      icon: '😷',
      category: 'mask',
      required: input.dustGrade === '4',
      condition: input.dustGrade === '4'
        ? '미세먼지 매우나쁨 — KF94 필수 (에어코리아)'
        : '미세먼지 나쁨 — KF80 이상 권장 (에어코리아)',
    })
  }

  // Sun cream — UV 6 이상 또는 해변
  const uvAlert = input.uvIndex >= 6 || input.activity === 'beach'
  if (uvAlert && input.activity !== 'beach') {
    allItems.push({
      id: 'acc-suncream',
      name: '선크림',
      icon: '🧴',
      category: 'acc',
      required: input.uvIndex >= 8,
      condition: input.uvIndex >= 8
        ? 'UV 매우높음 — 외출 시 필수 (기상청 생활기상지수)'
        : 'UV 높음 — 외출 30분 전 도포 권장',
    })
  }

  // UI 배지: 강풍주의보 수준(육상 14m/s↑) — 가이드 다.6·라. 보정표
  const windAlert = input.windSpeed >= 14

  const heroIllust = pickHeroIllust(zone, input.activity, input.ptyCode)

  const tips = generateTips(
    zone,
    input.uvIndex,
    input.dustGrade,
    input.windSpeed,
    input.activity,
    input.terrain,
    input.duration,
    input.precipitation,
    input.feelsLike,
    input.humidity,
    input.temperature,
    input.o3Grade,
  )

  const microclimateNote = getMicroclimateNote(input.activity)

  return {
    items: allItems,
    heroIllust,
    layerLevel: LAYER_LEVELS[zone],
    layerLabel: TEMP_ZONE_LABELS[zone],
    tempZone: zone,
    uvAlert,
    dustAlert,
    rainAlert,
    windAlert,
    precipitation: input.precipitation,
    tips,
    microclimateNote,
    dangerLevel: danger.dangerLevel,
    dangerReasons: danger.dangerReasons,
    cancelActivity: danger.cancelActivity,
    ozoneTimeWarning: getOzoneTimeWarning(input.hour, input.activity, input.o3Grade),
  }
}
