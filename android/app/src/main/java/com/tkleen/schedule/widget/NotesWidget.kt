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
import com.tkleen.schedule.data.model.NoteItem
import com.tkleen.schedule.notes.NoteEditActivity
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 노트 위젯 — 웹 '노트' 위젯의 **소제목을 제목 목록으로** 보여준다.
 *
 *  한 줄 = 노트 안의 소제목 하나다. **웹에서 지정한 노트 위젯 하나**만 본다 —
 *  노트 속성의 '모바일 홈 화면에 표시'를 켠 것(여럿이면 마지막에 켠 것)이 대상이고,
 *  지정이 없으면 목록 대신 안내를 띄운다(작업 위젯과 같은 규칙).
 *  제목을 누르면 내용 화면(NoteEditActivity)이 열려 읽고 고치고 지울 수 있고,
 *  ＋는 그 노트 **맨 위에** 소제목을 하나 만든다(새로 쓴 것이 위로).
 *
 *  ⚠ 이미지·표가 있는 소제목은 목록에 🖼로 표시하고(rich), 내용 화면이 본문을
 *    읽기 전용으로 연다 — 평문으로 덮어쓰면 이미지·표가 사라지기 때문이다.
 *
 *  구현상의 함정은 작업 위젯에서 이미 다 밟았다 — 그대로 따른다:
 *   ① **refreshTick**: 살아 있는 Glance 세션은 updateAll만으로는 옛 값으로 다시
 *      그린다(v15 실측). 틱을 구독해 컴포지션 안에서 prefs를 다시 읽는다.
 *   ② **항목마다 고유 data URI**: PendingIntent는 filterEquals(extras 무시)로
 *      병합되므로, 같은 클래스에 extras만 다른 인텐트는 서로 먹힌다(v10).
 *   ③ **clickable() 먼저, padding() 나중**: 순서가 반대면 터치 영역이 패딩 안쪽으로
 *      좁아져 탭이 빗나간다(v5).
 */
class NotesWidget : GlanceAppWidget() {
    companion object {
        /** 데이터 버전 틱 — 살아 있는 세션의 stale 렌더 방지(TasksWidget과 동일). */
        internal val refreshTick = MutableStateFlow(0)

        /** 데이터 변경 후 반영 — 산 세션은 틱이, 닫힌 세션은 updateAll이 커버. */
        suspend fun refresh(context: Context) {
            refreshTick.value++
            NotesWidget().updateAll(context.applicationContext)
        }
    }

    /** 실제 위젯 크기를 알아야 '제목만' 모드를 판단한다(LocalSize). */
    override val sizeMode = androidx.glance.appwidget.SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val tick by refreshTick.collectAsState()
            // 캡처 금지 — 틱이 바뀔 때마다 컴포지션 안에서 새로 읽는다.
            val s = remember(tick) { NotesUi(context) }
            NotesRoot(s, titleOnly = LocalSize.current.height < TITLE_ONLY_MAX_H)
        }
    }
}

/** 렌더 한 번에 쓰는 값 묶음 — remember(tick)으로 틱마다 재로드. */
private class NotesUi(context: Context) {
    val paired = WidgetStore.isPaired(context)
    val unauthorized = WidgetStore.unauthorized(context)
    val linked = WidgetStore.notesLinked(context)
    val items = WidgetStore.noteItems(context)
    val syncedAt = WidgetStore.notesSyncedAt(context)
    /** 표시 설정(이 폰 전용) — 글자 크기·배경색·소제목별 글자색. */
    val textLevel = WidgetStore.textLevel(context, KIND)
    val bgIndex = WidgetStore.bgIndex(context, KIND)
    val colors = WidgetStore.itemColors(context, KIND)
}

/** 표시 설정 저장 키의 위젯 종류. */
private const val KIND = "notes"

@Composable
private fun NotesRoot(s: NotesUi, titleOnly: Boolean) {
    val bodySp = WidgetStyle.bodySp(s.textLevel).sp
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            // 폰에서 고른 배경색(요구). 기본은 작업 위젯과 구분되는 옅은 회색.
            .background(WidgetStyle.background(s.bgIndex, AgendaTheme.bgNote))
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        if (!s.paired || s.unauthorized) {
            PairingCta(revoked = s.unauthorized, subject = "노트")
        } else {
            // 헤더는 연결 전에도 그린다 — 갱신 시각은 늘 우측 상단에 있어야 한다.
            NotesHeader(s.syncedAt, showAdd = s.linked && !titleOnly)
            if (titleOnly) return@Column // 제목만 모드 — 목록은 '더보기' 팝업에서
            Spacer(GlanceModifier.height(6.dp))
            if (!s.linked) {
                NotLinked()
            } else if (s.items.isEmpty()) {
                Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "소제목이 없습니다 — ＋ 소제목으로 추가하세요",
                        style = TextStyle(color = AgendaTheme.textDim, fontSize = bodySp),
                    )
                }
            } else {
                LazyColumn(GlanceModifier.fillMaxSize()) {
                    // itemId에 글자색을 함께 넣는다 — 색이 바뀌면 다른 항목으로 취급되어
                    // 완전 재바인딩(재활용 뷰의 낡은 클릭 바인딩 차단, v6 교훈).
                    items(
                        s.items,
                        itemId = { (it.key.hashCode().toLong() shl 3) or (s.colors[it.key] ?: 0).toLong() },
                    ) {
                        NoteRow(it, s.textLevel, s.colors[it.key] ?: 0)
                    }
                }
            }
        }
    }
}

/** 아직 어느 노트도 지정되지 않았을 때 — 무엇을 해야 하는지 그대로 알린다. */
@Composable
private fun NotLinked() {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "연결된 노트가 없습니다",
            style = TextStyle(
                color = AgendaTheme.text,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            "웹 대시보드의 '노트' 위젯 속성에서\n'모바일 홈 화면에 표시'를 켜세요",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
        )
    }
}

/** 새 소제목 화면을 여는 인텐트(고유 data URI — 행 인텐트와 병합되지 않는다). */
private fun addIntent(context: Context): Intent =
    Intent(context, NoteEditActivity::class.java).apply {
        data = Uri.parse("pbnote://add")
    }

/**
 * 헤더 — 왼쪽부터 [노트] [＋ 소제목], 오른쪽 끝에 **갱신 시각**(요구).
 *
 * ＋는 글리프 하나만 두면 눈에 띄지 않아 라벨을 붙였다. 연결된 노트가 없으면
 * 추가해 봐야 서버가 409로 막으므로 그때는 감춘다(showAdd=false).
 */
@Composable
private fun NotesHeader(syncedAt: Long, showAdd: Boolean) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        // 제목 탭 = 표시 설정(글자 크기·배경색) — 헤더에 버튼을 더 늘리지 않으려고
        // 제목에 ⚙ 글리프만 붙였다.
        Text(
            "노트 ⚙",
            modifier = GlanceModifier
                .clickable(actionStartActivity(styleIntent(LocalContext.current, "notes")))
                .padding(end = 2.dp, top = 4.dp, bottom = 4.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        if (showAdd) {
            Spacer(GlanceModifier.width(8.dp))
            // 위젯은 텍스트 입력이 불가하므로 작은 입력 화면을 연다.
            // clickable을 padding보다 먼저 — 터치 영역이 패딩까지 포함되도록(v5 교훈).
            Text(
                "＋ 소제목",
                modifier = GlanceModifier
                    .clickable(actionStartActivity(addIntent(LocalContext.current)))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                style = TextStyle(
                    color = AgendaTheme.accentProvider,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        Spacer(GlanceModifier.defaultWeight())
        // 더보기 — 소제목이 많아 위젯에 다 안 들어갈 때 팝업으로 전부 본다(요구).
        Text(
            "더보기",
            modifier = GlanceModifier
                .clickable(actionStartActivity(listIntent(LocalContext.current, "notes")))
                .padding(horizontal = 6.dp, vertical = 4.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
        // 갱신 시각 — 늘 우측 상단 끝(요구). 누르면 즉시 동기화한다(15분을 기다리지
        // 않아도 되게). 투명 포그라운드 액티비티를 거치는 이유는 SyncNowActivity 주석.
        Text(
            if (syncedAt > 0) {
                java.time.ZonedDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(syncedAt),
                    ZoneId.of("Asia/Seoul"),
                ).format(DateTimeFormatter.ofPattern("HH:mm")) + " 갱신"
            } else {
                "갱신 전"
            } + " ↻",
            modifier = GlanceModifier
                .clickable(actionStartActivity(syncIntent(LocalContext.current)))
                .padding(horizontal = 6.dp, vertical = 4.dp),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp),
        )
    }
}

/** 즉시 동기화 인텐트(고유 data URI — 다른 탭과 병합되지 않는다). */
private fun syncIntent(context: Context): Intent =
    Intent(context, SyncNowActivity::class.java).apply {
        data = Uri.parse("pbnote://sync")
    }

@Composable
private fun NoteRow(item: NoteItem, textLevel: Int, colorIndex: Int) {
    // 항목마다 고유 data URI + extras(값 전달) — PendingIntent 병합 없이 정확히 연다.
    val openIntent = Intent(LocalContext.current, NoteEditActivity::class.java).apply {
        data = Uri.parse("pbnote://open/${item.noteId}/${item.sectionId}")
        putExtra("noteId", item.noteId)
        putExtra("sectionId", item.sectionId)
        putExtra("title", item.title)
        putExtra("body", item.body)
        putExtra("rich", item.rich)
        putExtra("noteTitle", item.noteTitle)
    }
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(vertical = WidgetStyle.rowPadDp(textLevel).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // 이미지·표가 든 소제목 표시 — 자리를 늘 차지하게 둔다(행 구조가 상태에
        // 따라 바뀌면 재활용 뷰의 클릭 바인딩이 낡는 런처가 있다 — v6 교훈).
        Text(
            if (item.rich) "🖼" else "",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = WidgetStyle.scaled(textLevel, 12f).sp),
        )
        Spacer(GlanceModifier.width(if (item.rich) 6.dp else 0.dp))
        Text(
            item.title,
            maxLines = 1,
            // clickable을 padding보다 먼저 — 터치 영역이 패딩까지 포함되도록.
            modifier = GlanceModifier
                .defaultWeight()
                .clickable(actionStartActivity(openIntent))
                .padding(vertical = 4.dp),
            style = TextStyle(
                color = WidgetStyle.itemColor(colorIndex, AgendaTheme.text),
                fontSize = WidgetStyle.bodySp(textLevel).sp,
            ),
        )
        Text(
            "›",
            modifier = GlanceModifier
                .clickable(actionStartActivity(openIntent))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = WidgetStyle.scaled(textLevel, 16f).sp),
        )
    }
}
