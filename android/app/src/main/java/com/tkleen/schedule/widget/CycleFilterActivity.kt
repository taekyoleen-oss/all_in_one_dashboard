package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * 필터 순환 트램펄린(진행중 → 완료 → 전체) — 화면 없음, 즉시 finish.
 *
 * ⚠ 전용 클래스인 이유: 같은 Activity를 extras만 달리해 여러 버튼에 걸면
 * PendingIntent가 filterEquals(extras 무시) 기준으로 **하나로 합쳐져** 마지막
 * 버튼의 extras가 전부를 덮는다 — v7에서 콤보 탭이 '지금 갱신'으로 배달되던 원인.
 * 헤더 버튼은 버튼마다 클래스를 분리해 구조적으로 충돌을 없앤다.
 */
class CycleFilterActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val next = when (WidgetStore.tasksFilter(this)) {
            "pending" -> "done"
            "done" -> "all"
            else -> "pending"
        }
        WidgetStore.setTasksFilter(this, next)
        // 완료·전체는 10분 뒤 진행중으로 자동 복귀(요구) — 재렌더 예약.
        if (next == "pending") AgendaSyncWorker.cancelFilterRevert(this)
        else AgendaSyncWorker.scheduleFilterRevert(this)
        val app = applicationContext
        CoroutineScope(Dispatchers.Default).launch { TasksWidget().updateAll(app) }
        finish() // Theme.NoDisplay는 onResume 전에 반드시 finish
    }
}
