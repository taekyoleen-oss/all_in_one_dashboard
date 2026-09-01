package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.view.WindowManager
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.runBlocking

/**
 * 위젯 필터 버튼(진행·완료·전체)의 목적지 — **화면을 열지 않고** 필터만 바꾼다.
 *
 *  왜 액티비티인가(v14, adb 실측): 이 기기에서 확실히 동작하는 위젯 탭 경로는
 *  액티비티 시작뿐이고, 투명(보이지 않는) 액티비티가 잠깐 포그라운드를 잡는 동안
 *  Glance 갱신(WorkManager 경유)이 안정적으로 실행된다 — 탭 후 0.3~0.6초에
 *  updateAppWidget이 런처에 적용되는 것을 로그로 확인했다.
 *
 *  입력 삼킴 방지(v15): 이 창이 떠 있는 ~0.2초 동안 홈 화면 탭이 먹히면 연타 시
 *  "입력이 막힌" 느낌이 난다(사용자 신고 재현됨) → NOT_TOUCHABLE·NOT_FOCUSABLE로
 *  터치를 아래로 통과시키고, 테마(PbInvisible)가 창 애니메이션을 없애 수명을 줄인다.
 *
 *  값은 data URI host(`pbfilter://done`)로 받는다 — 값마다 고유 인텐트가 되어
 *  PendingIntent filterEquals 병합(extras 무시)의 여지가 없다(v10 교훈).
 */
class SetTasksFilterActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 존재하는 동안에도 홈 화면 입력을 가로채지 않는다(연타 유실 방지).
        window.addFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        )
        val filter = intent?.data?.host?.takeIf { it in setOf("pending", "done", "all") }
        if (filter == null) {
            finish()
            return
        }
        WidgetStore.setTasksFilter(this, filter)
        // 재렌더 트리거는 백그라운드 스레드에서(메인 차단 = ANR 위험 회피), 끝나면 닫는다.
        // updateAll은 갱신을 '접수'하면 반환하고 실제 RemoteViews 적용은 그 직후 이어진다
        // (실측: finish 후에도 적용 완료) — 그동안 이 액티비티가 포그라운드 크레딧을 준다.
        Thread {
            try {
                runBlocking { TasksWidget.refresh(applicationContext) }
            } catch (e: Exception) {
                // 재렌더 실패여도 필터는 저장됨 — 다음 렌더가 반영한다.
            }
            runOnUiThread { finish() }
        }.start()
        // 백스톱: 갱신 접수가 오래 걸려도 투명 창이 남지 않게.
        Handler(mainLooper).postDelayed({ if (!isFinishing) finish() }, 3000)
    }
}
