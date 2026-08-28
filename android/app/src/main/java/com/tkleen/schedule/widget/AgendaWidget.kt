package com.tkleen.schedule.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.action.clickable
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.tkleen.schedule.LauncherActivity
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.AgendaItem
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * 홈 화면 일정 위젯(P3, 읽기 전용) — 오늘·내일 아젠다를 표시한다.
 * 데이터는 AgendaSyncWorker가 15분마다 캐시에 채우고, 여기는 캐시만 읽는다
 * (동기화 실패 시에도 마지막 데이터 유지 — 계획서 원칙 3).
 */
class AgendaWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val paired = WidgetStore.isPaired(context)
        val unauthorized = WidgetStore.unauthorized(context)
        val items = WidgetStore.agendaItems(context)
        val syncedAt = WidgetStore.syncedAt(context)
        provideContent {
            Root(paired = paired, unauthorized = unauthorized, items = items, syncedAt = syncedAt)
        }
    }
}

private val SEOUL: ZoneId = ZoneId.of("Asia/Seoul")

@Composable
private fun Root(paired: Boolean, unauthorized: Boolean, items: List<AgendaItem>, syncedAt: Long) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(AgendaTheme.bg)
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        if (!paired || unauthorized) {
            PairingCta(revoked = unauthorized, subject = "일정")
        } else {
            Header(syncedAt)
            Spacer(GlanceModifier.height(6.dp))
            if (items.isEmpty()) {
                Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "오늘 남은 일정이 없습니다",
                        style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
                    )
                }
            } else {
                val now = ZonedDateTime.now(SEOUL)
                LazyColumn(GlanceModifier.fillMaxSize()) {
                    items(items, itemId = { it.id.hashCode().toLong() }) { item ->
                        ItemRow(item, now)
                    }
                }
            }
        }
    }
}

@Composable
private fun Header(syncedAt: Long) {
    val now = ZonedDateTime.now(SEOUL)
    val date = now.format(DateTimeFormatter.ofPattern("M/d")) + " (" + KOR_DOW[now.dayOfWeek.value - 1] + ")"
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .clickable(actionStartActivity<LauncherActivity>()),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "오늘 일정",
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(date, style = TextStyle(color = AgendaTheme.text, fontSize = 12.sp))
        Spacer(GlanceModifier.defaultWeight())
        // 마지막 갱신 시각 — 동기화가 밀리면 이 시각만 오래된 채 남는다(흐린 톤).
        if (syncedAt > 0) {
            val t = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(syncedAt), SEOUL)
            Text(
                t.format(DateTimeFormatter.ofPattern("HH:mm")) + " 갱신",
                style = TextStyle(color = AgendaTheme.textDim, fontSize = 10.sp),
            )
        }
    }
}

@Composable
private fun ItemRow(item: AgendaItem, now: ZonedDateTime) {
    val done = item.status == "done"
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 좌측 인디케이터 바 — 대상 색(없으면 브랜드 강조색).
        Box(
            GlanceModifier
                .width(4.dp)
                .height(34.dp)
                .cornerRadius(2.dp)
                .background(ColorProvider(if (done) Color(0xFF9AA5B1) else AgendaTheme.tokenColor(item.colorToken))),
        ) {}
        Spacer(GlanceModifier.width(8.dp))
        Column(GlanceModifier.defaultWeight()) {
            Text(
                item.title,
                maxLines = 1,
                style = TextStyle(
                    color = if (done) AgendaTheme.textDim else AgendaTheme.text,
                    fontSize = 13.sp,
                    textDecoration = if (done) TextDecoration.LineThrough else TextDecoration.None,
                ),
            )
            val meta = buildString {
                append(timeLabel(item, now))
                if (item.targetName != null) {
                    if (isNotEmpty()) append(" · ")
                    append(item.targetName)
                }
                if (item.status == "snoozed") append(" · 연기됨")
            }
            if (meta.isNotEmpty()) {
                Text(meta, maxLines = 1, style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp))
            }
        }
    }
}

private val KOR_DOW = arrayOf("월", "화", "수", "목", "금", "토", "일")

/** "오후 3:30" / "내일 오전 9:00" / "8/30 오후 2:00" — 파싱 실패는 빈 문자열. */
private fun timeLabel(item: AgendaItem, now: ZonedDateTime): String {
    return try {
        val at = OffsetDateTime.parse(item.effectiveAt).atZoneSameInstant(SEOUL)
        val ampm = if (at.hour < 12) "오전" else "오후"
        val h12 = when (val h = at.hour % 12) { 0 -> 12; else -> h }
        val time = "$ampm $h12:" + "%02d".format(at.minute)
        when (at.toLocalDate()) {
            now.toLocalDate() -> time
            now.toLocalDate().plusDays(1) -> "내일 $time"
            else -> at.format(DateTimeFormatter.ofPattern("M/d")) + " " + time
        }
    } catch (e: Exception) {
        ""
    }
}
