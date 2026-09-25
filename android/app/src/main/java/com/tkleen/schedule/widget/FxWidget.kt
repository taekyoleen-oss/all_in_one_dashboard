package com.tkleen.schedule.widget

import android.content.Context
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
import androidx.glance.text.TextStyle
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.FxItem
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * 환율 위젯 — 웹 '환율' 위젯 하나의 통화를 **원화 기준**으로 보여 준다.
 *
 *  헤더 ＋로 **통화를 추가**하고 행을 누르면 **삭제** 화면이 열린다(요구). 헤더 구성·
 *  대상 선택 규칙은 주식 위젯과 같다(StocksWidget.QuoteHeader / NotLinkedHint 공유).
 *
 *  환산과 전일 대비는 **서버가 끝낸 값**을 그대로 그린다 — 폰에서 다시 계산하면
 *  웹과 숫자가 갈라진다(components/widgets/fx/rows.ts 한 곳에서만 계산).
 */
class FxWidget : GlanceAppWidget() {
    companion object {
        internal val refreshTick = MutableStateFlow(0)

        suspend fun refresh(context: Context) {
            refreshTick.value++
            FxWidget().updateAll(context.applicationContext)
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val tick by refreshTick.collectAsState()
            val s = remember(tick) { FxUi(context) }
            FxRoot(s)
        }
    }
}

private class FxUi(context: Context) {
    val paired = WidgetStore.isPaired(context)
    val unauthorized = WidgetStore.unauthorized(context)
    val linked = WidgetStore.fxLinked(context)
    val items = WidgetStore.fxItems(context)
    val syncedAt = WidgetStore.fxSyncedAt(context)
    /** 숨기기/보이기(요구) — 제목만 그릴지. */
    val hidden = WidgetStore.hidden(context, KIND)
    /** 접혔을 때 배경 투명(옵션) — 환율은 기본 켜짐(요구: "투명하게 하여 접어"). */
    val clear = WidgetStore.collapsedClear(context, KIND)
    val textLevel = WidgetStore.textLevel(context, KIND)
    val bgIndex = WidgetStore.bgIndex(context, KIND)
}

/** 표시 설정 저장 키의 위젯 종류. */
private const val KIND = "fx"

@Composable
private fun FxRoot(s: FxUi) {
    val bodySp = WidgetStyle.bodySp(s.textLevel).sp
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            // 접히면 배경을 칠하지 않는다(요구) — 제목 줄만 홈 화면 위에 남는다.
            .let { if (s.hidden && s.clear) it else it.background(WidgetStyle.background(s.bgIndex, AgendaTheme.bg)) }
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        if (!s.paired || s.unauthorized) {
            PairingCta(revoked = s.unauthorized, subject = "환율")
        } else {
            QuoteHeader("환율", KIND, s.syncedAt, showAdd = s.linked && !s.hidden, hidden = s.hidden)
            if (s.hidden) return@Column // 숨김 — 공간은 그대로, 제목 줄만(요구)
            Spacer(GlanceModifier.height(6.dp))
            if (!s.linked) {
                NotLinkedHint("환율")
            } else if (s.items.isEmpty()) {
                Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "통화가 없습니다 — ＋ 통화로 추가하세요",
                        style = TextStyle(color = AgendaTheme.textDim, fontSize = bodySp),
                    )
                }
            } else {
                LazyColumn(GlanceModifier.fillMaxSize()) {
                    items(s.items, itemId = { it.code.hashCode().toLong() }) {
                        FxRow(it, s.textLevel)
                    }
                }
            }
        }
    }
}

@Composable
private fun FxRow(item: FxItem, textLevel: Int) {
    val bodySp = WidgetStyle.bodySp(textLevel).sp
    val pct = item.changePct ?: 0.0
    val dir = when {
        item.changePct == null -> AgendaTheme.textDim
        pct > 0 -> AgendaTheme.up
        pct < 0 -> AgendaTheme.down
        else -> AgendaTheme.textDim
    }
    // 행 탭 = 삭제 화면(요구) — 항목마다 고유 data URI로 병합을 막는다(v10).
    val open = deleteIntent(
        LocalContext.current, KIND, item.code, item.label(), item.krwText(),
    )
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .clickable(actionStartActivity(open))
            .padding(vertical = WidgetStyle.rowPadDp(textLevel).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            item.label(),
            maxLines = 1,
            modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = AgendaTheme.text, fontSize = bodySp),
        )
        Text(
            item.krwText(),
            style = TextStyle(
                color = AgendaTheme.text,
                fontSize = bodySp,
                fontWeight = FontWeight.Medium,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        // 전일 대비를 모르면 자리만 비워 둔다(행 구조는 상태와 무관하게 고정 — v6).
        Text(
            item.pctText() ?: "",
            style = TextStyle(color = dir, fontSize = WidgetStyle.scaled(textLevel, 13f).sp),
        )
    }
}
