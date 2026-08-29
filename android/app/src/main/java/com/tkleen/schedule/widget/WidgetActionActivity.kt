package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.runBlocking

/**
 * ✕(삭제 예정 마크 토글) 트램펄린 — 화면 없음, 즉시 finish.
 * 갱신은 runBlocking으로 완료 후 종료(CycleFilterActivity 주석의 함정 2 참조).
 */
class WidgetActionActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intent?.getStringExtra("taskId")?.let { WidgetStore.toggleDeleteMark(this, it) }
        runBlocking { TasksWidget().updateAll(applicationContext) }
        finish()
    }
}
