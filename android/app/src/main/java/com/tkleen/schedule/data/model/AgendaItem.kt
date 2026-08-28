package com.tkleen.schedule.data.model

import org.json.JSONArray

/** GET /api/widget/agenda 응답 1행 — output/api-shapes.ts의 WidgetAgendaItem과 1:1. */
data class AgendaItem(
    val id: String,
    val title: String,
    val targetName: String?,
    val startAt: String,
    val status: String, // pending | done | snoozed
    val snoozeUntil: String?,
    val colorToken: String?,
) {
    /** 아젠다에서의 실제 등장 시점 — 연기된 항목은 연기 시각 자리로(서버 정렬과 동일 규칙). */
    val effectiveAt: String
        get() = if (status == "snoozed" && snoozeUntil != null) snoozeUntil else startAt

    companion object {
        /** items 배열 JSON → 리스트. 필수 필드가 깨진 행은 버린다(위젯은 표시가 우선). */
        fun listFromJson(itemsJson: String): List<AgendaItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<AgendaItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id", "")
                val title = o.optString("title", "")
                val startAt = o.optString("startAt", "")
                if (id.isEmpty() || title.isEmpty() || startAt.isEmpty()) continue
                out.add(
                    AgendaItem(
                        id = id,
                        title = title,
                        targetName = o.optString("targetName").takeIf { it.isNotEmpty() && !o.isNull("targetName") },
                        startAt = startAt,
                        status = o.optString("status", "pending"),
                        snoozeUntil = o.optString("snoozeUntil").takeIf { it.isNotEmpty() && !o.isNull("snoozeUntil") },
                        colorToken = o.optString("colorToken").takeIf { it.isNotEmpty() && !o.isNull("colorToken") },
                    ),
                )
            }
            return out
        }
    }
}
