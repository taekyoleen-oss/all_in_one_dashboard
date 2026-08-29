package com.tkleen.schedule.tasks

import android.app.Activity
import android.content.Intent
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.glance.appwidget.updateAll
import com.tkleen.schedule.data.WidgetApi
import com.tkleen.schedule.data.WidgetStore
import com.tkleen.schedule.data.model.TaskItem
import com.tkleen.schedule.pairing.PairingActivity
import com.tkleen.schedule.widget.TasksWidget
import com.tkleen.schedule.widget.taskDateLabel
import kotlinx.coroutines.runBlocking
import org.json.JSONObject

/**
 * 작업 관리 화면 — 위젯을 탭하면 열리는 **전체 조작 화면**.
 *
 *  왜 화면인가: 이 기기에서는 위젯 안의 인플레이스 버튼(Glance 콜백·트램펄린 모두)이
 *  동작하지 않았고, **화면을 여는 탭만** 확실히 동작했다(＋·행 탭). 그래서 필터·완료
 *  토글·삭제·추가·수정을 전부 이 화면으로 옮겨 조작 경로를 하나로 통일한다.
 *  위젯은 '보기 + 탭하면 열기'만 담당한다(MS To Do 등과 같은 구성).
 *
 *  화면을 나갈 때 위젯을 다시 그려 변경이 홈 화면에도 반영된다.
 */
class TasksListActivity : Activity() {

    private var filter: String = "pending"
    private lateinit var listBox: LinearLayout
    private lateinit var filterRow: LinearLayout
    private var items: List<TaskItem> = emptyList()
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide()
        if (!WidgetStore.isPaired(this)) {
            startActivity(Intent(this, PairingActivity::class.java))
            finish()
            return
        }
        // 위젯의 필터 버튼으로 들어오면 그 필터로 시작(그리고 저장 → 위젯 표시도 따라감).
        filter = intent?.getStringExtra("filter")?.takeIf { it in setOf("pending", "done", "all") }
            ?.also { WidgetStore.setTasksFilter(this, it) }
            ?: WidgetStore.tasksFilter(this)
        buildUi()
        render()
        refreshFromServer()
    }

    override fun onResume() {
        super.onResume()
        // 수정/추가 화면에서 돌아오면 캐시가 바뀌어 있다.
        items = WidgetStore.taskItems(this)
        render()
    }

    override fun onPause() {
        super.onPause()
        runBlocking { TasksWidget().updateAll(applicationContext) }
    }

    /* ── UI 골격 ─────────────────────────────────────────────────────── */

    private val pad: Int by lazy { (16 * resources.displayMetrics.density).toInt() }

    private fun buildUi() {
        val title = TextView(this).apply {
            text = "작업"
            setTypeface(typeface, Typeface.BOLD)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        }
        val addBtn = Button(this).apply {
            text = "＋ 추가"
            setOnClickListener {
                startActivity(Intent(this@TasksListActivity, TaskEditActivity::class.java))
            }
        }
        val syncBtn = Button(this).apply {
            text = "새로고침"
            setOnClickListener { refreshFromServer() }
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(addBtn)
            addView(syncBtn)
        }

        filterRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        listBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        setContentView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                fitsSystemWindows = true
                setPadding(pad, pad, pad, pad)
                addView(header, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(filterRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
                addView(
                    ScrollView(this@TasksListActivity).apply { addView(listBox) },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f),
                )
            },
        )
        items = WidgetStore.taskItems(this)
    }

    /** 필터 3버튼 + 목록을 현재 상태로 다시 그린다. */
    private fun render() {
        filterRow.removeAllViews()
        for ((value, label) in listOf("pending" to "진행", "done" to "완료", "all" to "전체")) {
            filterRow.addView(
                Button(this).apply {
                    text = label
                    isAllCaps = false
                    if (filter == value) {
                        setTypeface(typeface, Typeface.BOLD)
                        setTextColor(0xFF4A90C2.toInt())
                    }
                    setOnClickListener {
                        filter = value
                        WidgetStore.setTasksFilter(this@TasksListActivity, value)
                        render()
                    }
                },
                LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f),
            )
        }

        listBox.removeAllViews()
        val visible = when (filter) {
            "done" -> items.filter { it.done }
            "all" -> items
            else -> items.filter { !it.done }
        }
        if (visible.isEmpty()) {
            listBox.addView(
                TextView(this).apply {
                    text = if (filter == "done") "완료한 작업이 없습니다" else "작업이 없습니다 — ＋ 추가"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setPadding(0, pad, 0, 0)
                },
            )
            return
        }
        for (t in visible) listBox.addView(rowView(t))
    }

    /** 한 행: [진행/완료 토글] 제목·일자(탭=수정) [삭제] */
    private fun rowView(t: TaskItem): View {
        val state = Button(this).apply {
            text = if (t.done) "완료" else "진행"
            isAllCaps = false
            setTextColor(if (t.done) 0xFF9AA5B1.toInt() else 0xFF4A90C2.toInt())
            setOnClickListener { setDone(t, !t.done) }
        }
        val label = TextView(this).apply {
            text = buildString {
                append(t.title)
                if (t.dueOn != null) append("   ").append(taskDateLabel(t.dueOn))
            }
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            if (t.done) {
                paintFlags = paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                setTextColor(0xFF9AA5B1.toInt())
            }
            setPadding(pad / 2, pad / 2, pad / 2, pad / 2)
            setOnClickListener {
                startActivity(
                    Intent(this@TasksListActivity, TaskEditActivity::class.java).apply {
                        putExtra("taskId", t.id)
                        putExtra("taskTitle", t.title)
                        putExtra("taskDone", t.done)
                        if (t.dueOn != null) putExtra("taskDue", t.dueOn)
                    },
                )
            }
        }
        val del = Button(this).apply {
            text = "삭제"
            isAllCaps = false
            setTextColor(0xFFDC2626.toInt())
            setOnClickListener { confirmDelete(t) }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(state)
            addView(label, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            addView(del)
        }
    }

    /* ── 서버 조작 ───────────────────────────────────────────────────── */

    private fun setDone(t: TaskItem, done: Boolean) {
        if (busy) return
        busy = true
        // 낙관 반영 후 API — 실패 시 새로고침이 서버 진실로 되돌린다.
        WidgetStore.mutateTasks(this) { list ->
            list.map { if (it.id == t.id) it.copy(done = done) else it }
        }
        items = WidgetStore.taskItems(this)
        render()
        Thread {
            val token = WidgetStore.loadToken(this)
            val ok = token != null &&
                WidgetApi.updateTask(token, t.id, JSONObject().put("done", done)) is WidgetApi.MutResult.Ok
            runOnUiThread {
                busy = false
                if (!ok) Toast.makeText(this, "변경을 서버에 저장하지 못했습니다", Toast.LENGTH_SHORT).show()
            }
        }.start()
    }

    /** 삭제는 되돌릴 수 없으므로 같은 버튼을 두 번 누르는 확인을 거친다. */
    private fun confirmDelete(t: TaskItem) {
        val confirm = Toast.makeText(this, "'${t.title}' 삭제하려면 한 번 더 누르세요", Toast.LENGTH_SHORT)
        if (pendingDeleteId != t.id) {
            pendingDeleteId = t.id
            confirm.show()
            return
        }
        pendingDeleteId = null
        WidgetStore.mutateTasks(this) { list -> list.filterNot { it.id == t.id } }
        items = WidgetStore.taskItems(this)
        render()
        Thread {
            val token = WidgetStore.loadToken(this)
            val ok = token != null && WidgetApi.deleteTask(token, t.id)
            runOnUiThread {
                Toast.makeText(this, if (ok) "삭제되었습니다" else "삭제를 서버에 저장하지 못했습니다", Toast.LENGTH_SHORT).show()
            }
        }.start()
    }

    private var pendingDeleteId: String? = null

    /** 서버에서 최신 목록을 받아 캐시·화면을 갱신(삭제 예정 마크 실행 포함). */
    private fun refreshFromServer() {
        Thread {
            val token = WidgetStore.loadToken(this) ?: return@Thread
            for (id in WidgetStore.pendingDeleteIds(this)) {
                if (WidgetApi.deleteTask(token, id)) WidgetStore.clearDeleteMark(this, id)
            }
            when (val r = WidgetApi.fetchTasks(token, null)) {
                is WidgetApi.TasksResult.Ok -> {
                    WidgetStore.putTasks(this, r.itemsJson, r.etag, r.linked, System.currentTimeMillis())
                    runOnUiThread {
                        items = WidgetStore.taskItems(this)
                        render()
                    }
                }
                WidgetApi.TasksResult.Unauthorized ->
                    runOnUiThread { Toast.makeText(this, "연결이 해제되었습니다", Toast.LENGTH_SHORT).show() }
                else -> Unit
            }
        }.start()
    }
}
