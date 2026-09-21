package com.tkleen.schedule.widget

import androidx.compose.ui.graphics.Color
import androidx.glance.color.ColorProvider as dayNightColor
import androidx.glance.unit.ColorProvider

/**
 * 폰 위젯 표시 설정 — **글자 크기 5단계 · 배경 5색 · 항목 글자색 5색**(요구).
 *
 *  전부 **이 폰에만** 남는다(WidgetStore = SharedPreferences). 웹과 동기화하지
 *  않는 이유: 보는 크기·배경은 화면마다 다른 취향이고, 서버로 올리면 pb_widgets
 *  config 경합(디바운스 되덮기)과 마이그레이션을 새로 떠안는다. 요구도
 *  "해당 핸드폰에서" 바꾸는 것이다.
 *
 *  라이트/다크를 쌍으로 준다 — 한쪽만 정하면 반대 테마에서 글자가 배경에 묻는다.
 */
object WidgetStyle {
    /* ── 글자 크기 ─────────────────────────────────────────────────────── */

    val TEXT_LABELS = listOf("아주 작게", "작게", "보통", "크게", "아주 크게")
    /** 본문 기준 sp — 지금까지의 크기가 '보통'(15sp)이다. */
    private val TEXT_SP = listOf(12f, 13.5f, 15f, 17f, 19f)
    const val DEFAULT_TEXT = 2

    fun bodySp(level: Int): Float = TEXT_SP.getOrElse(level) { TEXT_SP[DEFAULT_TEXT] }

    /**
     * 본문 외 글자(상태 라벨·🖼·› 등)를 같은 비율로 키운다 — 기준은 본문 15sp.
     * 헤더(제목·필터·갱신 시각)는 건드리지 않는다(v16 '본문만' 규약 그대로).
     */
    fun scaled(level: Int, base: Float): Float = base * bodySp(level) / 15f

    /* ── 배경색 ────────────────────────────────────────────────────────── */

    /** 0 = 기본(위젯 고유 배경 — 작업=흰색, 노트=옅은 회색). */
    val BG_LABELS = listOf("기본", "흰색", "회색", "크림", "하늘")
    private val BG_DAY = listOf(0L, 0xFFFFFFFF, 0xFFE9ECEF, 0xFFFDF3E0, 0xFFE3F0FA)
    private val BG_NIGHT = listOf(0L, 0xFF0F1214, 0xFF2A2F35, 0xFF2C2519, 0xFF16232E)

    fun background(index: Int, fallback: ColorProvider): ColorProvider =
        if (index <= 0 || index >= BG_LABELS.size) fallback
        else dayNightColor(day = Color(BG_DAY[index]), night = Color(BG_NIGHT[index]))

    /* ── 항목 글자색 ───────────────────────────────────────────────────── */

    /** 0 = 기본(테마 글자색). 작업 한 건·소제목 한 건마다 고를 수 있다(요구). */
    val ITEM_LABELS = listOf("기본", "빨강", "주황", "초록", "파랑")
    private val ITEM_DAY = listOf(0L, 0xFFDC2626, 0xFFC2410C, 0xFF047857, 0xFF1D4ED8)
    private val ITEM_NIGHT = listOf(0L, 0xFFF87171, 0xFFFB923C, 0xFF34D399, 0xFF60A5FA)

    fun itemColor(index: Int, fallback: ColorProvider): ColorProvider =
        if (index <= 0 || index >= ITEM_LABELS.size) fallback
        else dayNightColor(day = Color(ITEM_DAY[index]), night = Color(ITEM_NIGHT[index]))

    /* ── 설정·수정 화면(일반 View)용 ARGB — 0(기본)은 호출측이 채운다 ────── */

    fun itemArgb(index: Int, night: Boolean): Int =
        (if (night) ITEM_NIGHT else ITEM_DAY).getOrElse(index) { 0L }.toInt()

    fun bgArgb(index: Int, night: Boolean): Int =
        (if (night) BG_NIGHT else BG_DAY).getOrElse(index) { 0L }.toInt()

    /** 표 길이가 어긋나면 어떤 기기에서 IndexOutOfBounds가 난다 — 클래스 로드 때 잡는다. */
    init {
        require(TEXT_LABELS.size == TEXT_SP.size) { "글자 크기 표 불일치" }
        require(BG_LABELS.size == BG_DAY.size && BG_DAY.size == BG_NIGHT.size) { "배경 표 불일치" }
        require(ITEM_LABELS.size == ITEM_DAY.size && ITEM_DAY.size == ITEM_NIGHT.size) { "글자색 표 불일치" }
    }
}
