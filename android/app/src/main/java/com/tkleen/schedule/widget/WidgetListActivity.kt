package com.tkleen.schedule.widget

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.notes.NoteEditActivity
import com.tkleen.schedule.tasks.TaskEditActivity

/**
 * 위젯 '더보기' 팝업(요구) — 홈 화면 위젯은 칸 크기에 갇혀 있어 몇 줄밖에 못 보여
 * 준다. 제목 줄의 **더보기**를 누르면 이 창이 떠서 **목록 전체**를 길게 보여 준다.
 *
 *  **대화상자 테마**(Theme.DeviceDefault.Dialog)라 화면을 꽉 채우지 않는다 —
 *  요구의 "화면 전체를 가리지는 말아 주세요"가 그대로 이 선택의 이유다. 배경으로
 *  홈 화면이 비쳐 보이고, 바깥을 누르면 닫힌다.
 *
 *  내용은 **위젯이 이미 받아 둔 캐시**를 그린다(새 네트워크 호출 0) — 팝업이 즉시
 *  뜨고, 값은 위젯에 보이는 것과 정확히 같다. 행을 누르면 기존 화면으로 간다
 *  (작업=수정, 소제목=내용, 주식·환율=삭제 확인).
 */
class WidgetListActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val kind = intent?.data?.host
            ?.takeIf { it in setOf("tasks", "notes", "stocks", "fx") } ?: "stocks"
        val pad = (16 * resources.displayMetrics.density).toInt()

        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val title = TextView(this).apply {
            text = when (kind) {
                "notes" -> "노트"
                "stocks" -> "주식"
                "fx" -> "환율"
                else -> "작업"
            }
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        }

        val rows: List<Triple<String, String, Intent?>> = when (kind) {
            "stocks" -> WidgetStore.quoteItems(this).map {
                Triple(
                    it.name,
                    "${it.priceText()}   ${it.pctText()} ${it.sessionLabel() ?: ""}".trim(),
                    deleteIntent(this, "stocks", it.symbol, it.name, it.priceText()),
                )
            }
            "fx" -> WidgetStore.fxItems(this).map {
                Triple(
                    it.label(),
                    "${it.krwText()}   ${it.pctText() ?: ""}".trim(),
                    deleteIntent(this, "fx", it.code, it.label(), it.krwText()),
                )
            }
            "notes" -> WidgetStore.noteItems(this).map {
                Triple(
                    it.title,
                    if (it.rich) "🖼 이미지·표 포함" else it.body.lineSequence().firstOrNull().orEmpty(),
                    Intent(this, NoteEditActivity::class.java).apply {
                        data = Uri.parse("pbnote://open/${it.noteId}/${it.sectionId}")
                        putExtra("noteId", it.noteId)
                        putExtra("sectionId", it.sectionId)
                        putExtra("title", it.title)
                        putExtra("body", it.body)
                        putExtra("rich", it.rich)
                        putExtra("noteTitle", it.noteTitle)
                    },
                )
            }
            else -> WidgetStore.taskItems(this).map {
                Triple(
                    it.title,
                    if (it.done) "완료" else "진행",
                    Intent(this, TaskEditActivity::class.java).apply {
                        data = Uri.parse("pbtask://edit/${it.id}")
                        putExtra("taskId", it.id)
                        putExtra("taskTitle", it.title)
                        putExtra("taskDone", it.done)
                        if (it.dueOn != null) putExtra("taskDue", it.dueOn)
                    },
                )
            }
        }

        if (rows.isEmpty()) {
            list.addView(
                TextView(this).apply {
                    text = "표시할 항목이 없습니다."
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    setPadding(0, pad, 0, pad)
                },
            )
        }
        for ((main, sub, open) in rows) {
            list.addView(
                Button(this).apply {
                    text = if (sub.isEmpty()) main else "$main\n$sub"
                    isAllCaps = false
                    gravity = android.view.Gravity.START or android.view.Gravity.CENTER_VERTICAL
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    setOnClickListener {
                        if (open != null) startActivity(open)
                        finish()
                    }
                },
                LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ),
            )
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(pad, pad, pad, pad)
                addView(title)
                addView(
                    TextView(this@WidgetListActivity).apply {
                        text = "${rows.size}건 · 위젯이 마지막으로 받은 목록"
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    },
                )
                // 목록만 스크롤 — 화면 아래까지 길게 보이되 창은 대화상자 크기 그대로.
                addView(
                    ScrollView(this@WidgetListActivity).apply { addView(list) },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f),
                )
                addView(
                    Button(this@WidgetListActivity).apply {
                        text = "닫기"
                        setOnClickListener { finish() }
                    },
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ),
                )
            },
        )
    }
}

/** '더보기' 인텐트 — 종류마다 고유 data URI(PendingIntent 병합 방지, v10 교훈). */
internal fun listIntent(context: Context, kind: String): Intent =
    Intent(context, WidgetListActivity::class.java).setData(Uri.parse("pbmore://$kind"))
