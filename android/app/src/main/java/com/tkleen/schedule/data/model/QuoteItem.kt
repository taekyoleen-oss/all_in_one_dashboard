package com.tkleen.schedule.data.model

import org.json.JSONArray
import java.text.DecimalFormat

/**
 * GET /api/widget/stocks 응답 items 1행 — WidgetStockQuote와 1:1.
 *
 *  폰은 **보기 전용**이라 계산을 하지 않는다. 표시 문자열만 여기서 만든다.
 *  `session`은 정규장 **밖**에서 나온 값일 때만 채워진다("pre"·"post").
 */
data class QuoteItem(
    val symbol: String,
    val name: String,
    val price: Double,
    val change: Double,
    val changePct: Double,
    val currency: String,
    val isIndex: Boolean,
    val session: String?, // "pre" | "post" | null(정규장)
) {
    /** 원화는 소수점 없이, 그 외 통화는 두 자리까지(달러·지수 소수 보존). */
    fun priceText(): String =
        (if (currency == "KRW") KRW else DEC).format(price)

    /** "+1.23%" / "-0.40%" — 부호를 항상 붙여 방향이 글자로도 드러나게. */
    fun pctText(): String = String.format("%+.2f%%", changePct)

    /**
     * 시간외 표식(요구: "pre 등을 표시"). 국내는 '시간외 단일가'가 익숙한 이름이라
     * 그대로 쓰고, 미국은 PRE/AFTER. 웹 format.ts의 sessionLabel과 같은 규칙.
     */
    fun sessionLabel(): String? = when (session) {
        "pre" -> "PRE"
        "post" -> if (symbol.matches(DOMESTIC)) "시간외" else "AFTER"
        else -> null
    }

    companion object {
        private val KRW = DecimalFormat("#,##0")
        private val DEC = DecimalFormat("#,##0.00")

        /** 국내 종목 코드(6자리 숫자) — 웹 isDomesticSymbol과 같은 판정. */
        private val DOMESTIC = Regex("^[0-9]{6}$")

        /** 낙관적 캐시 갱신용(삭제 즉시 반영) — listFromJson과 왕복 가능. */
        fun listToJson(items: List<QuoteItem>): String {
            val arr = JSONArray()
            for (q in items) {
                val o = org.json.JSONObject()
                    .put("symbol", q.symbol).put("name", q.name)
                    .put("price", q.price).put("change", q.change)
                    .put("changePct", q.changePct).put("currency", q.currency)
                    .put("isIndex", q.isIndex)
                if (q.session != null) o.put("session", q.session)
                arr.put(o)
            }
            return arr.toString()
        }

        fun listFromJson(itemsJson: String): List<QuoteItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<QuoteItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val symbol = o.optString("symbol", "")
                if (symbol.isEmpty()) continue
                out.add(
                    QuoteItem(
                        symbol = symbol,
                        name = o.optString("name", symbol),
                        price = o.optDouble("price", 0.0),
                        change = o.optDouble("change", 0.0),
                        changePct = o.optDouble("changePct", 0.0),
                        currency = o.optString("currency", "KRW"),
                        isIndex = o.optBoolean("isIndex", false),
                        session = o.optString("session").takeIf {
                            it.isNotEmpty() && !o.isNull("session")
                        },
                    ),
                )
            }
            return out
        }
    }
}
