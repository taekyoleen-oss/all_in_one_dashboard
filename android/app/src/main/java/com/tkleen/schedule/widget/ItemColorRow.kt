package com.tkleen.schedule.widget

import android.app.Activity
import android.content.res.Configuration
import android.graphics.Typeface
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.tkleen.schedule.data.WidgetStore
import kotlinx.coroutines.runBlocking

/** 이 폰이 지금 다크 모드인가 — 색 미리보기를 위젯과 같은 쪽으로 맞춘다. */
internal fun Activity.isNightMode(): Boolean =
    resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK ==
        Configuration.UI_MODE_NIGHT_YES

/**
 * 항목 글자색 고르기 줄(요구) — 작업 수정 화면과 소제목 화면이 함께 쓴다.
 *
 *  색은 **이 폰에만** 저장되는 표시 설정이라 고르는 즉시 반영한다(서버 왕복이
 *  없으니 '저장'을 기다릴 이유가 없다. 화면을 '취소'로 닫아도 색은 남는다 —
 *  글 내용과 별개의 설정이라는 뜻).
 *
 *  추가(새 항목) 화면에서는 부르지 않는다: id를 서버가 만들기 때문에 아직 색을
 *  걸 대상이 없다. 저장한 뒤 그 항목을 눌러 고르면 된다.
 */
internal fun itemColorRow(activity: Activity, kind: String, id: String): LinearLayout {
    val night = activity.isNightMode()
    val buttons = mutableListOf<Button>()

    fun paint() {
        val current = WidgetStore.itemColor(activity, kind, id)
        buttons.forEachIndexed { i, b ->
            b.text = if (i == current) "✓ " + WidgetStyle.ITEM_LABELS[i] else WidgetStyle.ITEM_LABELS[i]
            if (i > 0) b.setTextColor(WidgetStyle.itemArgb(i, night))
            b.setTypeface(null, if (i == current) Typeface.BOLD else Typeface.NORMAL)
        }
    }

    val row = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL }
    WidgetStyle.ITEM_LABELS.indices.forEach { i ->
        val b = Button(activity).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(0, 0, 0, 0)
            setOnClickListener {
                WidgetStore.setItemColor(activity, kind, id, i)
                paint()
                refreshWidget(activity, kind)
            }
        }
        buttons += b
        row.addView(b, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
    }
    paint()

    return LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        addView(
            TextView(activity).apply {
                text = "글자색 (이 폰에서만)"
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            },
        )
        addView(
            row,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ),
        )
    }
}

/** 표시 설정 변경을 해당 위젯에 즉시 반영 — 메인 스레드를 막지 않는다. */
internal fun refreshWidget(activity: Activity, kind: String) {
    val app = activity.applicationContext
    Thread {
        try {
            runBlocking {
                if (kind == "notes") NotesWidget.refresh(app) else TasksWidget.refresh(app)
            }
        } catch (e: Exception) {
            // 재렌더 실패해도 설정은 저장됐다 — 다음 렌더가 반영한다.
        }
    }.start()
}
