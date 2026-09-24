package com.tkleen.schedule.quotes

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.widget.FxWidget
import com.tkleen.schedule.widget.StocksWidget
import kotlinx.coroutines.runBlocking

/**
 * 종목·통화 삭제 화면 — 주식/환율 위젯의 행을 누르면 열린다(요구: 폰에서도 삭제).
 *
 *  홈 화면에서 잘못 누르기 쉬운 자리라 **2단계 확인**을 둔다(소제목 삭제와 같은 규칙).
 *  지우는 순간 캐시에서도 빼고 위젯을 다시 그린다 — 다음 동기화(최대 15분)를
 *  기다리면 "삭제가 안 먹었다"로 보인다.
 *
 *  삭제는 웹 위젯의 목록에서도 사라진다(같은 config를 본다). 되돌리려면 웹이나
 *  이 위젯의 ＋로 다시 추가하면 된다 — 값이 아니라 '무엇을 볼지'의 목록이라 안전하다.
 */
class QuoteDeleteActivity : Activity() {

    private var confirming = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        val kind = intent?.getStringExtra("kind")?.takeIf { it == "stocks" || it == "fx" } ?: "stocks"
        val key = intent?.getStringExtra("key").orEmpty()
        val label = intent?.getStringExtra("label").orEmpty().ifEmpty { key }
        val detail = intent?.getStringExtra("detail").orEmpty()
        if (key.isEmpty()) {
            finish()
            return
        }

        val pad = (16 * resources.displayMetrics.density).toInt()
        val heading = TextView(this).apply {
            text = label
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        val sub = TextView(this).apply {
            text = if (detail.isEmpty()) key else "$key  ·  $detail"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        }
        val note = TextView(this).apply {
            text = if (kind == "fx") {
                "이 통화를 위젯에서 뺍니다. 웹 대시보드의 환율 위젯에서도 사라집니다."
            } else {
                "이 종목을 위젯에서 뺍니다. 웹 대시보드의 주식 위젯에서도 사라집니다."
            }
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }
        val status = TextView(this).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        val closeBtn = Button(this).apply { text = "닫기" }
        closeBtn.setOnClickListener { finish() }
        val deleteBtn = Button(this).apply {
            text = if (kind == "fx") "이 통화 삭제" else "이 종목 삭제"
            setTextColor(0xFFDC2626.toInt())
        }

        deleteBtn.setOnClickListener {
            // 2단계 확인 — 첫 탭은 묻기만 하고, 두 번째 탭에서 실제로 지운다.
            if (!confirming) {
                confirming = true
                deleteBtn.text = "정말 삭제할까요? (다시 누르면 삭제)"
                status.text = "취소하려면 '닫기'를 누르세요."
                return@setOnClickListener
            }
            deleteBtn.isEnabled = false
            status.text = "삭제 중…"
            Thread {
                val token = WidgetStore.loadToken(this)
                val result = when {
                    token == null ->
                        WidgetApi.MutResult.Fail("연결이 해제되었습니다. 위젯에서 다시 연결하세요.")
                    kind == "fx" -> WidgetApi.deleteFxCode(token, key)
                    else -> WidgetApi.deleteSymbol(token, key)
                }
                runOnUiThread {
                    when (result) {
                        is WidgetApi.MutResult.Ok -> {
                            applyOptimistic(kind, key)
                            Toast.makeText(this, "삭제되었습니다", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        is WidgetApi.MutResult.Fail -> {
                            deleteBtn.isEnabled = true
                            confirming = false
                            deleteBtn.text = if (kind == "fx") "이 통화 삭제" else "이 종목 삭제"
                            status.text = result.message
                        }
                    }
                }
            }.start()
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                fitsSystemWindows = true
                setPadding(pad, pad, pad, pad)
                addView(heading)
                addView(space(pad / 4))
                addView(sub)
                addView(space(pad))
                addView(note, wide())
                addView(space(pad))
                addView(deleteBtn, wide())
                addView(space(pad / 4))
                addView(closeBtn, wide())
                addView(space(pad / 2))
                addView(status)
            },
        )
    }

    /** 캐시에서 즉시 빼고 위젯을 다시 그린다(finish 직전이라 끝까지 기다린다). */
    private fun applyOptimistic(kind: String, key: String) {
        if (kind == "fx") {
            WidgetStore.mutateFx(this) { list -> list.filterNot { it.code == key } }
            runBlocking { FxWidget.refresh(applicationContext) }
        } else {
            WidgetStore.mutateStocks(this) { list -> list.filterNot { it.symbol == key } }
            runBlocking { StocksWidget.refresh(applicationContext) }
        }
    }

    private fun wide() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
