package com.tkleen.schedule.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.appWidgetBackground
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
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextDecoration
import androidx.glance.text.TextStyle
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.TaskItem
import com.tkleen.schedule.tasks.TaskEditActivity
import com.tkleen.schedule.tasks.TasksListActivity
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 작업 위젯 — 웹 '작업' 위젯(모바일 표시 지정 인스턴스)과 양방향 동기화.
 *
 *  헤더 필터(진행·완료·전체 3버튼을 옆으로 나열, 기본 진행 — 위젯엔 드롭다운이
 *  없고 순환 방식은 오작동이 잦아 직접 선택으로) + ＋ 추가. 각 행은 진행/완료 **표시 라벨** +
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
                        // itemId에 마크 상태 비트 포함: 상태가 바뀌면 다른 항목으로 취급되어
                        // 완전 재바인딩 — 재활용 뷰의 클릭 바인딩이 낡는 문제(재탭 무반응) 차단.
                        items(
                            visible,
                            itemId = { (it.id.hashCode().toLong() shl 1) + (if (deleteMarks.contains(it.id)) 1L else 0L) },
                        ) {
                            TaskRow(it, markedForDelete = deleteMarks.contains(it.id))
                        }
                    }
                }
            }
        }
    }
}

internal fun filterLabelOf(value: String): String = when (value) {
    "done" -> "완료만"
    "all" -> "전체"
    else -> "진행중"
}

/** 관리 화면을 여는 인텐트 — 위젯의 모든 탭이 여기로 모인다(유일하게 확실한 경로). */
private fun manageIntent(context: Context, filter: String? = null): Intent =
    Intent(context, TasksListActivity::class.java).apply {
        // 필터마다 고유 data URI — PendingIntent가 값별로 분리된다(extras는 비교 제외).
        data = Uri.parse("pbtask://manage/${filter ?: "current"}")
        if (filter != null) putExtra("filter", filter)
    }

/** 위젯 헤더의 필터 버튼 — 선택된 것은 강조색·굵게. 탭하면 그 필터로 목록이 열린다. */
@Composable
private fun FilterButton(label: String, value: String, current: String) {
    val on = current == value
    Text(
        label,
        modifier = GlanceModifier
            .clickable(actionStartActivity(manageIntent(LocalContext.current, value)))
            .padding(horizontal = 7.dp, vertical = 6.dp),
        style = TextStyle(
            color = if (on) AgendaTheme.accentProvider else AgendaTheme.textDim,
            fontSize = 12.sp,
            fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
        ),
    )
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
        Spacer(GlanceModifier.width(6.dp))
        // 필터 버튼(진행·완료·전체) — 위젯 내부에서 값만 바꾸는 방식은 이 기기에서
        // 동작하지 않으므로, 각 버튼이 **그 필터로 관리 화면을 연다**(작동 보장 경로).
        // 화면에서 본 필터가 저장돼 위젯 표시도 따라 바뀐다.
        FilterButton("진행", "pending", filter)
        FilterButton("완료", "done", filter)
        FilterButton("전체", "all", filter)
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
        // 목록(관리 화면) — 완료 토글·삭제·새로고침이 여기 있다. 필터 버튼도 같은
        // 화면을 열지만 이 버튼은 '현재 필터 유지'로 연다.
        Text(
            "목록",
            modifier = GlanceModifier
                .clickable(actionStartActivity(manageIntent(LocalContext.current)))
                .padding(horizontal = 6.dp, vertical = 6.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
        // ＋ 추가 — 위젯은 텍스트 입력 불가라(계획서 §0.3) 작은 입력 화면을 연다.
        Text(
            "＋",
            modifier = GlanceModifier
                .clickable(
                    actionStartActivity(
                        Intent(LocalContext.current, TaskEditActivity::class.java)
                            .setData(Uri.parse("pbtask://add")),
                    ),
                )
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
    // 행 탭 = 수정 화면. 항목별 고유 data URI + extras(값 전달)로 병합 없이 정확히 연다.
    val editIntent = Intent(LocalContext.current, TaskEditActivity::class.java).apply {
        data = Uri.parse("pbtask://edit/${item.id}")
        putExtra("taskId", item.id)
        putExtra("taskTitle", item.title)
        putExtra("taskDone", item.done)
        if (item.dueOn != null) putExtra("taskDue", item.dueOn)
    }
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
                .clickable(actionStartActivity(editIntent))
                .padding(vertical = 4.dp),
            style = TextStyle(
                color = if (item.done || markedForDelete) AgendaTheme.textDim else AgendaTheme.text,
                fontSize = 13.sp,
                textDecoration = if (item.done) TextDecoration.LineThrough else TextDecoration.None,
            ),
        )
        // ⚠ 행의 자식 뷰 구조는 상태와 무관하게 항상 동일해야 한다 — 상태에 따라
        // 뷰가 생기고 없어지면 같은 itemId의 재활용 뷰에서 클릭 바인딩이 깨지는
        // 런처가 있다(✕ 재탭 무반응의 원인). 라벨은 상시 렌더, 없을 땐 빈 문자열.
        Spacer(GlanceModifier.width(4.dp))
        Text(
            if (item.dueOn != null) taskDateLabel(item.dueOn) else "",
            // 본문과 같은 크기(요구) — 색만 흐리게 구분.
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
        )
        Spacer(GlanceModifier.width(4.dp))
        // 삭제 예정 표시(요구) — 다음 갱신 때 실제 삭제, ✕ 재탭으로 취소.
        Text(
            if (markedForDelete) "삭제" else "",
            style = TextStyle(
                color = AgendaTheme.danger,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        // 행 오른쪽도 수정 화면으로(삭제는 그 화면과 목록 화면에 있다) — 위젯 내
        // 인플레이스 토글은 이 기기에서 동작하지 않아 제거했다.
        Text(
            "›",
            modifier = GlanceModifier
                .clickable(actionStartActivity(editIntent))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 16.sp),
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
 * 다른 연도 "2027.1.5" · 같은 연도 "9.15" · 같은 연월 "15일" + 요일 "(토)" 병기(요구).
 */
private val TASK_KOR_DOW = arrayOf("월", "화", "수", "목", "금", "토", "일") // DayOfWeek.value 1=월

internal fun taskDateLabel(dueOn: String, today: LocalDate = LocalDate.now(ZoneId.of("Asia/Seoul"))): String {
    return try {
        val d = LocalDate.parse(dueOn.take(10))
        val base = when {
            d.year != today.year -> "${d.year}.${d.monthValue}.${d.dayOfMonth}"
            d.monthValue != today.monthValue -> "${d.monthValue}.${d.dayOfMonth}"
            else -> "${d.dayOfMonth}일"
        }
        "$base (${TASK_KOR_DOW[d.dayOfWeek.value - 1]})"
    } catch (e: Exception) {
        ""
    }
}
