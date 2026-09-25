package com.tkleen.schedule.quotes

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity

/**
 * 종목·통화 추가 화면 — 주식/환율 위젯 헤더의 ＋가 연다(요구: 폰에서도 추가).
 *
 *  **주식**: 폰에는 종목 카탈로그가 없으므로 서버 검색(/api/widget/stocks/search)에
 *  기댄다 — 지수·국내·미국을 합쳐 주고, 결과를 누르면 그 심볼이 추가된다. 한글
 *  이름도 찾는다(서버가 ko→en 번역 후 Yahoo 검색).
 *  **환율**: 3자리 코드라 검색이 필요 없다 — 자주 쓰는 통화 버튼 + 직접 입력.
 *
 *  추가는 **서버가 값을 확인한 뒤에만** 들어간다(시세·환율이 없는 코드는 거절) —
 *  오타가 목록에 남아 영영 "—"로 보이는 일을 막는다.
 *
 *  ⚠ 액션바는 숨긴다 — targetSdk 36 edge-to-edge에서 제목 바가 입력 위로 겹친다.
 */
class QuoteAddActivity : Activity() {

    private lateinit var kind: String
    private lateinit var status: TextView
    private lateinit var results: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        kind = intent?.data?.host?.takeIf { it == "stocks" || it == "fx" } ?: "stocks"
        val isStock = kind == "stocks"
        val pad = (16 * resources.displayMetrics.density).toInt()

        val heading = TextView(this).apply {
            text = if (isStock) "종목 추가" else "통화 추가"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        val hint = TextView(this).apply {
            text = if (isStock) {
                "종목명·코드·티커로 찾습니다 (예: 삼성전자, 005930, AAPL, 코스피)"
            } else {
                "3자리 통화 코드 (예: USD, EUR, JPY)"
            }
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }
        val input = EditText(this).apply {
            this.hint = if (isStock) "종목 검색" else "통화 코드"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            inputType = InputType.TYPE_CLASS_TEXT
            if (!isStock) filters = arrayOf(android.text.InputFilter.LengthFilter(3))
        }
        status = TextView(this).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        val goBtn = Button(this).apply { text = if (isStock) "검색" else "추가" }
        val cancelBtn = Button(this).apply { text = "닫기" }
        cancelBtn.setOnClickListener { finish() }

        goBtn.setOnClickListener {
            val q = input.text.toString().trim()
            if (q.isEmpty()) {
                status.text = if (isStock) "검색어를 입력해 주세요." else "통화 코드를 입력해 주세요."
                return@setOnClickListener
            }
            if (isStock) search(q) else add(q.uppercase(), q.uppercase())
        }

        // 환율은 검색이 없으므로 자주 쓰는 통화를 바로 누를 수 있게 둔다.
        val quick = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        if (!isStock) {
            for (code in listOf("USD", "JPY", "EUR", "CNY", "GBP")) {
                quick.addView(
                    Button(this).apply {
                        text = code
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                        setPadding(0, 0, 0, 0)
                        setOnClickListener { add(code, code) }
                    },
                    LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                )
            }
        }

        setContentView(
            ScrollView(this).apply {
                addView(
                    LinearLayout(this@QuoteAddActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        fitsSystemWindows = true
                        setPadding(pad, pad, pad, pad)
                        addView(heading)
                        addView(space(pad / 4))
                        addView(hint)
                        addView(space(pad / 2))
                        addView(input, wide())
                        if (!isStock) {
                            addView(space(pad / 4))
                            addView(quick, wide())
                        }
                        addView(space(pad / 2))
                        addView(
                            LinearLayout(this@QuoteAddActivity).apply {
                                orientation = LinearLayout.HORIZONTAL
                                addView(goBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                                addView(cancelBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                            },
                            wide(),
                        )
                        addView(space(pad / 2))
                        addView(status)
                        addView(results, wide())
                    },
                )
            },
        )
        input.requestFocus()
    }

    /** 서버 검색 → 결과를 버튼으로 나열(누르면 추가). */
    private fun search(query: String) {
        status.text = "검색 중…"
        results.removeAllViews()
        Thread {
            val token = WidgetStore.loadToken(this)
            val hits = if (token == null) emptyList() else WidgetApi.searchSymbols(token, query)
            runOnUiThread {
                status.text = if (hits.isEmpty()) "결과가 없습니다." else "${hits.size}건 — 눌러서 추가"
                for (h in hits) {
                    results.addView(
                        Button(this).apply {
                            text = "${h.name}  ·  ${h.sub}"
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                            isAllCaps = false
                            setOnClickListener { add(h.symbol, h.name) }
                        },
                        wide(),
                    )
                }
            }
        }.start()
    }

    /** 추가 실행 — 성공하면 즉시 동기화해 위젯에 새 행이 뜨게 한다. */
    private fun add(key: String, label: String) {
        status.text = "추가 중…"
        Thread {
            val token = WidgetStore.loadToken(this)
            val result = when {
                token == null ->
                    WidgetApi.MutResult.Fail("연결이 해제되었습니다. 위젯에서 다시 연결하세요.")
                kind == "fx" -> WidgetApi.addFxCode(token, key)
                else -> WidgetApi.addSymbol(token, key)
            }
            // 새 항목의 시세·이름은 서버가 만든다 → **이 스레드에서 바로 재조회**한다.
            // WorkManager에 맡기면 홈 화면에 나와도 한참 뒤에야 나타난다(사용자 신고).
            if (result is WidgetApi.MutResult.Ok) pullNow(this, kind)
            runOnUiThread {
                when (result) {
                    is WidgetApi.MutResult.Ok -> {
                        Toast.makeText(this, "$label 추가됨", Toast.LENGTH_SHORT).show()
                        finish()
                    }
                    is WidgetApi.MutResult.Fail -> status.text = result.message
                }
            }
        }.start()
    }

    private fun wide() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
