package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * ✕(삭제 예정 마크 토글) 트램펄린 — 화면 없음, 즉시 finish.
 *
 *  목록 행 안의 액션이라 taskId를 extra로 받는다(목록은 fill-in 인텐트가 항목별
 *  extras를 전달하므로 안전). 헤더 버튼들처럼 extras로 동작을 분기하지 않는다 —
 *  같은 클래스 + extras만 다른 PendingIntent는 filterEquals 기준으로 병합되는
 *  함정이 있다(CycleFilterActivity 주석 참조).
 */
class WidgetActionActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intent?.getStringExtra("taskId")?.let { WidgetStore.toggleDeleteMark(this, it) }
        val app = applicationContext
        CoroutineScope(Dispatchers.Default).launch { TasksWidget().updateAll(app) }
        finish() // Theme.NoDisplay는 onResume 전에 반드시 finish
    }
}
