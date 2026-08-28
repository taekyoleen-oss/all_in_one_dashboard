package com.tkleen.schedule.tasks

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * 위젯 ＋ 버튼이 여는 작은 작업 입력 화면 — 안드로이드 위젯은 텍스트 입력을
 * 지원하지 않으므로(계획서 §0.3) 입력만 네이티브 화면이 받고 즉시 닫힌다.
 * 저장은 POST /api/widget/tasks → 웹 '작업' 위젯에는 realtime으로 바로 나타난다.
 */
class TaskAddActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        val pad = (16 * resources.displayMetrics.density).toInt()
        val title = TextView(this).apply {
            text = "작업 추가"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        val input = EditText(this).apply {
            hint = "할 작업 입력"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        }
        val status = TextView(this).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }
        val addBtn = Button(this).apply { text = "추가" }

        addBtn.setOnClickListener {
            val text = input.text.toString().trim()
            if (text.isEmpty()) {
                status.text = "내용을 입력해 주세요."
                return@setOnClickListener
            }
            addBtn.isEnabled = false
            status.text = "저장 중…"
            Thread {
                val token = WidgetStore.loadToken(this)
                val result = if (token == null) {
                    WidgetApi.MutResult.Fail("연결이 해제되었습니다. 위젯에서 다시 연결하세요.")
                } else {
                    WidgetApi.addTask(token, text)
                }
                runOnUiThread {
                    when (result) {
                        is WidgetApi.MutResult.Ok -> {
                            AgendaSyncWorker.syncNow(this)
                            Toast.makeText(this, "추가되었습니다", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        is WidgetApi.MutResult.Fail -> {
                            addBtn.isEnabled = true
                            status.text = result.message
                        }
                    }
                }
            }.start()
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(pad, pad * 2, pad, pad)
                addView(title)
                addView(space(pad))
                addView(input, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(space(pad / 2))
                addView(addBtn, LinearLayout.LayoutParams(pad * 10, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(space(pad / 2))
                addView(status)
            },
        )
        input.requestFocus()
    }

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
