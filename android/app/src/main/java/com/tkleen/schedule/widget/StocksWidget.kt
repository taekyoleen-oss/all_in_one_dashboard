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
import com.tkleen.schedule.data.model.QuoteItem
import com.tkleen.schedule.quotes.QuoteAddActivity
import com.tkleen.schedule.quotes.QuoteDeleteActivity
import kotlinx.coroutines.flow.MutableStateFlow
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 주식 위젯 — 웹 '주식' 위젯 하나의 종목 시세를 그대로 보여 준다.
 *
 *  헤더 ＋로 **종목을 추가**하고, 행을 누르면 **삭제** 화면이 열린다(요구).
 *  헤더의 **숨기기/보이기**로 내용을 접었다 폈다 한다(공간은 그대로). 시세는
 *  서버가 주는 값을 그리기만 한다 — 폰에서 계산하는 값은 없다.
 *  대상 위젯은 속성의 '모바일 홈 화면에 표시'로 고르고, 주식 위젯이 하나뿐이면
 *  켜지 않아도 그것을 본다(서버 규칙 — lib/api/widgetMobileTarget.ts).
 *
 *  **시간외 표식**(요구): 정규장 밖 체결로 만들어진 값이면 이름 옆에 PRE·시간외·AFTER가
 *  붙는다. 등락은 그때도 **전일 종가 대비**라 값의 의미가 바뀌지 않는다.
 *
 *  Glance 함정은 작업·노트 위젯에서 밟은 그대로 따른다: refreshTick 재구성(v15),
 *  clickable()→padding() 순서(v5), 행 자식 구조 고정(v6), 고유 data URI(v10).
 */
class StocksWidget : GlanceAppWidget() {
    companion object {
        internal val refreshTick = MutableStateFlow(0)

        suspend fun refresh(context: Context) {
            refreshTick.value++
            StocksWidget().updateAll(context.applicationContext)
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val tick by refreshTick.collectAsState()
            val s = remember(tick) { StocksUi(context) }
            StocksRoot(s)
        }
    }
}

/** 렌더 한 번에 쓰는 값 묶음 — remember(tick)으로 틱마다 재로드. */
private class StocksUi(context: Context) {
    val paired = WidgetStore.isPaired(context)
    val unauthorized = WidgetStore.unauthorized(context)
    val linked = WidgetStore.stocksLinked(context)
    val items = WidgetStore.quoteItems(context)
    val syncedAt = WidgetStore.stocksSyncedAt(context)
    /** 숨기기/보이기(요구) — 제목만 그릴지. */
    val hidden = WidgetStore.hidden(context, KIND)
    val textLevel = WidgetStore.textLevel(context, KIND)
    val bgIndex = WidgetStore.bgIndex(context, KIND)
}

/** 표시 설정 저장 키의 위젯 종류. */
private const val KIND = "stocks"

@Composable
private fun StocksRoot(s: StocksUi) {
    val bodySp = WidgetStyle.bodySp(s.textLevel).sp
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(WidgetStyle.background(s.bgIndex, AgendaTheme.bg))
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        if (!s.paired || s.unauthorized) {
            PairingCta(revoked = s.unauthorized, subject = "주식")
        } else {
            QuoteHeader("주식", KIND, s.syncedAt, showAdd = s.linked && !s.hidden, hidden = s.hidden)
            // 숨김 상태: 여기서 끝낸다 — 공간은 그대로 두고 제목 줄만 남는다(요구).
            if (s.hidden) return@Column
            Spacer(GlanceModifier.height(6.dp))
            if (!s.linked) {
                NotLinkedHint("주식")
            } else if (s.items.isEmpty()) {
                Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "종목이 없습니다 — ＋ 종목으로 추가하세요",
                        style = TextStyle(color = AgendaTheme.textDim, fontSize = bodySp),
                    )
                }
            } else {
                LazyColumn(GlanceModifier.fillMaxSize()) {
                    items(s.items, itemId = { it.symbol.hashCode().toLong() }) {
                        QuoteRow(it, s.textLevel)
                    }
                }
            }
        }
    }
}

@Composable
private fun QuoteRow(item: QuoteItem, textLevel: Int) {
    val bodySp = WidgetStyle.bodySp(textLevel).sp
    val dir = when {
        item.changePct > 0 -> AgendaTheme.up
        item.changePct < 0 -> AgendaTheme.down
        else -> AgendaTheme.textDim
    }
    // 행 탭 = 삭제 화면(요구). clickable을 padding보다 먼저 — 터치 영역이 패딩까지
    // 포함되도록(v5 교훈).
    val open = deleteIntent(
        LocalContext.current, KIND, item.symbol, item.name, item.priceText(),
    )
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .clickable(actionStartActivity(open))
            .padding(vertical = WidgetStyle.rowPadDp(textLevel).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            item.name,
            maxLines = 1,
            modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = AgendaTheme.text, fontSize = bodySp),
        )
        // 시간외 표식 — 자리는 늘 차지한다(상태에 따라 행 구조가 바뀌면 재활용 뷰가
        // 낡는 런처가 있다, v6). 없을 땐 빈 문자열.
        Text(
            item.sessionLabel() ?: "",
            style = TextStyle(
                color = AgendaTheme.warn,
                fontSize = WidgetStyle.scaled(textLevel, 11f).sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(
            item.priceText(),
            style = TextStyle(
                color = AgendaTheme.text,
                fontSize = bodySp,
                fontWeight = FontWeight.Medium,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(
            item.pctText(),
            style = TextStyle(color = dir, fontSize = WidgetStyle.scaled(textLevel, 13f).sp),
        )
    }
}

/**
 * 주식·환율이 함께 쓰는 헤더 — 제목 탭 = 표시 설정(⚙), 우측 끝 갱신 시각 탭 = 즉시 동기화.
 * 두 위젯 다 조작이 없어 헤더가 유일한 진입점이다.
 */
@Composable
internal fun QuoteHeader(
    title: String,
    kind: String,
    syncedAt: Long,
    showAdd: Boolean = true,
    hidden: Boolean = false,
) {
    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "$title ⚙",
            modifier = GlanceModifier
                .clickable(actionStartActivity(styleIntent(LocalContext.current, kind)))
                .padding(end = 2.dp, top = 4.dp, bottom = 4.dp),
            style = TextStyle(
                color = AgendaTheme.accentProvider,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            ),
        )
        Spacer(GlanceModifier.width(4.dp))
        HideToggle(kind, hidden)
        if (showAdd) {
            Spacer(GlanceModifier.width(6.dp))
            // 위젯은 텍스트 입력이 불가하므로 작은 화면을 연다(계획서 §0.3 원칙).
            // 글리프 하나만 두면 눈에 띄지 않아 라벨을 붙인다(노트 위젯 v20 교훈).
            Text(
                "＋",
                modifier = GlanceModifier
                    .clickable(actionStartActivity(addIntent(LocalContext.current, kind)))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                style = TextStyle(
                    color = AgendaTheme.accentProvider,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                ),
            )
        }
        Spacer(GlanceModifier.defaultWeight())
        Text(
            if (syncedAt > 0) {
                java.time.ZonedDateTime.ofInstant(
                    java.time.Instant.ofEpochMilli(syncedAt),
                    ZoneId.of("Asia/Seoul"),
                ).format(DateTimeFormatter.ofPattern("HH:mm"))
            } else {
                "갱신 전"
            } + " ↻",
            modifier = GlanceModifier
                .clickable(
                    actionStartActivity(
                        Intent(LocalContext.current, SyncNowActivity::class.java)
                            .setData(Uri.parse("pb$kind://sync")),
                    ),
                )
                .padding(horizontal = 6.dp, vertical = 4.dp),
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp),
        )
    }
}

/** 추가 화면 인텐트 — 종류마다 고유 data URI(PendingIntent 병합 방지, v10). */
private fun addIntent(context: Context, kind: String): Intent =
    Intent(context, QuoteAddActivity::class.java).setData(Uri.parse("pbadd://$kind"))

/**
 * 삭제 화면 인텐트 — **항목마다 고유 data URI**라야 한다. PendingIntent는
 * filterEquals(extras 무시)로 병합되므로 같은 클래스에 extras만 다르면 서로
 * 먹힌다(v10에서 목록의 ✕들이 실제로 그랬다).
 */
internal fun deleteIntent(
    context: Context,
    kind: String,
    key: String,
    label: String,
    detail: String,
): Intent = Intent(context, QuoteDeleteActivity::class.java).apply {
    data = Uri.parse("pbdel://$kind/" + Uri.encode(key))
    putExtra("kind", kind)
    putExtra("key", key)
    putExtra("label", label)
    putExtra("detail", detail)
}

/**
 * **숨기기 / 보이기**(요구) — 누르면 내용이 접혀 제목 줄만 남고, 다시 누르면
 * 원래대로 돌아온다. 위젯이 차지한 홈 화면 공간은 그대로다(요구 문장 그대로).
 * 네 위젯이 함께 쓴다.
 */
@Composable
internal fun HideToggle(kind: String, hidden: Boolean) {
    Text(
        if (hidden) "보이기" else "숨기기",
        modifier = GlanceModifier
            .clickable(actionStartActivity(toggleHiddenIntent(LocalContext.current, kind)))
            .padding(horizontal = 6.dp, vertical = 4.dp),
        style = TextStyle(
            color = AgendaTheme.accentProvider,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
        ),
    )
}

/** 대상 위젯이 없을 때 — 무엇을 해야 하는지 그대로 알린다. */
@Composable
internal fun NotLinkedHint(subject: String) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "연결된 $subject 위젯이 없습니다",
            style = TextStyle(
                color = AgendaTheme.text,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            "웹 대시보드의 '$subject' 위젯 속성에서\n'모바일 홈 화면에 표시'를 켜세요",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 13.sp),
        )
    }
}
