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
