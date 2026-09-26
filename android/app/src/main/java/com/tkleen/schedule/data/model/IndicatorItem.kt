package com.tkleen.schedule.data.model

import org.json.JSONArray
import java.text.DecimalFormat

/**
 * GET /api/widget/fx 응답 indicators 1행 — MarketIndicator와 1:1.
 *
 *  환율 위젯에 곁들이는 시장지표(요구: 국내 금·브렌트유·미 10년 국채금리).
 *  값·단위·출처를 **서버가 정해 보낸다** — 폰은 그리기만 한다. 출처를 함께
 *  받는 이유는 같은 이름이라도 소스가 다르면 숫자가 다르기 때문이다(요구로 화면에 표시).
 */
data class IndicatorItem(
    val key: String,
    val name: String,
    val value: Double,
    val unit: String,
    val changePct: Double?,
    val source: String,
) {
    /** "189,500 원/g" · "104.32 USD/배럴" · "5.18%"(퍼센트는 붙여 쓴다). */
    fun valueText(): String =
        NUM.format(value) + (if (unit.startsWith("%")) unit else " $unit")

    fun pctText(): String? = changePct?.let { String.format("%+.2f%%", it) }

    companion object {
        private val NUM = DecimalFormat("#,##0.##")

        fun listFromJson(json: String): List<IndicatorItem> {
            val arr = JSONArray(json)
            val out = ArrayList<IndicatorItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val key = o.optString("key", "")
                if (key.isEmpty()) continue
                out.add(
                    IndicatorItem(
                        key = key,
                        name = o.optString("name", key),
                        value = o.optDouble("value", 0.0),
                        unit = o.optString("unit", ""),
                        changePct = if (o.isNull("changePct")) null else {
                            o.optDouble("changePct").takeIf { !it.isNaN() }
                        },
                        source = o.optString("source", ""),
                    ),
                )
            }
            return out
        }
    }
}
