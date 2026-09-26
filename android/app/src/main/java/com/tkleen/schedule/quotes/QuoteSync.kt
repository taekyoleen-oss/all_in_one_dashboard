package com.tkleen.schedule.quotes

import android.content.Context
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.sync.AgendaSyncWorker
import com.tkleen.schedule.widget.FxWidget
import com.tkleen.schedule.widget.StocksWidget
import kotlinx.coroutines.runBlocking

/**
 * 종목·통화를 더한 **직후** 그 자리에서 다시 받아 위젯에 반영한다.
 *
 *  전에는 `AgendaSyncWorker.syncNow`(WorkManager)만 걸고 화면을 닫았다. 큐에 들어간
 *  작업은 기기 사정에 따라 수 초~수십 초 뒤에 돌기 때문에, 홈 화면으로 나와도 방금
 *  추가한 종목이 한참 안 보였다(사용자 신고: "갱신하더라도 늦게 된다").
 *  추가 화면은 이미 백그라운드 스레드에서 API를 부르는 중이므로, 같은 스레드에서
 *  한 번 더 받아오면 창이 닫히기 전에 캐시가 최신이 된다.
 *
 *  ⚠ ETag는 **일부러 보내지 않는다**(null) — 방금 바꾼 목록을 반드시 200으로 받아야 한다.
 *  ⚠ 반드시 워커 스레드에서 부를 것(HTTP·runBlocking).
 */
internal fun pullNow(context: Context, kind: String) {
    val app = context.applicationContext
    val token = WidgetStore.loadToken(app) ?: return
    try {
        if (kind == "fx") {
            val r = WidgetApi.fetchFx(token, null)
            if (r is WidgetApi.ListResult.Ok) {
                WidgetStore.putFx(app, r.itemsJson, r.etag, r.linked, System.currentTimeMillis(), r.unavailable)
            }
            runBlocking { FxWidget.refresh(app) }
        } else {
            val r = WidgetApi.fetchStocks(token, null)
            if (r is WidgetApi.ListResult.Ok) {
                WidgetStore.putStocks(app, r.itemsJson, r.etag, r.linked, System.currentTimeMillis())
            }
            runBlocking { StocksWidget.refresh(app) }
        }
    } catch (e: Exception) {
        // 즉시 반영에 실패해도 값은 서버에 저장됐다 — 주기 동기화에 맡긴다.
        AgendaSyncWorker.syncNow(app)
    }
}
