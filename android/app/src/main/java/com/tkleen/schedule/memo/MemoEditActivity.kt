package com.tkleen.schedule.memo

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.sync.AgendaSyncWorker
import com.tkleen.schedule.widget.MemosWidget
import kotlinx.coroutines.runBlocking

/**
 * 메모 내용 화면 — 위젯의 제목을 누르면(수정) 또는 ＋(새 메모)가 연다.
 *
 *  요구의 핵심이 여기다: 위젯에는 **제목만** 늘어놓고, 누르면 이 화면에서 내용을
 *  본다. 편집도 같은 화면에서 한다(보기 전용 화면을 따로 두면 고치려고 한 번 더
 *  들어가야 한다).
 *
 *  ⚠ 잠긴 메모는 본문이 아예 전송되지 않는다 — 읽을 내용이 없으므로 안내만 띄운다.
 *    폰에서 잠금을 푸는 경로는 두지 않았다(그러면 화면 잠금이 무의미해진다).
 *  ⚠ 액션바는 숨긴다 — targetSdk 36 edge-to-edge에서 제목 바가 입력 위로 겹친다
 *    (작업 입력 화면에서 겪은 것과 같은 문제).
 */
class MemoEditActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        val memoId = intent?.getStringExtra("memoId")
        val isEdit = memoId != null
        val locked = intent?.getBooleanExtra("memoLocked", false) == true

        val pad = (16 * resources.displayMetrics.density).toInt()
        val heading = TextView(this).apply {
            text = if (!isEdit) "새 메모" else if (locked) "잠긴 메모" else "메모"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }

        if (locked) {
            showLocked(heading, pad)
            return
        }

        val titleInput = EditText(this).apply {
            hint = "제목"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTypeface(typeface, Typeface.BOLD)
            inputType = InputType.TYPE_CLASS_TEXT
            setText(intent?.getStringExtra("memoTitle")?.takeIf { it != "제목 없음" } ?: "")
        }
        val bodyInput = EditText(this).apply {
            hint = "내용"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            // 여러 줄 — 위쪽 정렬로 긴 메모도 자연스럽게 읽힌다.
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            gravity = Gravity.TOP or Gravity.START
            setHorizontallyScrolling(false)
            isVerticalScrollBarEnabled = true
            setText(intent?.getStringExtra("memoBody") ?: "")
        }

        val status = TextView(this).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        val saveBtn = Button(this).apply { text = "저장" }
        val cancelBtn = Button(this).apply { text = "취소" }
        cancelBtn.setOnClickListener { finish() }

        saveBtn.setOnClickListener {
            val title = titleInput.text.toString().trim()
            val body = bodyInput.text.toString()
            if (title.isEmpty() && body.isBlank()) {
                status.text = "제목이나 내용을 입력해 주세요."
                return@setOnClickListener
            }
            saveBtn.isEnabled = false
            status.text = "저장 중…"
            Thread {
                val token = WidgetStore.loadToken(this)
                val result = when {
                    token == null ->
                        WidgetApi.MutResult.Fail("연결이 해제되었습니다. 위젯에서 다시 연결하세요.")
                    isEdit -> WidgetApi.updateMemo(token, memoId!!, title, body)
                    else -> WidgetApi.addMemo(token, title, body)
                }
                runOnUiThread {
                    when (result) {
                        is WidgetApi.MutResult.Ok -> {
                            if (isEdit) applyOptimisticEdit(memoId!!, title, body)
                            // 새 메모는 서버가 만든 id가 필요하므로 재조회한다.
                            else AgendaSyncWorker.syncNow(this)
                            Toast.makeText(this, "저장되었습니다", Toast.LENGTH_SHORT).show()
                            finish()
                        }
                        is WidgetApi.MutResult.Fail -> {
                            saveBtn.isEnabled = true
                            status.text = result.message
                        }
                    }
                }
            }.start()
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                fitsSystemWindows = true // edge-to-edge에서 상태바와 겹치지 않게
                setPadding(pad, pad, pad, pad)
                addView(heading)
                addView(space(pad))
                addView(
                    titleInput,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ),
                )
                addView(space(pad / 2))
                // 본문은 남는 세로 공간을 전부 쓴다(weight 1) — 긴 메모도 한눈에.
                addView(
                    bodyInput,
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        0,
                        1f,
                    ),
                )
                addView(space(pad / 2))
                addView(
                    LinearLayout(this@MemoEditActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        addView(
                            saveBtn,
                            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                        )
                        addView(
                            cancelBtn,
                            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
                        )
                    },
                    LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                    ),
                )
                addView(space(pad / 2))
                addView(status)
            },
        )
        // 새 메모는 제목부터, 기존 메모는 읽으러 온 것이므로 키보드를 띄우지 않는다.
        if (!isEdit) titleInput.requestFocus()
    }

    /** 잠긴 메모 — 읽을 본문이 오지 않았다는 사실을 그대로 알린다. */
    private fun showLocked(heading: TextView, pad: Int) {
        val title = TextView(this).apply {
            text = intent?.getStringExtra("memoTitle") ?: ""
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTypeface(typeface, Typeface.BOLD)
        }
        val notice = TextView(this).apply {
            text = "비밀번호가 걸린 메모입니다.\n\n" +
                "내용은 휴대폰으로 내려받지 않습니다 — 웹 대시보드에서 잠금을 푼 뒤 확인해 주세요."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
        }
        val closeBtn = Button(this).apply { text = "닫기" }
        closeBtn.setOnClickListener { finish() }

        setContentView(
            ScrollView(this).apply {
                fitsSystemWindows = true
                addView(
                    LinearLayout(this@MemoEditActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(pad, pad, pad, pad)
                        addView(heading)
                        addView(space(pad))
                        addView(title)
                        addView(space(pad / 2))
                        addView(notice)
                        addView(space(pad))
                        addView(
                            closeBtn,
                            LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT,
                            ),
                        )
                    },
                )
            },
        )
    }

    /** 수정 결과를 캐시에 즉시 반영 — 위젯 목록의 제목이 바로 바뀐다. */
    private fun applyOptimisticEdit(id: String, title: String, body: String) {
        WidgetStore.mutateMemos(this) { list ->
            list.map {
                if (it.id == id) {
                    it.copy(title = title.ifEmpty { firstLine(body) }, body = body)
                } else {
                    it
                }
            }
        }
        // finish() 직전이라 launch는 취소될 수 있다 — 갱신을 끝내고 넘어간다.
        runBlocking { MemosWidget.refresh(applicationContext) }
    }

    /** 제목이 빈 메모의 목록 표시 — 서버(widgetMemo.ts)와 같은 규칙. */
    private fun firstLine(text: String): String {
        val line = text.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: ""
        return when {
            line.isEmpty() -> "제목 없음"
            line.length > 40 -> line.take(40) + "…"
            else -> line
        }
    }

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
