package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker
import kotlinx.coroutines.runBlocking

/**
 * 필터 순환 트램펄린(진행중 → 완료 → 전체) — 화면 없음, 즉시 finish.
 *
 * ⚠ 두 가지 함정을 동시에 피한다:
 *  1) **PendingIntent 병합** — 같은 Activity를 extras만 달리해 여러 버튼에 걸면
 *     filterEquals(extras 무시) 기준으로 하나로 합쳐진다 → 버튼마다 전용 클래스.
 *  2) **갱신 유실** — finish()로 프로세스가 정리되면 `launch`로 띄운 updateAll이
 *     완료 전에 취소돼 "저장은 됐는데 화면이 그대로"가 된다 → runBlocking으로
 *     다시 그리기를 끝낸 뒤 종료(위젯 렌더는 수십 ms).
 *  매니페스트의 taskAffinity 분리로 TWA 앱 태스크를 전면화하지도 않는다.
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
        runBlocking { TasksWidget().updateAll(applicationContext) }
        finish()
    }
}
