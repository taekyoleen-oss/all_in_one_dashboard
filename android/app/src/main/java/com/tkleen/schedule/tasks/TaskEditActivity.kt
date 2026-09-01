package com.tkleen.schedule.tasks

import android.app.Activity
import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.sync.AgendaSyncWorker
import com.tkleen.schedule.widget.TasksWidget
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/**
 * 작업 추가/수정 화면 — 위젯 ＋(추가) 또는 행 탭(수정, extras로 진입)이 연다.
 *
 *  - 제목 + 일자(DatePickerDialog, 선택·지우기) + [수정 모드] 진행/완료 라디오.
 *  - 겹침 수정(요구): targetSdk 36 edge-to-edge에서 액션바 제목("작업 추가")이
 *    입력 위로 겹쳐 보이던 문제 → 액션바 숨김 + fitsSystemWindows로 시스템 바
 *    인셋 회피(제목은 레이아웃 안에서만 그린다).
 *  - 수정 저장은 낙관 캐시 반영 후 API 호출(완료 전환은 진행 필터에서 즉시
 *    빠진다 — 요구, v14에서 유예 제거). 추가는 저장 후 즉시 동기화.
 */
class TaskEditActivity : Activity() {

    private var dueOn: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide() // 겹침의 원인이던 상단 제목 바 제거(제목은 레이아웃이 그림)

        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }

        val editId = intent?.getStringExtra("taskId")
        val isEdit = editId != null
        dueOn = intent?.getStringExtra("taskDue")

        val pad = (16 * resources.displayMetrics.density).toInt()
        val title = TextView(this).apply {
            text = if (isEdit) "작업 수정" else "작업 추가"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
        }
        val input = EditText(this).apply {
            hint = "할 작업 입력"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setText(intent?.getStringExtra("taskTitle") ?: "")
        }
        val dateBtn = Button(this).apply { text = dateButtonLabel() }
        val dateClear = Button(this).apply { text = "일자 지우기" }
        dateBtn.setOnClickListener {
            val base = try {
                LocalDate.parse((dueOn ?: "").take(10))
            } catch (e: Exception) {
                LocalDate.now(ZoneId.of("Asia/Seoul"))
            }
            DatePickerDialog(
                this,
                { _, y, m, d -> // month는 0-base
                    dueOn = "%04d-%02d-%02d".format(y, m + 1, d)
                    dateBtn.text = dateButtonLabel()
                },
                base.year, base.monthValue - 1, base.dayOfMonth,
            ).show()
        }
        dateClear.setOnClickListener {
            dueOn = null
            dateBtn.text = dateButtonLabel()
        }

        // 진행/완료 — 수정 모드에서만(추가는 항상 '진행'으로 시작).
        val donePending = RadioButton(this).apply { text = "진행"; id = 1 }
        val doneDone = RadioButton(this).apply { text = "완료"; id = 2 }
        val statusGroup = RadioGroup(this).apply {
            orientation = RadioGroup.HORIZONTAL
            addView(donePending)
            addView(doneDone)
            check(if (intent?.getBooleanExtra("taskDone", false) == true) 2 else 1)
        }

        val status = TextView(this).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f) }
        val saveBtn = Button(this).apply { text = "저장" }
        val cancelBtn = Button(this).apply { text = "취소" }
        cancelBtn.setOnClickListener { finish() } // 저장하지 않고 닫기
        val deleteBtn = Button(this).apply {
            text = "이 작업 삭제"
            setTextColor(0xFFDC2626.toInt())
        }
        deleteBtn.setOnClickListener {
            deleteBtn.isEnabled = false
            status.text = "삭제 중…"
            Thread {
                val token = WidgetStore.loadToken(this)
                val ok = token != null && WidgetApi.deleteTask(token, editId!!)
                runOnUiThread {
                    if (ok) {
                        WidgetStore.mutateTasks(this) { list -> list.filterNot { it.id == editId } }
                        WidgetStore.clearDeleteMark(this, editId!!)
                        runBlocking { TasksWidget().updateAll(applicationContext) }
                        Toast.makeText(this, "삭제되었습니다", Toast.LENGTH_SHORT).show()
                        finish()
                    } else {
                        deleteBtn.isEnabled = true
                        status.text = "삭제에 실패했습니다. 네트워크를 확인해 주세요."
                    }
                }
            }.start()
        }

        saveBtn.setOnClickListener {
            val text = input.text.toString().trim()
            if (text.isEmpty()) {
                status.text = "내용을 입력해 주세요."
                return@setOnClickListener
            }
            saveBtn.isEnabled = false
            status.text = "저장 중…"
            val markDone = statusGroup.checkedRadioButtonId == 2
            val due = dueOn
            Thread {
                val token = WidgetStore.loadToken(this)
                val result = when {
                    token == null -> WidgetApi.MutResult.Fail("연결이 해제되었습니다. 위젯에서 다시 연결하세요.")
                    !isEdit -> WidgetApi.addTask(token, text, due)
                    else -> {
                        val fields = JSONObject().put("title", text).put("done", markDone)
                        fields.put("dueOn", due ?: JSONObject.NULL)
                        WidgetApi.updateTask(token, editId!!, fields)
                    }
                }
                runOnUiThread {
                    when (result) {
                        is WidgetApi.MutResult.Ok -> {
                            if (isEdit) applyOptimisticEdit(editId!!, text, markDone, due)
                            else AgendaSyncWorker.syncNow(this) // 서버가 준 id 포함 재조회
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

        val dateRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(dateBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2f))
            addView(dateClear, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                fitsSystemWindows = true // edge-to-edge에서 상태바와 겹치지 않게
                setPadding(pad, pad, pad, pad)
                addView(title)
                addView(space(pad))
                addView(input, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(space(pad / 2))
                addView(dateRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                if (isEdit) {
                    addView(space(pad / 2))
                    addView(statusGroup)
                }
                addView(space(pad / 2))
                // 저장 | 취소 나란히(요구), 삭제는 아래(수정 모드만).
                addView(
                    LinearLayout(this@TaskEditActivity).apply {
                        orientation = LinearLayout.HORIZONTAL
                        addView(saveBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                        addView(cancelBtn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT),
                )
                if (isEdit) {
                    addView(space(pad / 4))
                    addView(deleteBtn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                }
                addView(space(pad / 2))
                addView(status)
            },
        )
        input.requestFocus()
    }

    /** 수정 결과를 캐시에 즉시 반영 — 완료 전환은 진행 필터에서 즉시 빠진다. */
    private fun applyOptimisticEdit(id: String, title: String, done: Boolean, due: String?) {
        WidgetStore.mutateTasks(this) { list ->
            list.map { if (it.id == id) it.copy(title = title, done = done, dueOn = due) else it }
        }
        WidgetStore.clearDeleteMark(this, id) // 편집해서 저장 = 유지 의사 — 삭제 예정 해제
        // finish() 직전이라 launch는 취소될 수 있다 — 갱신을 끝내고 넘어간다.
        runBlocking { TasksWidget().updateAll(applicationContext) }
    }

    private fun dateButtonLabel(): String = dueOn?.let { "일자: $it" } ?: "일자 선택 (선택)"

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}
