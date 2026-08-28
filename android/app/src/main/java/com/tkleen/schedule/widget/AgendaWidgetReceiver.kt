package com.tkleen.schedule.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.tkleen.schedule.sync.AgendaSyncWorker

/** 홈 화면 일정 위젯 리시버 — 배치 시 15분 동기화를 걸고, 전부 제거되면 멈춘다. */
class AgendaWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AgendaWidget()

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
        // 재부팅·앱 업데이트 뒤에도 주기 작업이 살아 있도록 보강(KEEP이라 중복 무해).
        AgendaSyncWorker.schedulePeriodic(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AgendaSyncWorker.cancelAll(context)
    }
}
