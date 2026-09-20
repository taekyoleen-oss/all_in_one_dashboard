package com.tkleen.schedule.data.model

import org.json.JSONArray
import org.json.JSONObject

/**
 * GET /api/widget/notes 응답 items 1행 — WidgetNoteItem과 1:1.
 *
 * 한 줄 = 웹 '노트' 위젯 안의 **소제목 섹션 하나**다. 그래서 노트 위젯 id와 섹션
 * id 둘이 있어야 한 건을 가리킬 수 있다(수정·삭제 경로가 둘을 그대로 쓴다).
 *
 * rich=true면 이미지·표가 있어 평문으로 되돌릴 수 없는 섹션이다 — 본문 수정은
 * 서버가 거부하므로 화면에서도 읽기 전용으로 둔다.
 */
data class NoteItem(
    val noteId: String,
    val sectionId: String,
    val title: String,
    val body: String,
    val rich: Boolean,
    val noteTitle: String,
) {
    /** 목록 항목 식별자(LazyColumn itemId·낙관적 갱신 대조용). */
    val key: String get() = "$noteId:$sectionId"

    companion object {
        fun listFromJson(itemsJson: String): List<NoteItem> {
            val arr = JSONArray(itemsJson)
            val out = ArrayList<NoteItem>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val noteId = o.optString("noteId", "")
                val sectionId = o.optString("sectionId", "")
                if (noteId.isEmpty() || sectionId.isEmpty()) continue
                out.add(
                    NoteItem(
                        noteId = noteId,
                        sectionId = sectionId,
                        // 서버가 늘 채워 주지만(빈 제목은 본문 첫 줄·'제목 없음'),
                        // 방어적으로 한 번 더 — 목록에 빈 줄이 생기면 누를 수가 없다.
                        title = o.optString("title", "").ifEmpty { "제목 없음" },
                        body = o.optString("body", ""),
                        rich = o.optBoolean("rich", false),
                        noteTitle = o.optString("noteTitle", ""),
                    ),
                )
            }
            return out
        }

        /** 낙관적 캐시 갱신용 직렬화 — listFromJson과 왕복 가능. */
        fun listToJson(items: List<NoteItem>): String {
            val arr = JSONArray()
            for (n in items) {
                arr.put(
                    JSONObject()
                        .put("noteId", n.noteId)
                        .put("sectionId", n.sectionId)
                        .put("title", n.title)
                        .put("body", n.body)
                        .put("rich", n.rich)
                        .put("noteTitle", n.noteTitle),
                )
            }
            return arr.toString()
        }
    }
}
