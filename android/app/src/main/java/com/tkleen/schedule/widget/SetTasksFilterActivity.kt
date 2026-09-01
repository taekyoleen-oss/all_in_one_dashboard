package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.runBlocking

/**
 * 위젯 필터 버튼(진행·완료·전체)의 목적지 — **화면을 열지 않고** 필터만 바꾼다.
 *
 *  왜 투명 액티비티인가(v14 재판정): v5~v11의 인플레이스 버튼은 탭이 죽은 게 아니라
 *  **재렌더가 유실**된 것이었다(v9에서 prefs 저장은 실측 확인). Glance의 updateAll은
 *  WorkManager 세션을 경유하는데, 프로세스가 포그라운드가 아니면(NoDisplay 트램펄린·
 *  브로드캐스트 콜백) 이 기기가 실행을 미룬다 — 다음 자연 렌더(15분 동기화) 때는
 *  10분 자동 복귀가 이미 필터를 되돌린 뒤라 사용자에겐 "진행중에 고정"으로 보였다.
 *  확실히 동작하는 v12·v13 경로(보이는 화면 + updateAll)와의 유일한 차이가
 *  포그라운드 여부이므로, **투명 화면으로 포그라운드를 잡은 채** 위젯 재렌더를
 *  끝내고 닫는다. 사용자에겐 아무 화면도 보이지 않고 위젯 목록만 바뀐다.
 *
 *  값은 data URI host(`pbfilter://done`)로 받는다 — 값마다 고유 인텐트가 되어
 *  PendingIntent filterEquals 병합(extras 무시)의 여지가 없다(v10 교훈).
 */
class SetTasksFilterActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val filter = intent?.data?.host?.takeIf { it in setOf("pending", "done", "all") }
        if (filter == null) {
            finish()
            return
        }
        WidgetStore.setTasksFilter(this, filter)
        // 재렌더는 백그라운드 스레드에서 완료를 기다린다(메인 차단 = ANR 위험 회피).
        // 끝나면 닫는다 — 그동안 액티비티가 리줌 상태라 프로세스가 포그라운드다.
        Thread {
            try {
                runBlocking { TasksWidget().updateAll(applicationContext) }
            } catch (e: Exception) {
                // 재렌더 실패여도 필터는 저장됨 — 다음 렌더가 반영한다.
            }
            runOnUiThread { finish() }
        }.start()
        // 백스톱: 갱신이 오래 걸려도 투명 창이 홈 화면 터치를 계속 막지 않게.
        Handler(mainLooper).postDelayed({ if (!isFinishing) finish() }, 3000)
    }
}
