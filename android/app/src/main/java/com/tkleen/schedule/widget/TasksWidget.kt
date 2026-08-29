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
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.TaskItem
import com.tkleen.schedule.tasks.TaskEditActivity
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 작업 위젯 — 웹 '작업' 위젯(모바일 표시 지정 인스턴스)과 양방향 동기화.
 *
 *  헤더 필터(진행중 기본 · 탭할 때마다 진행중→완료→전체 순환 — 위젯엔 드롭다운이
 *  없어 콤보박스를 순환 버튼으로 구현) + ＋ 추가. 각 행은 진행/완료 **표시 라벨** +
 *  제목(+일자) + ✕ 삭제이고, 행을 탭하면 수정 화면(TaskEditActivity)이 열린다.
 *
 *  완료 유예(요구): 방금 완료한 작업은 흐린 글씨로 진행중 목록에 남고, 다음
 *  동기화(putTasks가 유예 목록을 비움) 때 진행중에서 빠진다.
 */
class TasksWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val paired = WidgetStore.isPaired(context)
        val unauthorized = WidgetStore.unauthorized(context)
        val linked = WidgetStore.tasksLinked(context)
        val items = WidgetStore.taskItems(context)
        val syncedAt = WidgetStore.tasksSyncedAt(context)
        val filter = WidgetStore.tasksFilter(context)
        val grace = WidgetStore.graceIds(context)
        val deleteMarks = WidgetStore.pendingDeleteIds(context)
        provideContent {
            TasksRoot(paired, unauthorized, linked, items, syncedAt, filter, grace, deleteMarks)
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
    filter: String,
    grace: Set<String>,
    deleteMarks: Set<String>,
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
                val visible = when (filter) {
                    "done" -> items.filter { it.done }
                    "all" -> items
                    else -> items.filter { !it.done || grace.contains(it.id) }
                }
                TasksHeader(filter, syncedAt)
                Spacer(GlanceModifier.height(6.dp))
                if (visible.isEmpty()) {
                    Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            when (filter) {
                                "done" -> "완료한 작업이 없습니다"
                                else -> "작업이 없습니다 — ＋로 추가하세요"
                            },
                            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
                        )
                    }
                } else {
                    LazyColumn(GlanceModifier.fillMaxSize()) {
                        items(visible, itemId = { it.id.hashCode().toLong() }) {
                            TaskRow(it, markedForDelete = deleteMarks.contains(it.id))
                        }
                    }
                }
            }
        }
    }
}

private fun filterLabel(filter: String): String = when (filter) {
    "done" -> "완료"
    "all" -> "전체"
    else -> "진행중"
}

@Composable
private fun TasksHeader(filter: String, syncedAt: Long) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "작업",
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(8.dp))
        // 필터 '콤보박스' — 탭할 때마다 진행중 → 완료 → 전체 순환.
        Text(
            "${filterLabel(filter)} ▾",
            modifier = GlanceModifier
                .clickable(actionRunCallback<CycleTasksFilterAction>())
                .padding(horizontal = 6.dp, vertical = 4.dp),
            style = TextStyle(color = AgendaTheme.text, fontSize = 12.sp, fontWeight = FontWeight.Medium),
        )
        Spacer(GlanceModifier.defaultWeight())
        if (syncedAt > 0) {
            val t = java.time.ZonedDateTime.ofInstant(
                java.time.Instant.ofEpochMilli(syncedAt),
                ZoneId.of("Asia/Seoul"),
            )
            Text(
                t.format(DateTimeFormatter.ofPattern("HH:mm")) + " 갱신",
                style = TextStyle(color = AgendaTheme.textDim, fontSize = 10.sp),
            )
        }
        // ＋ 추가 — 위젯은 텍스트 입력 불가라(계획서 §0.3) 작은 입력 화면을 연다.
        Text(
            "＋",
            modifier = GlanceModifier
                .clickable(actionStartActivity<TaskEditActivity>())
                .padding(horizontal = 8.dp, vertical = 2.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
    }
}

@Composable
private fun TaskRow(item: TaskItem, markedForDelete: Boolean) {
    // 행 탭 = 수정 화면. Glance actionStartActivity는 파라미터를 인텐트 extra로 전달한다.
    val editParams = buildList {
        add(PARAM_TASK_ID to item.id)
        add(PARAM_TASK_TITLE to item.title)
        add(PARAM_TASK_DONE to item.done)
        if (item.dueOn != null) add(PARAM_TASK_DUE to item.dueOn)
    }.toTypedArray()
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 상태 표시 라벨(조작 불가 — 변경은 수정 화면에서).
        Text(
            if (item.done) "완료" else "진행",
            style = TextStyle(
                color = if (item.done) AgendaTheme.textDim else AgendaTheme.accentProvider,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(8.dp))
        Text(
            item.title,
            maxLines = 1,
            // clickable을 padding보다 먼저 — 터치 영역이 패딩까지 포함되도록(✕ 오탐지의 원인).
            modifier = GlanceModifier
                .defaultWeight()
                .clickable(actionStartActivity<TaskEditActivity>(actionParametersOf(*editParams)))
                .padding(vertical = 4.dp),
            style = TextStyle(
                color = if (item.done || markedForDelete) AgendaTheme.textDim else AgendaTheme.text,
                fontSize = 13.sp,
                textDecoration = if (item.done) TextDecoration.LineThrough else TextDecoration.None,
            ),
        )
        if (item.dueOn != null) {
            Spacer(GlanceModifier.width(4.dp))
            Text(
                taskDateLabel(item.dueOn),
                style = TextStyle(color = AgendaTheme.textDim, fontSize = 10.sp),
            )
        }
        if (markedForDelete) {
            // 삭제 예정 표시(요구) — 다음 갱신 때 실제 삭제, ✕ 재탭으로 취소.
            Spacer(GlanceModifier.width(4.dp))
            Text(
                "삭제",
                style = TextStyle(
                    color = AgendaTheme.danger,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        Text(
            "✕",
            // clickable 먼저 + 넉넉한 패딩 = 실제 터치 영역 확대(눌러도 반응 없던 문제 수정).
            modifier = GlanceModifier
                .clickable(
                    actionRunCallback<ToggleDeleteMarkAction>(
                        actionParametersOf(PARAM_TASK_ID to item.id),
                    ),
                )
                .padding(horizontal = 10.dp, vertical = 6.dp),
            style = TextStyle(
                color = if (markedForDelete) AgendaTheme.danger else AgendaTheme.textDim,
                fontSize = 14.sp,
            ),
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

/**
 * 일자 표시 규칙(웹 components/widgets/tasks/dateLabel.ts와 동일):
 * 다른 연도 "2027.1.5" · 같은 연도 "9.15" · 같은 연월 "15일".
 */
internal fun taskDateLabel(dueOn: String, today: LocalDate = LocalDate.now(ZoneId.of("Asia/Seoul"))): String {
    return try {
        val d = LocalDate.parse(dueOn.take(10))
        when {
            d.year != today.year -> "${d.year}.${d.monthValue}.${d.dayOfMonth}"
            d.monthValue != today.monthValue -> "${d.monthValue}.${d.dayOfMonth}"
            else -> "${d.dayOfMonth}일"
        }
    } catch (e: Exception) {
        ""
    }
}

/* ── 위젯 액션 ─────────────────────────────────────────────────────────── */

internal val PARAM_TASK_ID = ActionParameters.Key<String>("taskId")
internal val PARAM_TASK_TITLE = ActionParameters.Key<String>("taskTitle")
internal val PARAM_TASK_DONE = ActionParameters.Key<Boolean>("taskDone")
internal val PARAM_TASK_DUE = ActionParameters.Key<String>("taskDue")

/** 필터 순환: 진행중 → 완료 → 전체 → 진행중. */
class CycleTasksFilterAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val next = when (WidgetStore.tasksFilter(context)) {
            "pending" -> "done"
            "done" -> "all"
            else -> "pending"
        }
        WidgetStore.setTasksFilter(context, next)
        TasksWidget().updateAll(context)
    }
}

/**
 * ✕ 탭 = 삭제 예정 마크 토글(요구). 서버 호출 없이 즉시 다시 그려 '삭제' 표시가
 * 붙고(재탭 시 해제), 실제 삭제는 다음 동기화에서 AgendaSyncWorker가 수행한다.
 */
class ToggleDeleteMarkAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[PARAM_TASK_ID] ?: return
        WidgetStore.toggleDeleteMark(context, id)
        TasksWidget().updateAll(context)
    }
}
