package com.tkleen.schedule.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * 작업 위젯 리시버. 동기화 작업은 아젠다와 공유(AgendaSyncWorker가 둘 다 갱신).
 * 취소는 두 위젯이 모두 사라졌을 때만(cancelIfNoWidgets) — 비대칭 정지 방지.
 */
class TasksWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TasksWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AgendaSyncWorker.schedulePeriodic(context)
        AgendaSyncWorker.syncNow(context)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        AgendaSyncWorker.schedulePeriodic(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AgendaSyncWorker.cancelIfNoWidgets(context)
    }
}
