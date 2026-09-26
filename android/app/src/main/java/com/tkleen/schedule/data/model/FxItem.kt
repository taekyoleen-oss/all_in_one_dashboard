package com.tkleen.schedule.data.model

import org.json.JSONArray
import java.text.DecimalFormat

/**
 * GET /api/widget/fx 응답 items 1행 — WidgetFxItem과 1:1.
 *
 *  환산·전일대비 부호는 **서버가 이미 끝냈다**(웹 위젯과 같은 fxRows). 폰은 그대로
 *  그리기만 한다 — 양쪽에서 따로 계산하면 숫자가 갈라진다.
 */
data class FxItem(
    val code: String,
    val unit: Int,
    val krw: Double,
    val changePct: Double?, // null = 전일 대비를 알 수 없음
    /** 환율 정보 웹페이지(요구) — 서버가 웹과 같은 `fxInfoUrl`로 만들어 준 값. */
    val infoUrl: String? = null,
) {
    /** "USD" / "100 JPY" — 엔만 100 단위로 보는 관례. */
    fun label(): String = if (unit == 1) code else "$unit $code"

    fun krwText(): String = KRW.format(krw) + "원"

    fun pctText(): String? = changePct?.let { String.format("%+.2f%%", it) }

    /**
     * 환전 계산(요구: 접힌 환율 위젯이 계산기) — `krw`는 **unit 단위당 원**이므로
     * 1단위 값은 krw/unit이다. 엔(unit=100)에서 100배 틀리는 실수를 막으려고
     * 두 방향을 여기 한 곳에 둔다.
     */
    fun wonToForeign(won: Double): Double = if (krw <= 0) 0.0 else won * unit / krw

    fun foreignToWon(amount: Double): Double = amount * krw / unit

    companion object {
        private val KRW = DecimalFormat("#,##0.00")

        /** 낙관적 캐시 갱신용(삭제 즉시 반영) — listFromJson과 왕복 가능. */
        fun listToJson(items: List<FxItem>): String {
            val arr = JSONArray()
            for (f in items) {
                val o = org.json.JSONObject()
                    .put("code", f.code).put("unit", f.unit).put("krw", f.krw)
                if (f.changePct != null) o.put("changePct", f.changePct)
                if (f.infoUrl != null) o.put("infoUrl", f.infoUrl)
                arr.put(o)
            }
            return arr.toString()
        }

        fun listFromJson(itemsJson: String): List<FxItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<FxItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val code = o.optString("code", "")
                if (code.isEmpty()) continue
                out.add(
                    FxItem(
                        code = code,
                        unit = o.optInt("unit", 1),
                        krw = o.optDouble("krw", 0.0),
                        changePct = if (o.isNull("changePct")) null else {
                            o.optDouble("changePct").takeIf { !it.isNaN() }
                        },
                        infoUrl = o.optString("infoUrl").takeIf {
                            it.isNotEmpty() && !o.isNull("infoUrl")
                        },
                    ),
                )
            }
            return out
        }
    }
}
