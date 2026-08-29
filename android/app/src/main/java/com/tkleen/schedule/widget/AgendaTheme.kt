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
    val text = ColorProvider(day = Color(0xFF1B2845), night = Color(0xFFECEFF4))
    val textDim = ColorProvider(day = Color(0xFF64748B), night = Color(0xFF9AA5B1))
    /** 삭제 예정 등 파괴적 상태 표시. */
    val danger = ColorProvider(day = Color(0xFFDC2626), night = Color(0xFFF87171))

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
