package com.tkleen.schedule.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
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
import com.tkleen.schedule.tasks.TasksListActivity
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 작업 위젯 — 웹 '작업' 위젯(모바일 표시 지정 인스턴스)과 양방향 동기화.
 *
 *  헤더 필터(진행·완료·전체 3버튼, 기본 진행)는 **화면 전환 없이** 위젯 목록을
 *  바꾼다(SetTasksFilterActivity — 투명 포그라운드에서 재렌더 후 즉시 닫힘) + ＋ 추가.
 *  각 행은 진행/완료 **표시 라벨** + 제목(+일자)이고, 행을 탭하면 수정 화면이 열린다.
 *
 *  완료된 작업은 진행 필터에서 **즉시** 사라진다(요구, v14) — 완료·전체에서만 보인다.
 */
class TasksWidget : GlanceAppWidget() {
    companion object {
        /**
         * 데이터 버전 틱 — **stale 렌더의 근본 수정**(v15, adb 실측으로 확정).
         * Glance 세션은 한 번 뜨면 수십 초 살아 있는데, 살아 있는 세션에 대한
         * updateAll은 재구성만 일으켜 provideGlance 시점에 캡처된 **옛 값으로 다시
         * 그린다** — 직전 렌더 후 ~1분 안의 탭이 "안 먹는" 것처럼 보이던 진짜 원인
         * (v5~v11의 인플레이스 버튼 무반응도 상당 부분 이것). 값을 바꾸면 컴포지션이
         * 구독 중인 이 플로우로 재구성되고, 그때 prefs를 다시 읽는다.
         */
        internal val refreshTick = MutableStateFlow(0)

        /** 데이터 변경 후 위젯 반영 — 살아있는 세션(틱)과 닫힌 세션(updateAll) 모두 커버. */
        suspend fun refresh(context: Context) {
            refreshTick.value++
            TasksWidget().updateAll(context.applicationContext)
        }
    }

    /** 실제 위젯 크기를 알아야 '제목만' 모드를 판단한다(LocalSize). */
    override val sizeMode = androidx.glance.appwidget.SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val tick by refreshTick.collectAsState()
            // 캡처 금지 — 틱이 바뀔 때마다 컴포지션 안에서 새로 읽는다(위 주석).
            val s = remember(tick) { TasksUi(context) }
            TasksRoot(s, titleOnly = LocalSize.current.height < TITLE_ONLY_MAX_H)
        }
    }
}

/** 렌더 한 번에 쓰는 값 묶음 — remember(tick)으로 틱마다 재로드. */
private class TasksUi(context: Context) {
    val paired = WidgetStore.isPaired(context)
    val unauthorized = WidgetStore.unauthorized(context)
    val linked = WidgetStore.tasksLinked(context)
    val items = WidgetStore.taskItems(context)
    val syncedAt = WidgetStore.tasksSyncedAt(context)
    val filter = WidgetStore.tasksFilter(context)
    val deleteMarks = WidgetStore.pendingDeleteIds(context)
    /** 표시 설정(이 폰 전용) — 글자 크기·배경색·항목별 글자색. */
    val textLevel = WidgetStore.textLevel(context, KIND)
    val bgIndex = WidgetStore.bgIndex(context, KIND)
    val colors = WidgetStore.itemColors(context, KIND)
}

/** 표시 설정 저장 키의 위젯 종류. */
private const val KIND = "tasks"

@Composable
private fun TasksRoot(s: TasksUi, titleOnly: Boolean) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            // 배경색은 폰에서 고른 값(요구) — 고르지 않았으면 위젯 기본 배경.
            .background(WidgetStyle.background(s.bgIndex, AgendaTheme.bg))
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        when {
            !s.paired || s.unauthorized -> PairingCta(revoked = s.unauthorized, subject = "작업")
            !s.linked -> NotLinked()
            else -> {
                val visible = when (s.filter) {
                    "done" -> s.items.filter { it.done }
                    "all" -> s.items
                    // 완료는 진행 필터에서 즉시 제외(요구) — 유예 없이 완료·전체에서만 보인다.
                    else -> s.items.filter { !it.done }
                }
                // 제목만 모드에선 필터를 감춘다 — 목록이 없으니 고를 이유가 없고,
                // 그 자리에 '목록'(전체 보기 화면)이 남아 더보기 역할을 한다.
                TasksHeader(s.filter, s.syncedAt, showFilters = !titleOnly)
                if (titleOnly) return@Column
                Spacer(GlanceModifier.height(6.dp))
                if (visible.isEmpty()) {
                    Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            when (s.filter) {
                                "done" -> "완료한 작업이 없습니다"
                                else -> "작업이 없습니다 — ＋로 추가하세요"
                            },
                            style = TextStyle(
                                color = AgendaTheme.textDim,
                                fontSize = WidgetStyle.bodySp(s.textLevel).sp,
                            ),
                        )
                    }
                } else {
                    LazyColumn(GlanceModifier.fillMaxSize()) {
                        // itemId에 상태 비트(삭제 예정·글자색)를 함께 넣는다: 상태가 바뀌면 다른
                        // 항목으로 취급되어 완전 재바인딩 — 재활용 뷰의 클릭 바인딩이 낡는
                        // 문제(재탭 무반응) 차단.
                        items(
                            visible,
                            itemId = {
                                (it.id.hashCode().toLong() shl 4) or
                                    (if (s.deleteMarks.contains(it.id)) 8L else 0L) or
                                    (s.colors[it.id] ?: 0).toLong()
                            },
                        ) {
                            TaskRow(
                                it,
                                markedForDelete = s.deleteMarks.contains(it.id),
                                textLevel = s.textLevel,
                                colorIndex = s.colors[it.id] ?: 0,
                            )
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

/** 관리 화면(완료 토글·삭제·추가·수정)을 여는 인텐트. */
private fun manageIntent(context: Context): Intent =
    Intent(context, TasksListActivity::class.java).apply {
        data = Uri.parse("pbtask://manage/current")
    }

/**
 * 위젯 헤더의 필터 버튼 — 선택된 것은 강조색·굵게. 탭하면 **화면 전환 없이**
 * 위젯 목록이 그 필터로 바뀐다(투명 SetTasksFilterActivity가 포그라운드에서
 * 필터 저장 + 재렌더를 끝내고 닫힌다 — 근거는 그 클래스 주석).
 * 값마다 고유 data URI(`pbfilter://{value}`)라 PendingIntent 병합이 없다.
 */
@Composable
private fun FilterButton(label: String, value: String, current: String) {
    val on = current == value
    val intent = Intent(LocalContext.current, SetTasksFilterActivity::class.java)
        .setData(Uri.parse("pbfilter://$value"))
    Text(
        label,
        modifier = GlanceModifier
            .clickable(actionStartActivity(intent))
            .padding(horizontal = 5.dp, vertical = 6.dp),
        style = TextStyle(
            color = if (on) AgendaTheme.accentProvider else AgendaTheme.textDim,
            fontSize = 12.sp,
            fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
        ),
    )
}

@Composable
private fun TasksHeader(filter: String, syncedAt: Long, showFilters: Boolean = true) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        // 제목 탭 = 표시 설정(글자 크기·배경색). 헤더에 버튼을 하나 더 늘리면 좁은
        // 위젯에서 필터가 밀려나므로 제목에 ⚙ 글리프만 붙였다.
        Text(
            "작업 ⚙",
            modifier = GlanceModifier
                .clickable(actionStartActivity(styleIntent(LocalContext.current, "tasks")))
                .padding(end = 2.dp, top = 4.dp, bottom = 4.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(4.dp))
        // 필터 버튼(진행·완료·전체) — 화면 전환 없이 위젯 목록이 그 필터로 바뀐다.
        if (showFilters) {
            FilterButton("진행", "pending", filter)
            FilterButton("완료", "done", filter)
            FilterButton("전체", "all", filter)
        }
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
        // 목록(관리 화면) — 완료 토글·삭제·새로고침이 여기 있다.
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
private fun TaskRow(
    item: TaskItem,
    markedForDelete: Boolean,
    textLevel: Int,
    colorIndex: Int,
) {
    val bodySp = WidgetStyle.bodySp(textLevel).sp
    // 행 탭 = 수정 화면. 항목별 고유 data URI + extras(값 전달)로 병합 없이 정확히 연다.
    val editIntent = Intent(LocalContext.current, TaskEditActivity::class.java).apply {
        data = Uri.parse("pbtask://edit/${item.id}")
        putExtra("taskId", item.id)
        putExtra("taskTitle", item.title)
        putExtra("taskDone", item.done)
        if (item.dueOn != null) putExtra("taskDue", item.dueOn)
    }
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = WidgetStyle.rowPadDp(textLevel).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 상태 표시 라벨(조작 불가 — 변경은 수정 화면에서).
        Text(
            if (item.done) "완료" else "진행",
            style = TextStyle(
                color = if (item.done) AgendaTheme.textDim else AgendaTheme.accentProvider,
                fontSize = WidgetStyle.scaled(textLevel, 12f).sp,
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
                // 완료·삭제 예정은 상태 표시가 우선(흐리게) — 그 외에만 고른 글자색.
                color = if (item.done || markedForDelete) AgendaTheme.textDim
                else WidgetStyle.itemColor(colorIndex, AgendaTheme.text),
                fontSize = bodySp,
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
            style = TextStyle(color = AgendaTheme.textDim, fontSize = bodySp),
        )
        Spacer(GlanceModifier.width(4.dp))
        // 삭제 예정 표시(요구) — 다음 갱신 때 실제 삭제, ✕ 재탭으로 취소.
        Text(
            if (markedForDelete) "삭제" else "",
            style = TextStyle(
                color = AgendaTheme.danger,
                fontSize = WidgetStyle.scaled(textLevel, 12f).sp,
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
            style = TextStyle(color = AgendaTheme.textDim, fontSize = WidgetStyle.scaled(textLevel, 16f).sp),
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
            style = TextStyle(color = AgendaTheme.text, fontSize = 15.sp, fontWeight = FontWeight.Medium),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            "웹 대시보드에 '작업' 위젯을 추가하고\n속성에서 '모바일 홈 화면에 표시'를 켜세요",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
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
