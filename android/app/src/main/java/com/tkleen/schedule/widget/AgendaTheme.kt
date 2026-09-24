package com.tkleen.schedule.widget

import androidx.compose.ui.graphics.Color
import androidx.glance.color.ColorProvider
import androidx.glance.unit.ColorProvider as solidColor

/**
 * 위젯 브랜드 토큰(계획서 §P3 브랜드 적용).
 * 강조 tkLeen Sky Blue #4A90C2 고정, 배경 라이트 #FFFFFF / 다크 #16191C.
 * Glance의 day/night ColorProvider가 res/values-night 분리를 대신한다.
 */
object AgendaTheme {
    val accent = Color(0xFF4A90C2)
    val accentProvider = solidColor(accent)

    val bg = ColorProvider(day = Color(0xFFFFFFFF), night = Color(0xFF16191C))
    /**
     * 노트 위젯 전용 배경 — 홈 화면에 작업 위젯과 나란히 놓였을 때 한눈에
     * 구분되도록 살짝 회색을 넣는다(요구). 라이트는 흰색보다 한 톤 어둡게,
     * 다크는 반대로 한 톤 밝게 해야 차이가 보인다.
     */
    val bgNote = ColorProvider(day = Color(0xFFF1F3F5), night = Color(0xFF20252B))
    val text = ColorProvider(day = Color(0xFF1B2845), night = Color(0xFFECEFF4))
    val textDim = ColorProvider(day = Color(0xFF64748B), night = Color(0xFF9AA5B1))
    /** 삭제 예정 등 파괴적 상태 표시. */
    val danger = ColorProvider(day = Color(0xFFDC2626), night = Color(0xFFF87171))

    /**
     * 시세 등락 — **한국 관례대로 상승 빨강 · 하락 파랑**(웹의 --positive/--negative와
     * 같은 방향). 다크에서는 같은 계열을 밝게 올려 배경에 묻히지 않게 한다.
     */
    val up = ColorProvider(day = Color(0xFFD12C2C), night = Color(0xFFFF7A7A))
    val down = ColorProvider(day = Color(0xFF1E5FD6), night = Color(0xFF7AAEFF))

    /** 시간외 표식(PRE·시간외·AFTER) — 값이 정규장 밖에서 나왔다는 주의 표시. */
    val warn = ColorProvider(day = Color(0xFFB45309), night = Color(0xFFFBBF24))

    /** 대상 색(pb_circle_targets.color, hex 문자열) — 파싱 실패·미지정은 강조색. */
    fun tokenColor(token: String?): Color {
        if (token.isNullOrBlank()) return accent
        return try {
            Color(android.graphics.Color.parseColor(token))
        } catch (e: IllegalArgumentException) {
            accent
        }
    }
}
