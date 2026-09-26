package com.tkleen.schedule.widget

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.view.WindowManager
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.runBlocking

/**
 * 접힌 환율 위젯의 **환전 계산기 조작**(요구) — 금액 ×10·÷10과 방향 바꾸기.
 *
 *  위젯에는 글자를 입력할 수 없으므로(계획서 §0.3) 금액은 **자리수 이동**으로 정한다:
 *  1 → 10 → … → 1,000,000,000. 방향은 원→외화 / 외화→원 토글이다("서로 환전").
 *  값은 이 폰에만 남는다(WidgetStore — 글자 크기·배경과 같은 자리).
 *
 *  왜 투명 액티비티인가: v14·v15 실측대로 이 기기에서 위젯 탭이 확실히 동작하는 경로는
 *  액티비티 시작뿐이고, 잠깐 포그라운드를 잡아야 Glance 재렌더가 미뤄지지 않는다.
 *  창은 보이지 않고 터치를 아래로 통과시킨다. 동작마다 고유 data URI라
 *  PendingIntent 병합 여지가 없다(v10).
 */
class FxCalcActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        )
        when (intent?.data?.host) {
            "x10" -> WidgetStore.setFxAmount(this, WidgetStore.fxAmount(this) * 10)
            "d10" -> WidgetStore.setFxAmount(this, WidgetStore.fxAmount(this) / 10)
            "dir" -> WidgetStore.setFxToWon(this, !WidgetStore.fxToWon(this))
            else -> {
                finish()
                return
            }
        }
        Thread {
            try {
                runBlocking { FxWidget.refresh(applicationContext) }
            } catch (e: Exception) {
                // 재렌더 실패여도 값은 저장됐다 — 다음 렌더가 반영한다.
            }
            runOnUiThread { finish() }
        }.start()
        Handler(mainLooper).postDelayed({ if (!isFinishing) finish() }, 3000)
    }
}

/** 계산기 조작 인텐트 — 동작마다 고유 data URI(PendingIntent 병합 방지, v10). */
internal fun fxCalcIntent(context: Context, action: String): Intent =
    Intent(context, FxCalcActivity::class.java).setData(Uri.parse("pbfxcalc://$action"))
