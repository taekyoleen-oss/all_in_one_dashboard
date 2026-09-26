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
    /** 접혔을 때 배경 투명(옵션) — 주식은 기본 켜짐. */
    val clear = WidgetStore.collapsedClear(context, KIND)
    /** 접혔을 때 크게 띄울 종목(요구) — 지금 목록에 있는 것만, 목록 순서 그대로. */
    val summary = WidgetStore.summarySymbols(context, items)
        .let { picked -> items.filter { it.symbol in picked } }
        .take(6)
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
            // 접혔고 '투명' 옵션이면 배경을 아예 칠하지 않는다 — 홈 화면 배경 위에
            // 요약만 떠 있게(요구). 펼치면 원래 배경으로 돌아온다.
            .let { if (s.hidden && s.clear) it else it.background(WidgetStyle.background(s.bgIndex, AgendaTheme.bg)) }
            .cornerRadius(16.dp)
            .padding(12.dp),
    ) {
        if (!s.paired || s.unauthorized) {
            PairingCta(revoked = s.unauthorized, subject = "주식")
        } else {
            QuoteHeader("주식", KIND, s.syncedAt, showAdd = s.linked && !s.hidden, hidden = s.hidden)
            // 숨김 상태: 목록 대신 **요약**을 크게 그리고 끝낸다(요구). 접어 둔 공간이
            // 비지 않도록 — 고른 종목이 없으면 제목 줄만 남는다.
            if (s.hidden) {
                if (s.summary.isNotEmpty()) {
                    Spacer(GlanceModifier.height(6.dp))
                    Column(GlanceModifier.fillMaxWidth()) {
                        for (q in s.summary) SummaryRow(q, s.textLevel)
                    }
                }
                return@Column
            }
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

/**
 * 접었을 때의 **요약 행**(요구) — 코스피·코스닥·다우·S&P500·필라델피아 반도체처럼
 * 고른 종목을 평소 목록보다 **크게**, 상승은 빨강·하락은 파랑(한국 관례)으로 그린다.
 * 평소 행과 눈으로 구분되는 것이 목적이라 이름과 등락률만 키우고, 값은 작게 곁들인다.
 *
 * 탭 동작을 주지 않는다 — 접힌 상태에서 행을 눌러 삭제 화면이 열리면 놀란다.
 *
 * 크기·간격은 요구로 한 번 더 키웠다(22→28sp = 글자 크기 단계 2칸, 값 13→16sp,
 * 행 여백 6→10dp = 행 사이 20dp). 여기서도 `scaled`를 쓰므로 ⚙의 글자 크기 설정을
 * 올리면 요약 글자와 간격이 같은 비율로 함께 커진다.
 */
@Composable
private fun SummaryRow(item: QuoteItem, textLevel: Int) {
    // 값·등락률은 **늘 같은 크기**(요구) — 지수든 종목이든 숫자가 한 덩어리로 읽힌다.
    val bigSp = WidgetStyle.scaled(textLevel, 28f).sp
    // 자동 축소는 **이름에만**(요구) — "필라델피아 반도체"처럼 긴 이름만 작아진다.
    val nameSp = WidgetStyle.scaled(textLevel, 28f * nameScale(item.name)).sp
    val dir = when {
        item.changePct > 0 -> AgendaTheme.up
        item.changePct < 0 -> AgendaTheme.down
        else -> AgendaTheme.textDim
    }
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(vertical = WidgetStyle.scaled(textLevel, 10f).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            item.name,
            maxLines = 1,
            modifier = GlanceModifier.defaultWeight(),
            style = TextStyle(color = AgendaTheme.text, fontSize = nameSp, fontWeight = FontWeight.Bold),
        )
        Text(
            item.priceText(),
            style = TextStyle(
                color = AgendaTheme.textDim,
                fontSize = WidgetStyle.scaled(textLevel, 16f).sp,
            ),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(
            item.pctText(),
            style = TextStyle(color = dir, fontSize = bigSp, fontWeight = FontWeight.Bold),
        )
    }
}

/**
 * 긴 이름을 **이름 글자만** 줄여 맞춘다(요구). Glance엔 자동 축소(autosize)가 없으므로
 * **글자 폭**으로 계산한다 — 한글·한자·가나는 로마자의 두 배 폭이라 2로 센다
 * ("코스피"=6, "삼성전자"=8, "필라델피아 반도체"=17, "KODEX 200선물인버스2X"=21).
 *
 * 한 칸이 대략 `0.52 × 글자크기` dp를 먹고, 값·등락률이 쓰고 남는 이름 자리는 4칸 위젯에서
 * 대략 105dp다 → 들어갈 수 있는 크기 = `105 / (0.52 × 폭)`, 이를 기준 28sp로 나누면 `7.6 / 폭`.
 *
 * 계수와 하한은 **요구로 두 번 올렸다**(6.8→7.6 · 0.42→0.46→**0.50**) — "13sp 정도로, 다른 긴
 * 이름도 전체적으로", 이어서 "글자가 많은 경우 1sp 더". 마지막 요구는 **가장 긴 이름들만**
 * 해당하므로 계수(7.6)는 그대로 두고 하한만 올렸다 — 중간 길이(삼성전자·SK하이닉스)까지 더
 * 키우면 그쪽이 먼저 잘린다. 하한 **0.50 = 기본 설정에서 14sp**이고, 긴 이름들이
 * 계산상 자리(105dp)를 5dp쯤 넘어서므로 좁은 위젯에서는 끝이 말줄임될 수 있다 — 작게 보이는
 * 쪽보다 큰 쪽을 택한 결과다.
 *
 * ponytail: 위젯 폭을 4칸(≈290dp)으로 가정한 상수다. 더 좁으면 말줄임되고 더 넓으면 조금
 * 작게 보일 뿐이라 감수한다 — 실제 폭을 읽으려면 SizeMode.Exact가 필요한데(v25에서 걷어냄)
 * 그 대가가 이 오차보다 크다.
 */
private fun nameScale(name: String): Float {
    val width = name.fold(0) { acc, c -> acc + if (c.code > 0x2E80) 2 else 1 }
    return (7.6f / width).coerceIn(0.50f, 1f)
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
