package com.tkleen.schedule.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * Fx 위젯 리시버. 동기화는 아젠다·작업·노트와 공유(AgendaSyncWorker가 전부 갱신).
 * 취소는 모든 위젯이 사라졌을 때만(cancelIfNoWidgets) — 비대칭 정지 방지.
 */
class FxWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = FxWidget()

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
