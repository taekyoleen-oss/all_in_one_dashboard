package com.tkleen.schedule.notes

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
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.sync.AgendaSyncWorker
import com.tkleen.schedule.widget.NotesWidget
import com.tkleen.schedule.widget.itemColorRow
import kotlinx.coroutines.runBlocking

/**
 * 소제목 내용 화면 — 위젯의 제목을 누르면(수정) 또는 ＋(새 소제목)가 연다.
 *
 *  요구의 핵심이 여기다: 위젯에는 **소제목만** 늘어놓고, 누르면 이 화면에서 내용을
 *  본다. 편집·삭제도 같은 화면에서 한다(보기 전용 화면을 따로 두면 고치려고 한 번
 *  더 들어가야 한다).
 *
 *  ⚠ 이미지·표가 있는 소제목(rich)은 **본문을 읽기 전용**으로 연다. 폰은 평문만
 *    다루므로 저장하면 이미지·표가 복구 불가능하게 사라진다(서버도 409로 막는다).
 *    제목 수정과 삭제는 그대로 된다.
 *  ⚠ 삭제는 2단계 확인 — 홈 화면에서 잘못 누르기 쉬운 자리라 한 번 더 묻는다.
 *  ⚠ 액션바는 숨긴다 — targetSdk 36 edge-to-edge에서 제목 바가 입력 위로 겹친다.
 */
class NoteEditActivity : Activity() {

    private var confirmingDelete = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        val noteId = intent?.getStringExtra("noteId")
        val sectionId = intent?.getStringExtra("sectionId")
        val isEdit = noteId != null && sectionId != null
        val rich = intent?.getBooleanExtra("rich", false) == true
        val noteTitle = intent?.getStringExtra("noteTitle").orEmpty()

        val pad = (16 * resources.displayMetrics.density).toInt()
        val heading = TextView(this).apply {
            text = if (!isEdit) "새 소제목" else "소제목"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        // 어느 노트에 속한 소제목인지 — 노트가 여러 개일 때 헷갈리지 않게.
        val noteLine = TextView(this).apply {
            text = if (noteTitle.isNotEmpty()) "노트: $noteTitle" else "노트"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        }

        val titleInput = EditText(this).apply {
            hint = "소제목"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTypeface(typeface, Typeface.BOLD)
            inputType = InputType.TYPE_CLASS_TEXT
            setText(intent?.getStringExtra("title")?.takeIf { it != "제목 없음" } ?: "")
        }
        val bodyInput = EditText(this).apply {
            hint = "내용"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            gravity = Gravity.TOP or Gravity.START
            setHorizontallyScrolling(false)
            isVerticalScrollBarEnabled = true
            setText(intent?.getStringExtra("body") ?: "")
            if (rich) {
                // 읽기는 되고 고치지는 못하게(커서·키보드 비활성).
                isFocusable = false
                isFocusableInTouchMode = false
                isCursorVisible = false
                setTextIsSelectable(true)
            }
        }
        val richNotice = TextView(this).apply {
            text = "이미지·표가 있는 소제목입니다 — 내용은 웹에서 수정해 주세요(여기서 저장하면 사라집니다). 소제목 이름 변경과 삭제는 됩니다."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(0xFFB45309.toInt())
        }

        val status = TextView(this).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        val saveBtn = Button(this).apply { text = "저장" }
        val cancelBtn = Button(this).apply { text = "취소" }
        cancelBtn.setOnClickListener { finish() }
        val deleteBtn = Button(this).apply {
            text = "이 소제목 삭제"
            setTextColor(0xFFDC2626.toInt())
        }

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
                    // rich면 본문은 보내지 않는다 — 제목만 고친다(서버도 409로 막는다).
                    isEdit -> WidgetApi.updateNoteSection(
                        token, noteId!!, sectionId!!, title, if (rich) null else body,
                    )
                    else -> WidgetApi.addNoteSection(token, title, body)
                }
                runOnUiThread {
                    when (result) {
                        is WidgetApi.MutResult.Ok -> {
                            if (isEdit) applyOptimisticEdit(noteId!!, sectionId!!, title, body, rich)
                            // 새 소제목은 서버가 만든 섹션 id가 필요하므로 재조회한다.
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

        deleteBtn.setOnClickListener {
            // 2단계 확인 — 첫 탭은 묻기만 하고, 두 번째 탭에서 실제로 지운다.
            if (!confirmingDelete) {
                confirmingDelete = true
                deleteBtn.text = "정말 삭제할까요? (다시 누르면 삭제)"
                status.text = "취소하려면 '취소'를 누르세요."
                return@setOnClickListener
            }
            deleteBtn.isEnabled = false
            status.text = "삭제 중…"
            Thread {
                val token = WidgetStore.loadToken(this)
                val ok = token != null &&
                    WidgetApi.deleteNoteSection(token, noteId!!, sectionId!!)
                runOnUiThread {
                    if (ok) {
                        WidgetStore.mutateNotes(this) { list ->
                            list.filterNot { it.noteId == noteId && it.sectionId == sectionId }
                        }
                        runBlocking { NotesWidget.refresh(applicationContext) }
                        Toast.makeText(this, "삭제되었습니다", Toast.LENGTH_SHORT).show()
                        finish()
                    } else {
                        deleteBtn.isEnabled = true
                        confirmingDelete = false
                        deleteBtn.text = "이 소제목 삭제"
                        status.text = "삭제에 실패했습니다. 네트워크를 확인해 주세요."
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
                if (isEdit) {
                    addView(space(pad / 4))
                    addView(noteLine)
                }
                addView(space(pad))
                addView(titleInput, wide())
                if (rich) {
                    addView(space(pad / 2))
                    addView(richNotice, wide())
                }
                addView(space(pad / 2))
                // 본문은 남는 세로 공간을 전부 쓴다(weight 1) — 긴 내용도 한눈에.
                addView(
                    bodyInput,
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f),
                )
                if (isEdit) {
                    // 이 소제목의 글자색(요구) — 폰 위젯 표시용, 고르는 즉시 반영된다.
                    addView(space(pad / 2))
                    addView(
                        itemColorRow(this@NoteEditActivity, "notes", "$noteId:$sectionId"),
                        wide(),
                    )
                }
                addView(space(pad / 2))
                addView(
                    LinearLayout(this@NoteEditActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        addView(saveBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        addView(cancelBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    },
                    wide(),
                )
                if (isEdit) {
                    addView(space(pad / 4))
                    addView(deleteBtn, wide())
                }
                addView(space(pad / 2))
                addView(status)
            },
        )
        // 새 소제목은 제목부터, 기존 것은 읽으러 온 것이므로 키보드를 띄우지 않는다.
        if (!isEdit) titleInput.requestFocus()
    }

    /** 수정 결과를 캐시에 즉시 반영 — 위젯 목록의 제목이 바로 바뀐다. */
    private fun applyOptimisticEdit(
        noteId: String,
        sectionId: String,
        title: String,
        body: String,
        rich: Boolean,
    ) {
        WidgetStore.mutateNotes(this) { list ->
            list.map {
                if (it.noteId == noteId && it.sectionId == sectionId) {
                    it.copy(
                        title = title.ifEmpty { firstLine(if (rich) it.body else body) },
                        // rich면 본문을 보내지 않았으므로 캐시도 그대로 둔다.
                        body = if (rich) it.body else body,
                    )
                } else {
                    it
                }
            }
        }
        // finish() 직전이라 launch는 취소될 수 있다 — 갱신을 끝내고 넘어간다.
        runBlocking { NotesWidget.refresh(applicationContext) }
    }

    /** 제목이 빈 소제목의 목록 표시 — 서버(widgetNote.ts)와 같은 규칙. */
    private fun firstLine(text: String): String {
        val line = text.lineSequence().firstOrNull { it.isNotBlank() }?.trim() ?: ""
        return when {
            line.isEmpty() -> "제목 없음"
            line.length > 40 -> line.take(40) + "…"
            else -> line
        }
    }

    private fun wide() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
