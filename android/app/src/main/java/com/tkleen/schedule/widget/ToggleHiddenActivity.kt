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
 * 위젯 헤더의 **숨기기 / 보이기**(요구) — 화면을 열지 않고 그 자리에서 토글한다.
 *
 *  숨기면 위젯은 **홈 화면 공간을 그대로 차지한 채 제목 줄만** 그리고, 보이기를
 *  누르면 원래 목록으로 돌아온다(요구 문장 그대로). 접힘 여부는 이 폰에만 남는
 *  표시 설정이라 서버로 가지 않는다(WidgetStore, 글자 크기·배경과 같은 자리).
 *
 *  왜 투명 액티비티인가(v14·v15 실측): 이 기기에서 위젯 탭으로 확실히 동작하는
 *  경로는 액티비티 시작뿐이고, 잠깐 포그라운드를 잡아야 Glance 재렌더가 미뤄지지
 *  않는다. 창은 보이지 않고(PbInvisible) 터치를 아래로 통과시켜(NOT_TOUCHABLE)
 *  연타가 먹히지 않는 문제도 없다.
 *
 *  종류마다 고유 data URI(`pbhide://stocks`)라 PendingIntent 병합 여지가 없다(v10).
 */
class ToggleHiddenActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        )
        val kind = intent?.data?.host?.takeIf { it in KINDS }
        if (kind == null) {
            finish()
            return
        }
        WidgetStore.setHidden(this, kind, !WidgetStore.hidden(this, kind))
        // 재렌더는 백그라운드 스레드에서(메인 차단 = ANR 회피), 끝나면 닫는다.
        Thread {
            try {
                runBlocking {
                    when (kind) {
                        "notes" -> NotesWidget.refresh(applicationContext)
                        "stocks" -> StocksWidget.refresh(applicationContext)
                        "fx" -> FxWidget.refresh(applicationContext)
                        else -> TasksWidget.refresh(applicationContext)
                    }
                }
            } catch (e: Exception) {
                // 재렌더 실패여도 값은 저장됐다 — 다음 렌더가 반영한다.
            }
            runOnUiThread { finish() }
        }.start()
        // 백스톱: 갱신이 오래 걸려도 투명 창이 남지 않게.
        Handler(mainLooper).postDelayed({ if (!isFinishing) finish() }, 3000)
    }

    companion object {
        val KINDS = setOf("tasks", "notes", "stocks", "fx")
    }
}

/** 숨기기/보이기 인텐트 — 종류마다 고유 data URI(PendingIntent 병합 방지, v10). */
internal fun toggleHiddenIntent(context: Context, kind: String): Intent =
    Intent(context, ToggleHiddenActivity::class.java).setData(Uri.parse("pbhide://$kind"))
