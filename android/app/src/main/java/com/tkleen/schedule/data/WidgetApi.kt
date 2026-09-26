package com.tkleen.schedule.data

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * /api/widget 하위 HTTP 클라이언트 — 플랫폼 내장(HttpURLConnection·org.json)만 사용.
 * (주의: Kotlin 블록 주석은 중첩된다 — 주석 안에 슬래시+별표 문자열 금지)
 * 계획서의 OkHttp/kotlinx-serialization은 이 호출 2개 규모에선 과해서 미도입.
 * 모든 함수는 블로킹 — 반드시 워커/IO 디스패처에서 부른다.
 */
object WidgetApi {
    /** 웹앱 도메인 — twa-manifest.json의 host와 동일하게 유지한다. */
    const val BASE = "https://all-in-one-dashboard-eight.vercel.app"

    private const val TIMEOUT_MS = 10_000

    sealed class AgendaResult {
        data class Ok(val itemsJson: String, val etag: String?) : AgendaResult()
        object NotModified : AgendaResult()
        object Unauthorized : AgendaResult()
        data class Error(val message: String) : AgendaResult()
    }

    /** 오늘·내일 아젠다. ETag가 일치하면 서버가 304로 본문을 아낀다. */
    fun fetchAgenda(token: String, etag: String?): AgendaResult {
        return try {
            val conn = open("$BASE/api/widget/agenda?days=2", "GET")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (etag != null) conn.setRequestProperty("If-None-Match", etag)
            when (conn.responseCode) {
                200 -> {
                    val body = conn.inputStream.bufferedReader().readText()
                    AgendaResult.Ok(
                        itemsJson = JSONObject(body).getJSONArray("items").toString(),
                        etag = conn.getHeaderField("ETag"),
                    )
                }
                304 -> AgendaResult.NotModified
                401 -> AgendaResult.Unauthorized
                else -> AgendaResult.Error("HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            AgendaResult.Error(e.message ?: e.javaClass.simpleName)
        }
    }

    sealed class PairResult {
        data class Ok(val token: String) : PairResult()
        data class Fail(val message: String) : PairResult()
    }

    /** 6자리 페어링 코드 → 디바이스 토큰 교환. */
    fun pair(code: String, label: String): PairResult {
        return try {
            val conn = open("$BASE/api/widget/pair", "POST")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("code", code).put("label", label).toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode == 200) {
                val res = JSONObject(conn.inputStream.bufferedReader().readText())
                PairResult.Ok(res.getString("token"))
            } else {
                val msg = try {
                    JSONObject(conn.errorStream?.bufferedReader()?.readText() ?: "")
                        .optString("message", "")
                } catch (e: Exception) {
                    ""
                }
                PairResult.Fail(msg.ifEmpty { "연결에 실패했습니다 (HTTP ${conn.responseCode})" })
            }
        } catch (e: Exception) {
            PairResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /* ── 작업(tasks) ───────────────────────────────────────────────────── */

    sealed class TasksResult {
        data class Ok(val itemsJson: String, val etag: String?, val linked: Boolean) : TasksResult()
        object NotModified : TasksResult()
        object Unauthorized : TasksResult()
        data class Error(val message: String) : TasksResult()
    }

    /** 지정된 웹 '작업' 위젯의 목록. linked=false면 웹에서 아직 지정 안 됨. */
    fun fetchTasks(token: String, etag: String?): TasksResult {
        return try {
            val conn = open("$BASE/api/widget/tasks", "GET")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (etag != null) conn.setRequestProperty("If-None-Match", etag)
            when (conn.responseCode) {
                200 -> {
                    val body = JSONObject(conn.inputStream.bufferedReader().readText())
                    TasksResult.Ok(
                        itemsJson = body.getJSONArray("items").toString(),
                        etag = conn.getHeaderField("ETag"),
                        linked = !body.isNull("instanceId"),
                    )
                }
                304 -> TasksResult.NotModified
                401 -> TasksResult.Unauthorized
                else -> TasksResult.Error("HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            TasksResult.Error(e.message ?: e.javaClass.simpleName)
        }
    }

    sealed class MutResult {
        object Ok : MutResult()
        data class Fail(val message: String) : MutResult()
    }

    /** 작업 추가(일자 선택) — 409(no_target)면 서버 안내 문구를 그대로 보여준다. */
    fun addTask(token: String, title: String, dueOn: String?): MutResult {
        return try {
            val conn = open("$BASE/api/widget/tasks", "POST")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("title", title)
            if (dueOn != null) body.put("dueOn", dueOn)
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) {
                MutResult.Ok
            } else {
                MutResult.Fail(errorMessage(conn, "추가에 실패했습니다"))
            }
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /**
     * 작업 수정(제목·완료·일자 중 있는 필드만) — 모바일 수정 화면.
     * HttpURLConnection은 PATCH를 못 보내므로(자바 한계) 서버의 POST 별칭을 쓴다.
     * dueOn: JSONObject.NULL을 넘기면 일자 제거.
     */
    fun updateTask(token: String, id: String, fields: JSONObject): MutResult {
        return try {
            val conn = open("$BASE/api/widget/tasks/$id", "POST")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(fields.toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) {
                MutResult.Ok
            } else {
                MutResult.Fail(errorMessage(conn, "변경에 실패했습니다"))
            }
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /** 삭제 — 404(이미 없음)도 성공으로 취급(멱등). */
    fun deleteTask(token: String, id: String): Boolean {
        return try {
            val conn = open("$BASE/api/widget/tasks/$id", "DELETE")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.responseCode in 200..299 || conn.responseCode == 404
        } catch (e: Exception) {
            false
        }
    }

    /* ── 노트(notes) ───────────────────────────────────────────────────── */

    sealed class NotesResult {
        data class Ok(val itemsJson: String, val etag: String?, val linked: Boolean) : NotesResult()
        object NotModified : NotesResult()
        object Unauthorized : NotesResult()
        data class Error(val message: String) : NotesResult()
    }

    /**
     * **지정된 노트 위젯 하나**의 소제목 전부(표시 순서대로). 한 줄 = 소제목 하나다.
     * linked=false면 웹에서 아직 '모바일 홈 화면에 표시'를 켜지 않은 상태 —
     * 위젯이 안내를 띄운다(작업 위젯과 같은 계약).
     */
    fun fetchNotes(token: String, etag: String?): NotesResult {
        return try {
            val conn = open("$BASE/api/widget/notes", "GET")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (etag != null) conn.setRequestProperty("If-None-Match", etag)
            when (conn.responseCode) {
                200 -> {
                    val body = JSONObject(conn.inputStream.bufferedReader().readText())
                    NotesResult.Ok(
                        itemsJson = body.getJSONArray("items").toString(),
                        etag = conn.getHeaderField("ETag"),
                        linked = !body.isNull("instanceId"),
                    )
                }
                304 -> NotesResult.NotModified
                401 -> NotesResult.Unauthorized
                else -> NotesResult.Error("HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            NotesResult.Error(e.message ?: e.javaClass.simpleName)
        }
    }

    /**
     * 새 소제목 추가 — 서버가 **지정된 노트의 맨 위에** 붙인다(새로 쓴 것이 위로).
     * 폰에는 노트를 고르는 화면이 없으므로 대상 규칙은 서버에 둔다.
     */
    fun addNoteSection(token: String, title: String, text: String): MutResult {
        return try {
            val conn = open("$BASE/api/widget/notes", "POST")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("title", title).put("text", text)
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) {
                MutResult.Ok
            } else {
                MutResult.Fail(errorMessage(conn, "추가에 실패했습니다"))
            }
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /**
     * 소제목 수정 — HttpURLConnection이 PATCH를 못 보내므로 서버의 POST 별칭을 쓴다.
     * `text`가 null이면 **본문은 보내지 않는다**(이미지·표가 있는 소제목: 평문으로
     * 덮어쓰면 사라지므로 제목만 고친다. 서버도 같은 경우를 409로 막는다).
     * 머리말·첨부 같은 노트의 다른 값은 서버가 병합으로 보존한다.
     */
    fun updateNoteSection(
        token: String,
        noteId: String,
        sectionId: String,
        title: String,
        text: String?,
    ): MutResult {
        return try {
            val conn = open("$BASE/api/widget/notes/$noteId/$sectionId", "POST")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("title", title)
            if (text != null) body.put("text", text)
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) {
                MutResult.Ok
            } else {
                MutResult.Fail(errorMessage(conn, "저장에 실패했습니다"))
            }
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /** 소제목 삭제(노트 위젯 자체는 남는다). 404(이미 없음)도 성공으로 본다. */
    fun deleteNoteSection(token: String, noteId: String, sectionId: String): Boolean {
        return try {
            val conn = open("$BASE/api/widget/notes/$noteId/$sectionId", "DELETE")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.responseCode in 200..299 || conn.responseCode == 404
        } catch (e: Exception) {
            false
        }
    }

    /* ── 주식·환율 (읽기 전용) ─────────────────────────────────────────── */

    /**
     * 목록만 받는 읽기 전용 위젯 두 종의 공통 결과. linked=false면 웹에서 대상
     * 위젯을 아직 고르지 않은 상태(그 종류 위젯이 하나뿐이면 서버가 자동으로 고른다).
     */
    sealed class ListResult {
        data class Ok(
            val itemsJson: String,
            val etag: String?,
            val linked: Boolean,
            /** 환율 전용 — 조회 자체가 실패(빈 목록을 '통화 없음'으로 오해하지 않게). */
            val unavailable: Boolean = false,
            /** 환율 전용 — 시장지표 배열(요구). 없으면 null(주식 응답엔 아예 없다). */
            val indicatorsJson: String? = null,
        ) : ListResult()
        object NotModified : ListResult()
        object Unauthorized : ListResult()
        data class Error(val message: String) : ListResult()
    }

    /** 지정된 '주식' 위젯의 종목 시세(웹에 저장된 순서 그대로). */
    fun fetchStocks(token: String, etag: String?): ListResult =
        fetchList("$BASE/api/widget/stocks", token, etag)

    /** 지정된 '환율' 위젯의 원화 환산 시세. */
    fun fetchFx(token: String, etag: String?): ListResult =
        fetchList("$BASE/api/widget/fx", token, etag)

    private fun fetchList(url: String, token: String, etag: String?): ListResult {
        return try {
            val conn = open(url, "GET")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (etag != null) conn.setRequestProperty("If-None-Match", etag)
            when (conn.responseCode) {
                200 -> {
                    val body = JSONObject(conn.inputStream.bufferedReader().readText())
                    ListResult.Ok(
                        itemsJson = body.getJSONArray("items").toString(),
                        etag = conn.getHeaderField("ETag"),
                        linked = !body.isNull("instanceId"),
                        unavailable = body.optBoolean("unavailable", false),
                        indicatorsJson = body.optJSONArray("indicators")?.toString(),
                    )
                }
                304 -> ListResult.NotModified
                401 -> ListResult.Unauthorized
                else -> ListResult.Error("HTTP ${conn.responseCode}")
            }
        } catch (e: Exception) {
            ListResult.Error(e.message ?: e.javaClass.simpleName)
        }
    }

    /* ── 주식·환율 추가·삭제(요구: 폰에서도 관리) ─────────────────────── */

    /** 검색 결과 한 줄 — WidgetSymbolHit와 1:1. */
    data class SymbolHit(val symbol: String, val name: String, val sub: String)

    /**
     * 종목 검색(지수·국내·미국 합본). 폰에는 카탈로그가 없어 서버가 합쳐 준다.
     * 실패는 빈 목록 — 검색창이 죽는 것보다 낫다(서버도 같은 정책).
     */
    fun searchSymbols(token: String, query: String): List<SymbolHit> {
        return try {
            val q = java.net.URLEncoder.encode(query, "UTF-8")
            val conn = open("$BASE/api/widget/stocks/search?q=$q", "GET")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (conn.responseCode != 200) return emptyList()
            val arr = JSONObject(conn.inputStream.bufferedReader().readText())
                .getJSONArray("results")
            val out = ArrayList<SymbolHit>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val symbol = o.optString("symbol", "")
                if (symbol.isEmpty()) continue
                out.add(SymbolHit(symbol, o.optString("name", symbol), o.optString("sub", "")))
            }
            out
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** 지정된 주식 위젯에 종목 추가 — 서버가 시세 확인 후 넣는다. */
    fun addSymbol(token: String, symbol: String): MutResult =
        postJson("$BASE/api/widget/stocks", token, JSONObject().put("symbol", symbol), "추가에 실패했습니다")

    /** 지정된 환율 위젯에 통화 추가. */
    fun addFxCode(token: String, code: String): MutResult =
        postJson("$BASE/api/widget/fx", token, JSONObject().put("code", code), "추가에 실패했습니다")

    /** 종목 삭제 — 심볼은 `^KS11`처럼 특수문자가 있어 쿼리로 넘긴다(경로 인코딩 회피). */
    fun deleteSymbol(token: String, symbol: String): MutResult =
        delete("$BASE/api/widget/stocks?symbol=" + java.net.URLEncoder.encode(symbol, "UTF-8"), token)

    /** 통화 삭제. */
    fun deleteFxCode(token: String, code: String): MutResult =
        delete("$BASE/api/widget/fx?code=" + java.net.URLEncoder.encode(code, "UTF-8"), token)

    private fun postJson(
        url: String,
        token: String,
        body: JSONObject,
        fallback: String,
    ): MutResult {
        return try {
            val conn = open(url, "POST")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (conn.responseCode in 200..299) MutResult.Ok
            else MutResult.Fail(errorMessage(conn, fallback))
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    private fun delete(url: String, token: String): MutResult {
        return try {
            val conn = open(url, "DELETE")
            conn.setRequestProperty("Authorization", "Bearer $token")
            if (conn.responseCode in 200..299) MutResult.Ok
            else MutResult.Fail(errorMessage(conn, "삭제에 실패했습니다"))
        } catch (e: Exception) {
            MutResult.Fail("네트워크 오류: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    private fun errorMessage(conn: HttpURLConnection, fallback: String): String {
        return try {
            JSONObject(conn.errorStream?.bufferedReader()?.readText() ?: "")
                .optString("message", "")
                .ifEmpty { "$fallback (HTTP ${conn.responseCode})" }
        } catch (e: Exception) {
            "$fallback (HTTP ${conn.responseCode})"
        }
    }

    private fun open(url: String, method: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = TIMEOUT_MS
        conn.readTimeout = TIMEOUT_MS
        return conn
    }
}
