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

    private fun open(url: String, method: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = TIMEOUT_MS
        conn.readTimeout = TIMEOUT_MS
        return conn
    }
}
