/**
 * 복장 캐릭터 프레임 뒤에 깔리는 반투명 날씨 데코 SVG.
 * - 색상 틴트 배경 사각형은 사용하지 않음 (모바일에서 푸른 박스처럼 두드러져 제외).
 * - 데코 요소(구름·빗방울·눈송이·해·바람선)만 표시해 캐릭터 실루엣과 자연스럽게 합성.
 * - 데코는 상단·외곽으로 집중, 알파 ≤0.65 — 캐릭터에 `mix-blend-mode: darken` 적용 시 적정 가시성.
 */
import type { PtyCode, SkyCode } from './types'

export type WeatherBgMode =
  | 'rain-light'
  | 'rain-heavy'
  | 'snow'
  | 'sunny'
  | 'sunny-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'windy'
  | 'none'

/**
 * 우선순위:
 * 1. 강설(ptyCode 2/3) → snow
 * 2. 강수(ptyCode 1/4) → rain-light/rain-heavy (강수량 3mm/h 분기)
 * 3. 강풍 → windy
 * 4. 맑음(skyCode 1 또는 showSunshine) → sunny / sunny-night (isNight)
 * 5. 구름많음(skyCode 3) → partly-cloudy / partly-cloudy-night (isNight)
 * 6. 흐림(skyCode 4) → cloudy (밤낮 동일 — 달이 가려 보이지 않음)
 * 7. 데이터 없음 → none
 */
export function resolveWeatherBgMode(params: {
  ptyCode?: PtyCode
  skyCode?: SkyCode
  precipitation?: number
  showSunshine?: boolean
  windAlert?: boolean
  isNight?: boolean
}): WeatherBgMode {
  const { ptyCode, skyCode, precipitation = 0, showSunshine, windAlert, isNight } = params
  if (ptyCode === '3' || ptyCode === '2') return 'snow'
  if (ptyCode === '1' || ptyCode === '4') {
    return precipitation >= 3 ? 'rain-heavy' : 'rain-light'
  }
  if (windAlert) return 'windy'
  if (showSunshine || skyCode === '1') return isNight ? 'sunny-night' : 'sunny'
  if (skyCode === '3') return isNight ? 'partly-cloudy-night' : 'partly-cloudy'
  if (skyCode === '4') return 'cloudy'
  return 'none'
}

interface Props {
  mode: WeatherBgMode
  className?: string
}

/** 200×296 viewBox: 캐릭터 PNG 비율과 동일. slice로 프레임 채움 */
const VB_W = 200
const VB_H = 296

export function WeatherCharBg({ mode, className }: Props) {
  if (mode === 'none') return null

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      className={className}
      aria-hidden
      focusable={false}
    >
      {mode === 'rain-light' && <RainLightLayer />}
      {mode === 'rain-heavy' && <RainHeavyLayer />}
      {mode === 'snow' && <SnowLayer />}
      {mode === 'sunny' && <SunnyLayer />}
      {mode === 'sunny-night' && <NightClearLayer />}
      {mode === 'partly-cloudy' && <PartlyCloudyLayer />}
      {mode === 'partly-cloudy-night' && <NightPartlyCloudyLayer />}
      {mode === 'cloudy' && <CloudyLayer />}
      {mode === 'windy' && <WindyLayer />}
    </svg>
  )
}

function RainLightLayer() {
  const blue = '#5B8DEE'
  return (
    <g>
      {/* 옅은 구름 */}
      <path
        d="M 28 30 C 18 30 14 22 22 18 C 20 10 36 6 44 14 C 52 6 70 12 70 22 C 80 22 84 32 74 36 L 32 36 C 22 38 18 32 28 30 Z"
        fill={blue}
        opacity="0.18"
      />
      {/* 빗방울 — 상단 1/3 영역, 비스듬하게 */}
      {RAIN_DROP_LIGHT.map(([x, y, l], i) => (
        <line
          key={i}
          x1={x}
          y1={y}
          x2={x - 4}
          y2={y + l}
          stroke={blue}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
      ))}
    </g>
  )
}

function RainHeavyLayer() {
  const blue = '#3B6FD8'
  return (
    <g>
      {/* 짙은 구름 두 덩이 */}
      <path
        d="M 18 26 C 8 26 4 18 12 14 C 10 6 26 2 34 10 C 42 2 60 8 60 18 C 70 18 74 28 64 32 L 22 32 C 12 34 8 28 18 26 Z"
        fill={blue}
        opacity="0.26"
      />
      <path
        d="M 118 42 C 110 42 106 34 112 30 C 110 22 124 18 132 24 C 140 18 156 24 156 32 C 166 32 168 42 158 46 L 122 46 C 114 48 110 44 118 42 Z"
        fill={blue}
        opacity="0.20"
      />
      {/* 빗방울 — 더 많고 길게, 상단 절반 */}
      {RAIN_DROP_HEAVY.map(([x, y, l], i) => (
        <line
          key={i}
          x1={x}
          y1={y}
          x2={x - 5}
          y2={y + l}
          stroke={blue}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
      ))}
    </g>
  )
}

function SnowLayer() {
  const slate = '#94A3B8'
  const white = '#FFFFFF'
  return (
    <g>
      {/* 부드러운 구름 */}
      <path
        d="M 22 28 C 12 28 8 20 16 16 C 14 8 30 4 38 12 C 46 4 64 10 64 20 C 74 20 78 30 68 34 L 26 34 C 16 36 12 30 22 28 Z"
        fill={slate}
        opacity="0.22"
      />
      {/* 눈송이 — 흰 원 + 회색 외곽, 상·중단 영역 */}
      {SNOW_FLAKES.map(([cx, cy, r], i) => (
        <g key={i} opacity="0.65">
          <circle cx={cx} cy={cy} r={r} fill={white} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={slate} strokeWidth="0.8" opacity="0.55" />
        </g>
      ))}
    </g>
  )
}

function SunnyLayer() {
  const gold = '#F59E0B'
  const cream = '#FCD34D'
  return (
    <g>
      {/* 태양 디스크 */}
      <circle cx={156} cy={50} r={20} fill={cream} opacity="0.55" />
      <circle cx={156} cy={50} r={14} fill={gold} opacity="0.35" />
      {/* 햇살 광선 — 우상단에서 방사 */}
      {SUN_RAYS.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={gold}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.45"
        />
      ))}
    </g>
  )
}

function PartlyCloudyLayer() {
  const gold = '#F59E0B'
  const cream = '#FCD34D'
  const cloud = '#94A3B8'
  return (
    <g>
      {/* 작은 해 (좌상단) */}
      <circle cx={42} cy={38} r={14} fill={cream} opacity="0.45" />
      <circle cx={42} cy={38} r={9} fill={gold} opacity="0.30" />
      {/* 우상단 구름 한 덩이 */}
      <path
        d="M 118 36 C 110 36 106 28 112 24 C 110 16 124 12 132 20 C 140 12 156 18 156 26 C 166 26 168 36 158 40 L 122 40 C 114 42 110 38 118 36 Z"
        fill={cloud}
        opacity="0.30"
      />
      {/* 우하단 보조 구름 */}
      <path
        d="M 80 88 C 74 88 70 82 74 78 C 72 72 84 70 90 74 C 96 70 108 74 108 82 C 116 82 118 90 110 92 L 84 92 C 76 94 74 90 80 88 Z"
        fill={cloud}
        opacity="0.22"
      />
    </g>
  )
}

/** 밤·맑음 — 초승달(crescent) + 잔별 */
function NightClearLayer() {
  const moonFill = '#E5E7EB'
  const moonStroke = '#64748B'
  const starColor = '#94A3B8'
  return (
    <g>
      {/* 초승달: 외원에서 내원을 잘라낸 마스크로 표현 */}
      <defs>
        <mask id="wf-moon-mask">
          <rect width={VB_W} height={VB_H} fill="#000" />
          <circle cx={156} cy={50} r={18} fill="#FFF" />
          <circle cx={148} cy={46} r={16} fill="#000" />
        </mask>
      </defs>
      <g mask="url(#wf-moon-mask)">
        <circle cx={156} cy={50} r={18} fill={moonFill} opacity="0.85" />
      </g>
      <circle
        cx={156}
        cy={50}
        r={18}
        fill="none"
        stroke={moonStroke}
        strokeWidth="1"
        opacity="0.35"
      />
      {/* 별 */}
      {NIGHT_STARS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={starColor} opacity="0.55" />
      ))}
    </g>
  )
}

/** 밤·구름많음 — 달 + 우상단 구름 (구름이 달 일부를 가림) */
function NightPartlyCloudyLayer() {
  const moonFill = '#E5E7EB'
  const moonStroke = '#64748B'
  const starColor = '#94A3B8'
  const cloud = '#64748B'
  return (
    <g>
      <defs>
        <mask id="wf-moon-mask-pc">
          <rect width={VB_W} height={VB_H} fill="#000" />
          <circle cx={44} cy={40} r={14} fill="#FFF" />
          <circle cx={38} cy={37} r={12} fill="#000" />
        </mask>
      </defs>
      {/* 좌상단 달 */}
      <g mask="url(#wf-moon-mask-pc)">
        <circle cx={44} cy={40} r={14} fill={moonFill} opacity="0.78" />
      </g>
      <circle cx={44} cy={40} r={14} fill="none" stroke={moonStroke} strokeWidth="1" opacity="0.35" />
      {/* 우상단 구름 */}
      <path
        d="M 118 38 C 110 38 106 30 112 26 C 110 18 124 14 132 22 C 140 14 156 20 156 28 C 166 28 168 38 158 42 L 122 42 C 114 44 110 40 118 38 Z"
        fill={cloud}
        opacity="0.32"
      />
      {/* 잔별 (적게) */}
      {NIGHT_STARS_SPARSE.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={starColor} opacity="0.45" />
      ))}
    </g>
  )
}

function CloudyLayer() {
  const gray = '#94A3B8'
  return (
    <g>
      {/* 큰 구름 — 좌상단 */}
      <path
        d="M 18 36 C 8 36 4 26 12 22 C 10 12 28 8 36 16 C 44 8 64 14 64 24 C 76 24 80 36 70 40 L 26 40 C 14 42 8 36 18 36 Z"
        fill={gray}
        opacity="0.35"
      />
      {/* 중간 구름 — 우상단 */}
      <path
        d="M 118 64 C 110 64 106 56 112 52 C 110 44 124 40 132 48 C 140 40 156 46 156 54 C 166 54 168 64 158 68 L 122 68 C 114 70 110 66 118 64 Z"
        fill={gray}
        opacity="0.28"
      />
      {/* 하단 작은 구름 */}
      <path
        d="M 60 132 C 54 132 50 126 54 122 C 52 116 64 114 70 118 C 76 114 88 118 88 126 C 96 126 98 134 90 136 L 64 136 C 56 138 54 134 60 132 Z"
        fill={gray}
        opacity="0.22"
      />
    </g>
  )
}

function WindyLayer() {
  const teal = '#7EC8C8'
  return (
    <g>
      {/* 부드러운 바람 곡선 — 좌→우 흐름, 상·중단 */}
      {WIND_CURVES.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={teal}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.50"
        />
      ))}
    </g>
  )
}

// 좌표 테이블 — [x, y, length]
const RAIN_DROP_LIGHT: [number, number, number][] = [
  [40, 50, 10],
  [62, 64, 10],
  [88, 52, 10],
  [110, 70, 10],
  [134, 56, 10],
  [156, 72, 10],
  [180, 60, 10],
  [50, 82, 10],
  [96, 88, 10],
  [144, 92, 10],
]

const RAIN_DROP_HEAVY: [number, number, number][] = [
  [30, 56, 14],
  [50, 72, 14],
  [70, 60, 14],
  [90, 80, 14],
  [110, 64, 14],
  [130, 84, 14],
  [150, 70, 14],
  [170, 90, 14],
  [40, 100, 14],
  [80, 108, 14],
  [120, 104, 14],
  [160, 112, 14],
  [60, 128, 14],
  [100, 132, 14],
  [140, 134, 14],
]

// [cx, cy, r]
const SNOW_FLAKES: [number, number, number][] = [
  [36, 52, 3.2],
  [62, 70, 2.4],
  [88, 56, 3.0],
  [114, 74, 2.6],
  [140, 60, 3.2],
  [166, 76, 2.4],
  [50, 96, 2.8],
  [94, 102, 3.0],
  [138, 104, 2.6],
  [178, 100, 3.0],
  [28, 124, 2.4],
  [110, 130, 2.8],
  [156, 134, 2.4],
]

// 햇살 광선 — 우상단 156,50 중심에서 방사
const SUN_RAYS: [number, number, number, number][] = [
  [156, 18, 156, 26],
  [180, 30, 188, 22],
  [186, 50, 196, 50],
  [180, 70, 188, 78],
  [132, 30, 124, 22],
  [126, 50, 116, 50],
  [132, 70, 124, 78],
  [156, 82, 156, 90],
]

// 밤 잔별 — [x, y, r]
const NIGHT_STARS: [number, number, number][] = [
  [28, 32, 1.4],
  [68, 22, 1.1],
  [98, 36, 1.3],
  [118, 20, 1.0],
  [134, 60, 1.0],
  [186, 22, 1.2],
  [44, 70, 1.0],
  [82, 78, 1.2],
  [180, 78, 1.0],
]

const NIGHT_STARS_SPARSE: [number, number, number][] = [
  [82, 22, 1.0],
  [100, 60, 1.0],
  [176, 60, 1.0],
]

const WIND_CURVES: string[] = [
  'M 12 70 Q 60 60 100 72 T 192 70',
  'M 12 102 Q 50 92 90 100 T 168 100',
  'M 24 138 Q 70 130 110 140 T 192 138',
  'M 12 178 Q 60 170 100 178 T 188 174',
]
