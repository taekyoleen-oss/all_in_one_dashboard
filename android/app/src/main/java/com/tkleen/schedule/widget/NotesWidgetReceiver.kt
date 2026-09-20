package com.tkleen.schedule.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * 노트 위젯 리시버. 동기화는 아젠다·작업과 같은 워커를 공유한다.
 * 취소는 세 위젯이 모두 사라졌을 때만(cancelIfNoWidgets) — 하나를 지웠다고
 * 나머지의 동기화가 끊기면 안 된다.
 */
class NotesWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NotesWidget()

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
