package com.tkleen.schedule.data.model

import org.json.JSONArray
import org.json.JSONObject

/** GET /api/widget/tasks 응답 items 1행 — WidgetTask와 1:1(표시에 필요한 필드만). */
data class TaskItem(
    val id: String,
    val title: String,
    val done: Boolean,
    val dueOn: String?, // "YYYY-MM-DD" 또는 null
) {
    companion object {
        fun listFromJson(itemsJson: String): List<TaskItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<TaskItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id", "")
                val title = o.optString("title", "")
                if (id.isEmpty() || title.isEmpty()) continue
                out.add(
                    TaskItem(
                        id = id,
                        title = title,
                        done = o.optBoolean("done", false),
                        dueOn = o.optString("dueOn").takeIf { it.isNotEmpty() && !o.isNull("dueOn") },
                    ),
                )
            }
            return out
        }

        /** 낙관적 캐시 갱신용 직렬화 — listFromJson과 왕복 가능. */
        fun listToJson(items: List<TaskItem>): String {
            val arr = JSONArray()
            for (t in items) {
                val o = JSONObject().put("id", t.id).put("title", t.title).put("done", t.done)
                if (t.dueOn != null) o.put("dueOn", t.dueOn)
                arr.put(o)
            }
            return arr.toString()
        }
    }
}
