package com.tkleen.schedule.data.model

import org.json.JSONArray
import org.json.JSONObject

/**
 * GET /api/widget/memos 응답 items 1행 — WidgetMemo와 1:1(표시에 필요한 필드만).
 *
 * 메모 한 건 = 웹 '메모' 위젯 인스턴스 하나라 id는 위젯 인스턴스 id다.
 * locked=true면 서버가 본문을 보내지 않는다(웹의 화면 잠금을 폰이 우회하지 못하게).
 */
data class MemoItem(
    val id: String,
    val title: String,
    val body: String,
    val locked: Boolean,
) {
    companion object {
        fun listFromJson(itemsJson: String): List<MemoItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<MemoItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val id = o.optString("id", "")
                if (id.isEmpty()) continue
                out.add(
                    MemoItem(
                        id = id,
                        // 서버가 제목을 늘 채워 주지만(빈 제목은 본문 첫 줄·'제목 없음'),
                        // 방어적으로 한 번 더 — 목록에 빈 줄이 생기면 누를 수가 없다.
                        title = o.optString("title", "").ifEmpty { "제목 없음" },
                        body = o.optString("body", ""),
                        locked = o.optBoolean("locked", false),
                    ),
                )
            }
            return out
        }

        /** 낙관적 캐시 갱신용 직렬화 — listFromJson과 왕복 가능. */
        fun listToJson(items: List<MemoItem>): String {
            val arr = JSONArray()
            for (m in items) {
                arr.put(
                    JSONObject()
                        .put("id", m.id)
                        .put("title", m.title)
                        .put("body", m.body)
                        .put("locked", m.locked),
                )
            }
            return arr.toString()
        }
    }
}
