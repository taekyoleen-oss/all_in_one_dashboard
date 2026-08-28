package com.tkleen.schedule.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.CheckBox
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
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
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.TaskItem
import com.tkleen.schedule.tasks.TaskAddActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.format.DateTimeFormatter

/**
 * 작업 위젯 — 웹 '작업' 위젯(모바일 표시 지정 인스턴스)과 양방향 동기화.
 * 목록 스크롤(LazyColumn) + 체크(완료) + ✕ 삭제 + 헤더 ＋(입력 화면) — 조작은
 * 캐시에 낙관 반영 후 API 호출, 실패해도 다음 동기화가 서버 진실로 복원한다.
 */
class TasksWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val paired = WidgetStore.isPaired(context)
        val unauthorized = WidgetStore.unauthorized(context)
        val linked = WidgetStore.tasksLinked(context)
        val items = WidgetStore.taskItems(context)
        val syncedAt = WidgetStore.tasksSyncedAt(context)
        provideContent {
            TasksRoot(paired, unauthorized, linked, items, syncedAt)
        }
    }
}

@Composable
private fun TasksRoot(
    paired: Boolean,
    unauthorized: Boolean,
    linked: Boolean,
    items: List<TaskItem>,
    syncedAt: Long,
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(AgendaTheme.bg)
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        when {
            !paired || unauthorized -> PairingCta(revoked = unauthorized, subject = "작업")
            !linked -> NotLinked()
            else -> {
                TasksHeader(items, syncedAt)
                Spacer(GlanceModifier.height(6.dp))
                if (items.isEmpty()) {
                    Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "작업이 없습니다 — ＋로 추가하세요",
                            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
                        )
                    }
                } else {
                    LazyColumn(GlanceModifier.fillMaxSize()) {
                        items(items, itemId = { it.id.hashCode().toLong() }) { TaskRow(it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun TasksHeader(items: List<TaskItem>, syncedAt: Long) {
    val remaining = items.count { !it.done }
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "작업",
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(
            "남은 ${remaining}개",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp),
        )
        Spacer(GlanceModifier.defaultWeight())
        if (syncedAt > 0) {
            val t = java.time.ZonedDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(syncedAt),
                java.time.ZoneId.of("Asia/Seoul"),
            )
            Text(
                t.format(DateTimeFormatter.ofPattern("HH:mm")) + " 갱신",
                style = TextStyle(color = AgendaTheme.textDim, fontSize = 10.sp),
            )
            Spacer(GlanceModifier.width(8.dp))
        }
        // ＋ 추가 — 위젯은 텍스트 입력 불가라(계획서 §0.3) 작은 입력 화면을 연다.
        Text(
            "＋",
            modifier = GlanceModifier
                .padding(horizontal = 6.dp)
                .clickable(actionStartActivity<TaskAddActivity>()),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}

@Composable
private fun TaskRow(item: TaskItem) {
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CheckBox(
            checked = item.done,
            onCheckedChange = actionRunCallback<ToggleTaskAction>(
                actionParametersOf(PARAM_TASK_ID to item.id, PARAM_TASK_DONE to !item.done),
            ),
            text = item.title,
            style = TextStyle(
                color = if (item.done) AgendaTheme.textDim else AgendaTheme.text,
                fontSize = 13.sp,
                textDecoration = if (item.done) TextDecoration.LineThrough else TextDecoration.None,
            ),
            modifier = GlanceModifier.defaultWeight(),
            maxLines = 1,
        )
        Text(
            "✕",
            modifier = GlanceModifier
                .padding(horizontal = 6.dp)
                .clickable(
                    actionRunCallback<DeleteTaskAction>(
                        actionParametersOf(PARAM_TASK_ID to item.id),
                    ),
                ),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
        )
    }
}

@Composable
private fun NotLinked() {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "연결된 작업 목록이 없습니다",
            style = TextStyle(color = AgendaTheme.text, fontSize = 13.sp, fontWeight = FontWeight.Medium),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            "웹 대시보드에 '작업' 위젯을 추가하고\n속성에서 '모바일 홈 화면에 표시'를 켜세요",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp),
        )
    }
}

/* ── 위젯 액션(낙관 반영 → API → 재동기화) ─────────────────────────────── */

internal val PARAM_TASK_ID = ActionParameters.Key<String>("taskId")
internal val PARAM_TASK_DONE = ActionParameters.Key<Boolean>("taskDone")

class ToggleTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[PARAM_TASK_ID] ?: return
        val done = parameters[PARAM_TASK_DONE] ?: return
        WidgetStore.mutateTasks(context) { list ->
            list.map { if (it.id == id) it.copy(done = done) else it }
        }
        TasksWidget().updateAll(context)
        val token = WidgetStore.loadToken(context) ?: return
        withContext(Dispatchers.IO) { WidgetApi.setTaskDone(token, id, done) }
    }
}

class DeleteTaskAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[PARAM_TASK_ID] ?: return
        WidgetStore.mutateTasks(context) { list -> list.filterNot { it.id == id } }
        TasksWidget().updateAll(context)
        val token = WidgetStore.loadToken(context) ?: return
        withContext(Dispatchers.IO) { WidgetApi.deleteTask(token, id) }
    }
}
