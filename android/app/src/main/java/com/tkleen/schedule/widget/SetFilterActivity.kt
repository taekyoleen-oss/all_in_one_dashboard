package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker
import kotlinx.coroutines.runBlocking

/**
 * 필터 버튼(진행/완료/전체) 트램펄린 — 값은 인텐트 **data URI**로 받는다.
 *
 * ⚠ 왜 extras가 아니라 data URI인가: PendingIntent 캐시는 filterEquals로 동일성을
 * 판단하는데 **extras는 비교에서 제외**된다 — 같은 클래스+extras만 다른 버튼 3개는
 * 하나로 병합돼 마지막 것이 전부를 덮는다(순환 콤보가 계속 한 값에 고정된 실체).
 * data URI는 filterEquals에 포함되므로 버튼마다 다른 PendingIntent가 보장된다.
 */
class SetFilterActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val next = when (intent?.data?.host) {
            "done" -> "done"
            "all" -> "all"
            else -> "pending"
        }
        WidgetStore.setTasksFilter(this, next)
        // 완료·전체는 10분 뒤 진행으로 자동 복귀(요구) — 재렌더 예약.
        if (next == "pending") AgendaSyncWorker.cancelFilterRevert(this)
        else AgendaSyncWorker.scheduleFilterRevert(this)
        // finish() 전에 다시 그리기를 끝낸다(launch면 취소돼 화면이 안 바뀐다).
        runBlocking { TasksWidget().updateAll(applicationContext) }
        finish()
    }
}
