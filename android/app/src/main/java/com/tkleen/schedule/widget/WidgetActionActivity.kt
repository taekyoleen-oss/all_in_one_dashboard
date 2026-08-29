package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * 위젯 탭 액션 트램펄린(화면 없음, Theme.NoDisplay — onCreate에서 즉시 finish).
 *
 *  왜 액티비티인가: 실기기에서 actionRunCallback(브로드캐스트 경로) 기반 탭(필터
 *  순환·✕ 마크)이 간헐적으로 죽는 반면, actionStartActivity(＋·행 탭)는 항상
 *  동작했다 — 위젯 클릭의 PendingIntent.getActivity 경로가 런처·전원관리 정책에서
 *  가장 확실하다. 모든 위젯 탭 동작을 이 경로로 통일한다.
 *
 *  extras: widgetAction = cycleFilter | toggleDeleteMark(+taskId) | syncNow
 */
class WidgetActionActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = applicationContext
        when (intent?.getStringExtra("widgetAction")) {
            "cycleFilter" -> {
                val next = when (WidgetStore.tasksFilter(this)) {
                    "pending" -> "done"
                    "done" -> "all"
                    else -> "pending"
                }
                WidgetStore.setTasksFilter(this, next)
                CoroutineScope(Dispatchers.Default).launch { TasksWidget().updateAll(app) }
            }
            "toggleDeleteMark" -> {
                intent?.getStringExtra("taskId")?.let { WidgetStore.toggleDeleteMark(this, it) }
                CoroutineScope(Dispatchers.Default).launch { TasksWidget().updateAll(app) }
            }
            "syncNow" -> {
                AgendaSyncWorker.syncNow(this)
                Toast.makeText(this, "갱신 중…", Toast.LENGTH_SHORT).show()
            }
        }
        finish() // Theme.NoDisplay는 onResume 전에 반드시 finish
    }
}
