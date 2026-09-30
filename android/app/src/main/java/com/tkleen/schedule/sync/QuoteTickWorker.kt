package com.tkleen.schedule.sync

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.PowerManager
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.widget.FxWidget
import com.tkleen.schedule.widget.FxWidgetReceiver
import com.tkleen.schedule.widget.StocksWidget
import com.tkleen.schedule.widget.StocksWidgetReceiver
import java.util.concurrent.TimeUnit

/**
 * 주식·환율만 5분마다 다시 받는다(요구: "↻을 눌러야만 갱신된다").
 *
 *  주기 작업(PeriodicWork)은 15분이 시스템 최소라, 한 번짜리 작업이 끝날 때
 *  5분 뒤의 자기 자신을 이어 붙이는 체인으로 돈다(APPEND_OR_REPLACE).
 *  화면이 꺼져 있으면 받지 않고 다음 틱만 건다 — 아무도 안 보는 시세에 배터리·
 *  공유 시세 한도를 쓰지 않는다. Doze 중엔 시스템이 미뤘다가 화면이 켜지면 돌린다.
 *  주식·환율 위젯이 하나도 없으면 체인을 끝낸다.
 *
 *  ponytail: 장 시간(국내·미국) 판정은 안 한다 — 장 마감 뒤엔 서버가 같은 값을
 *  주고 ETag 304로 끝나 비용이 작다. 줄이고 싶으면 여기서 시간대로 거르면 된다.
 */
class QuoteTickWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        if (!hasQuoteWidgets(ctx)) return Result.success()

        val token = WidgetStore.loadToken(ctx)
        val screenOn = ctx.getSystemService(PowerManager::class.java).isInteractive
        if (token != null && screenOn) {
            AgendaSyncWorker.syncQuotes(ctx, token)
            StocksWidget.refresh(ctx)
            FxWidget.refresh(ctx)
        }
        enqueue(ctx, ExistingWorkPolicy.APPEND_OR_REPLACE)
        return Result.success()
    }

    companion object {
        private const val NAME = "pb-quote-tick"
        private const val INTERVAL_MIN = 5L

        /** 체인이 없을 때만 시작(이미 대기 중이면 그대로 둔다). */
        fun start(context: Context) = enqueue(context, ExistingWorkPolicy.KEEP)

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NAME)
        }

        private fun enqueue(context: Context, policy: ExistingWorkPolicy) {
            WorkManager.getInstance(context).enqueueUniqueWork(
                NAME,
                policy,
                OneTimeWorkRequestBuilder<QuoteTickWorker>()
                    .setInitialDelay(INTERVAL_MIN, TimeUnit.MINUTES)
                    .setConstraints(
                        Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                    )
                    .build(),
            )
        }

        private fun hasQuoteWidgets(context: Context): Boolean {
            val awm = AppWidgetManager.getInstance(context)
            fun count(cls: Class<*>) = awm.getAppWidgetIds(ComponentName(context, cls)).size
            return count(StocksWidgetReceiver::class.java) + count(FxWidgetReceiver::class.java) > 0
        }
    }
}
