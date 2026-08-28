package com.tkleen.schedule.pairing

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * 위젯 최초 설정(페어링) 화면 — 6자리 코드 → 디바이스 토큰 교환.
 *
 *  위젯 추가 시 APPWIDGET_CONFIGURE로 뜨고(취소하면 위젯 배치도 취소되는 표준 규약),
 *  위젯의 '연결하기' 버튼으로도 열린다. 이미 연결된 상태의 configure 진입은 코드를
 *  다시 묻지 않고 즉시 완료 처리한다(기기 1대 = 토큰 1개).
 *
 *  UI는 프로그래매틱 레이아웃 — 화면 하나에 XML·뷰바인딩·appcompat을 들이지 않는다.
 */
class PairingActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide() // 액션바 제목이 입력 위로 겹치는 문제 방지(TaskEditActivity와 동일)
        appWidgetId = intent?.getIntExtra(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        setResult(RESULT_CANCELED, resultIntent()) // 뒤로가기 = 위젯 배치 취소(표준)

        if (WidgetStore.isPaired(this) && !WidgetStore.unauthorized(this)) {
            // 이미 연결됨 — 동기화만 걸고 바로 완료.
            AgendaSyncWorker.schedulePeriodic(this)
            AgendaSyncWorker.syncNow(this)
            setResult(RESULT_OK, resultIntent())
            finish()
            return
        }

        val pad = (16 * resources.displayMetrics.density).toInt()
        val title = TextView(this).apply {
            text = "일정 위젯 연결"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        val guide = TextView(this).apply {
            text = "PC나 휴대폰 브라우저에서 대시보드에 로그인한 뒤\n설정(⚙) > 위젯에서 페어링 코드를 발급받아 입력하세요.\n코드는 5분간 1회만 유효합니다."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        }
        val input = EditText(this).apply {
            hint = "6자리 코드"
            inputType = InputType.TYPE_CLASS_NUMBER
            filters = arrayOf(InputFilter.LengthFilter(6))
            textAlignment = TextView.TEXT_ALIGNMENT_CENTER
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 24f)
            letterSpacing = 0.3f
        }
        val status = TextView(this).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }
        val connect = Button(this).apply { text = "연결" }

        connect.setOnClickListener {
            val code = input.text.toString().trim()
            if (!Regex("^\\d{6}$").matches(code)) {
                status.text = "6자리 숫자 코드를 입력해 주세요."
                return@setOnClickListener
            }
            connect.isEnabled = false
            status.text = "연결 중…"
            Thread {
                val result = WidgetApi.pair(code, deviceLabel())
                runOnUiThread {
                    when (result) {
                        is WidgetApi.PairResult.Ok -> {
                            WidgetStore.clearPairing(this)
                            WidgetStore.saveToken(this, result.token)
                            AgendaSyncWorker.schedulePeriodic(this)
                            AgendaSyncWorker.syncNow(this)
                            Toast.makeText(this, "연결되었습니다", Toast.LENGTH_SHORT).show()
                            setResult(RESULT_OK, resultIntent())
                            finish()
                        }
                        is WidgetApi.PairResult.Fail -> {
                            connect.isEnabled = true
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
                fitsSystemWindows = true // edge-to-edge에서 상태바와 겹치지 않게
                setPadding(pad, pad * 2, pad, pad)
                addView(title)
                addView(space(pad / 2))
                addView(guide)
                addView(space(pad))
                addView(input, LinearLayout.LayoutParams(pad * 12, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(space(pad / 2))
                addView(connect, LinearLayout.LayoutParams(pad * 12, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(space(pad / 2))
                addView(status)
            },
        )
    }

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }

    private fun resultIntent() =
        Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

    /** 설정 UI 디바이스 목록에 보일 라벨 — 예: "samsung SM-S921N". */
    private fun deviceLabel(): String =
        "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(80)
}
