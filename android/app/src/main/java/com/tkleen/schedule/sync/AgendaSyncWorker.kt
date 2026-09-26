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
import com.tkleen.schedule.widget.FxWidget
import com.tkleen.schedule.widget.NotesWidget
import com.tkleen.schedule.widget.StocksWidget
import com.tkleen.schedule.widget.TasksWidget
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

        // 삭제 예정 마크(✕로 표시해 둔 작업) 먼저 실행 — 성공한 것만 마크 해제,
        // 실패(오프라인 등)는 마크 유지 → 다음 동기화에서 재시도. 이후 fetch가
        // 서버 진실(삭제 반영된 목록)을 받아 위젯에서 사라진다.
        for (id in WidgetStore.pendingDeleteIds(ctx)) {
            if (WidgetApi.deleteTask(token, id)) WidgetStore.clearDeleteMark(ctx, id)
        }

        // 작업(tasks)도 같은 주기로 — 실패는 캐시 유지(다음 주기에 재시도, retry 미사용).
        when (val t = WidgetApi.fetchTasks(token, WidgetStore.tasksEtag(ctx))) {
            is WidgetApi.TasksResult.Ok ->
                WidgetStore.putTasks(ctx, t.itemsJson, t.etag, t.linked, System.currentTimeMillis())
            WidgetApi.TasksResult.NotModified ->
                WidgetStore.touchTasksSynced(ctx, System.currentTimeMillis())
            WidgetApi.TasksResult.Unauthorized -> WidgetStore.markUnauthorized(ctx)
            is WidgetApi.TasksResult.Error -> Unit
        }

        // 노트(notes) 소제목도 같은 주기로 — 실패는 캐시 유지(다음 주기 재시도).
        when (val n = WidgetApi.fetchNotes(token, WidgetStore.notesEtag(ctx))) {
            is WidgetApi.NotesResult.Ok ->
                WidgetStore.putNotes(ctx, n.itemsJson, n.etag, n.linked, System.currentTimeMillis())
            WidgetApi.NotesResult.NotModified ->
                WidgetStore.touchNotesSynced(ctx, System.currentTimeMillis())
            WidgetApi.NotesResult.Unauthorized -> WidgetStore.markUnauthorized(ctx)
            is WidgetApi.NotesResult.Error -> Unit
        }

        // 주식·환율(읽기 전용)도 같은 주기로 — 실패는 캐시 유지(다음 주기 재시도).
        when (val q = WidgetApi.fetchStocks(token, WidgetStore.stocksEtag(ctx))) {
            is WidgetApi.ListResult.Ok ->
                WidgetStore.putStocks(ctx, q.itemsJson, q.etag, q.linked, System.currentTimeMillis())
            WidgetApi.ListResult.NotModified ->
                WidgetStore.touchStocksSynced(ctx, System.currentTimeMillis())
            WidgetApi.ListResult.Unauthorized -> WidgetStore.markUnauthorized(ctx)
            is WidgetApi.ListResult.Error -> Unit
        }

        when (val f = WidgetApi.fetchFx(token, WidgetStore.fxEtag(ctx))) {
            is WidgetApi.ListResult.Ok ->
                WidgetStore.putFx(
                    ctx, f.itemsJson, f.etag, f.linked, System.currentTimeMillis(),
                    f.unavailable, f.indicatorsJson,
                )
            WidgetApi.ListResult.NotModified ->
                WidgetStore.touchFxSynced(ctx, System.currentTimeMillis())
            WidgetApi.ListResult.Unauthorized -> WidgetStore.markUnauthorized(ctx)
            is WidgetApi.ListResult.Error -> Unit
        }

        AgendaWidget().updateAll(ctx) // 304여도 날짜 경계·갱신 시각 표시를 다시 그린다.
        TasksWidget.refresh(ctx) // 살아있는 세션도 새 데이터로 재구성(틱)
        NotesWidget.refresh(ctx)
        StocksWidget.refresh(ctx)
        FxWidget.refresh(ctx)
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

        private const val FILTER_REVERT = "pb-tasks-filter-revert"

        /**
         * 필터 자동 복귀 예약(요구): 완료·전체로 바꾼 지 10분 뒤 동기화를 한 번 돌려
         * 위젯을 다시 그린다 — tasksFilter()의 만료 판정이 진행중으로 복귀시킨다.
         * (네트워크 제약 없음 — 오프라인이어도 재렌더는 되어야 한다.)
         */
        fun scheduleFilterRevert(context: Context) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                FILTER_REVERT,
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<AgendaSyncWorker>()
                    .setInitialDelay(
                        com.tkleen.schedule.data.WidgetStore.FILTER_REVERT_MS,
                        TimeUnit.MILLISECONDS,
                    )
                    .build(),
            )
        }

        fun cancelFilterRevert(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(FILTER_REVERT)
        }

        fun cancelAll(context: Context) {
            val wm = WorkManager.getInstance(context)
            wm.cancelUniqueWork(PERIODIC)
            wm.cancelUniqueWork(ONCE)
        }

        /**
         * 다섯 위젯(오늘 일정·작업·노트·주식·환율)이 **모두** 홈 화면에서 사라졌을 때만
         * 주기 작업을 멈춘다 — 리시버별 onDisabled가 남은 위젯의 동기화를 끊는 비대칭 방지.
         */
        fun cancelIfNoWidgets(context: Context) {
            val awm = android.appwidget.AppWidgetManager.getInstance(context)
            fun count(cls: Class<*>) =
                awm.getAppWidgetIds(android.content.ComponentName(context, cls)).size
            val total = count(com.tkleen.schedule.widget.AgendaWidgetReceiver::class.java) +
                count(com.tkleen.schedule.widget.TasksWidgetReceiver::class.java) +
                count(com.tkleen.schedule.widget.NotesWidgetReceiver::class.java) +
                count(com.tkleen.schedule.widget.StocksWidgetReceiver::class.java) +
                count(com.tkleen.schedule.widget.FxWidgetReceiver::class.java)
            if (total == 0) cancelAll(context)
        }
    }
}
