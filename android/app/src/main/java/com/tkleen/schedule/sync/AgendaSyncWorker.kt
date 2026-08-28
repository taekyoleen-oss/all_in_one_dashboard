package com.tkleen.schedule.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.widget.AgendaWidget
import java.util.concurrent.TimeUnit

/**
 * 아젠다 동기화 — 15분 주기(시스템 허용 최소) + 페어링 직후·수동 새로고침 1회 실행.
 *
 *  실패 정책(계획서): 캐시를 비우지 않는다 — 위젯은 마지막 성공 데이터를 계속 보여주고
 *  마지막 갱신 시각만 오래된 채 남는다. 네트워크 오류는 지수 백오프로 재시도.
 *  401은 재시도 무의미(토큰 폐기됨) → unauthorized 마크만 남겨 위젯이 재연결을 안내.
 */
class AgendaSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val token = WidgetStore.loadToken(ctx) ?: return Result.success() // 미페어링 no-op

        val result = when (val r = WidgetApi.fetchAgenda(token, WidgetStore.etag(ctx))) {
            is WidgetApi.AgendaResult.Ok -> {
                WidgetStore.putAgenda(ctx, r.itemsJson, r.etag, System.currentTimeMillis())
                Result.success()
            }
            WidgetApi.AgendaResult.NotModified -> {
                WidgetStore.touchSynced(ctx, System.currentTimeMillis())
                Result.success()
            }
            WidgetApi.AgendaResult.Unauthorized -> {
                WidgetStore.markUnauthorized(ctx)
                Result.success()
            }
            is WidgetApi.AgendaResult.Error ->
                if (runAttemptCount < 3) Result.retry() else Result.success()
        }
        AgendaWidget().updateAll(ctx) // 304여도 날짜 경계·갱신 시각 표시를 다시 그린다.
        return result
    }

    companion object {
        private const val PERIODIC = "pb-agenda-sync"
        private const val ONCE = "pb-agenda-sync-now"

        private val connected =
            Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** 15분 주기 등록(중복 등록은 KEEP으로 무해). */
        fun schedulePeriodic(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<AgendaSyncWorker>(15, TimeUnit.MINUTES)
                    .setConstraints(connected)
                    .build(),
            )
        }

        /** 즉시 1회 동기화(페어링 직후·수동 새로고침). */
        fun syncNow(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                ONCE,
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<AgendaSyncWorker>()
                    .setConstraints(connected)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
                    .build(),
            )
        }

        fun cancelAll(context: Context) {
            val wm = WorkManager.getInstance(context)
            wm.cancelUniqueWork(PERIODIC)
            wm.cancelUniqueWork(ONCE)
        }
    }
}
