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
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionStartActivity
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
import androidx.glance.text.TextStyle
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.MemoItem
import com.tkleen.schedule.memo.MemoEditActivity
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 메모 위젯 — 웹 '메모' 위젯들과 양방향 동기화되는 **제목 목록**.
 *
 *  네이버 메모처럼 메모를 쌓아 두되, 그와 달리 **화면에는 제목만 나열한다**(요구).
 *  제목을 누르면 내용 화면(MemoEditActivity)이 열려 읽고 고칠 수 있다.
 *
 *  메모 한 건 = 웹 '메모' 위젯 인스턴스 하나다 — 작업(pb_tasks)과 달리 전용 표가
 *  없고 본문은 pb_widgets.config에 있다. 그래서 ＋ 추가는 캔버스에 메모 위젯을
 *  하나 더 만드는 일이 된다(서버가 기본 보드 맨 아래에 놓는다).
 *
 *  ⚠ 잠긴 메모(웹에서 비밀번호 설정)는 제목만 오고 본문은 오지 않는다. 목록에
 *    자물쇠로 표시하고, 눌러도 내용 대신 안내만 보여준다.
 *
 *  구현상의 함정은 작업 위젯에서 이미 다 밟았다 — 그대로 따른다:
 *   ① **refreshTick**: 살아 있는 Glance 세션은 updateAll만으로는 옛 값으로 다시
 *      그린다(v15 실측). 틱을 구독해 컴포지션 안에서 prefs를 다시 읽는다.
 *   ② **항목마다 고유 data URI**: PendingIntent는 filterEquals(extras 무시)로
 *      병합되므로, 같은 클래스+extras만 다른 인텐트는 서로 먹힌다(v10).
 *   ③ **clickable() 먼저, padding() 나중**: 순서가 반대면 터치 영역이 패딩 안쪽으로
 *      좁아져 탭이 빗나간다(v5).
 */
class MemosWidget : GlanceAppWidget() {
    companion object {
        /** 데이터 버전 틱 — 살아 있는 세션의 stale 렌더 방지(TasksWidget과 동일). */
        internal val refreshTick = MutableStateFlow(0)

        /** 데이터 변경 후 반영 — 산 세션은 틱이, 닫힌 세션은 updateAll이 커버. */
        suspend fun refresh(context: Context) {
            refreshTick.value++
            MemosWidget().updateAll(context.applicationContext)
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val tick by refreshTick.collectAsState()
            // 캡처 금지 — 틱이 바뀔 때마다 컴포지션 안에서 새로 읽는다.
            val s = remember(tick) { MemosUi(context) }
            MemosRoot(s.paired, s.unauthorized, s.items, s.syncedAt)
        }
    }
}

/** 렌더 한 번에 쓰는 값 묶음 — remember(tick)으로 틱마다 재로드. */
private class MemosUi(context: Context) {
    val paired = WidgetStore.isPaired(context)
    val unauthorized = WidgetStore.unauthorized(context)
    val items = WidgetStore.memoItems(context)
    val syncedAt = WidgetStore.memosSyncedAt(context)
}

@Composable
private fun MemosRoot(
    paired: Boolean,
    unauthorized: Boolean,
    items: List<MemoItem>,
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
        if (!paired || unauthorized) {
            PairingCta(revoked = unauthorized, subject = "메모")
        } else {
            MemosHeader(syncedAt)
            Spacer(GlanceModifier.height(6.dp))
            if (items.isEmpty()) {
                Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "메모가 없습니다 — ＋로 추가하세요",
                        style = TextStyle(color = AgendaTheme.textDim, fontSize = 15.sp),
                    )
                }
            } else {
                LazyColumn(GlanceModifier.fillMaxSize()) {
                    items(items, itemId = { it.id.hashCode().toLong() }) { MemoRow(it) }
                }
            }
        }
    }
}

/** 새 메모 화면을 여는 인텐트(고유 data URI — 행 인텐트와 병합되지 않는다). */
private fun addIntent(context: Context): Intent =
    Intent(context, MemoEditActivity::class.java).apply {
        data = Uri.parse("pbmemo://add")
    }

@Composable
private fun MemosHeader(syncedAt: Long) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "메모",
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
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
        // ＋ 추가 — 위젯은 텍스트 입력이 불가하므로 작은 입력 화면을 연다.
        Text(
            "＋",
            modifier = GlanceModifier
                .clickable(actionStartActivity(addIntent(LocalContext.current)))
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
private fun MemoRow(item: MemoItem) {
    // 항목마다 고유 data URI + extras(값 전달) — PendingIntent 병합 없이 정확히 연다.
    val openIntent = Intent(LocalContext.current, MemoEditActivity::class.java).apply {
        data = Uri.parse("pbmemo://open/${item.id}")
        putExtra("memoId", item.id)
        putExtra("memoTitle", item.title)
        putExtra("memoBody", item.body)
        putExtra("memoLocked", item.locked)
    }
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 잠긴 메모 표시 — 자리를 늘 차지하게 둔다(행 구조가 상태에 따라 바뀌면
        // 재활용 뷰의 클릭 바인딩이 낡는 런처가 있다 — v6 교훈).
        Text(
            if (item.locked) "🔒" else "",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 12.sp),
        )
        Spacer(GlanceModifier.width(if (item.locked) 6.dp else 0.dp))
        Text(
            item.title,
            maxLines = 1,
            // clickable을 padding보다 먼저 — 터치 영역이 패딩까지 포함되도록.
            modifier = GlanceModifier
                .defaultWeight()
                .clickable(actionStartActivity(openIntent))
                .padding(vertical = 4.dp),
            style = TextStyle(color = AgendaTheme.text, fontSize = 15.sp),
        )
        Text(
            "›",
            modifier = GlanceModifier
                .clickable(actionStartActivity(openIntent))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 16.sp),
        )
    }
}
