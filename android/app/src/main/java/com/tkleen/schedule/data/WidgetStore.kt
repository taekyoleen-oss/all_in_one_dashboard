package com.tkleen.schedule.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.tkleen.schedule.data.model.AgendaItem
import com.tkleen.schedule.data.model.NoteItem
import com.tkleen.schedule.data.model.TaskItem
import com.tkleen.schedule.sync.AgendaSyncWorker
import com.tkleen.schedule.widget.WidgetStyle
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * 위젯 로컬 저장소 — 디바이스 토큰(Android Keystore AES/GCM 암호화) + 아젠다 캐시.
 *
 *  토큰: 계획서는 EncryptedSharedPreferences 우선 검토를 지시했으나 androidx
 *  security-crypto는 지원 종료(2024) → 계획서의 대안대로 Keystore AES/GCM 직접 구현.
 *  키는 하드웨어 보호 키스토어에 있고, prefs에는 iv+암호문(Base64)만 남는다.
 *
 *  캐시: 계획서의 DataStore 대신 SharedPreferences — 값 4개(json·etag·시각·인증오류)의
 *  동기 읽기가 Glance provideGlance에서 단순하고 의존성이 0이다.
 */
object WidgetStore {
    private const val PREFS = "pb_widget"
    private const val KEY_ALIAS = "pb_widget_token"
    private const val K_TOKEN = "token_enc"
    private const val K_AGENDA = "agenda_json"
    private const val K_ETAG = "agenda_etag"
    private const val K_SYNCED_AT = "synced_at"
    private const val K_UNAUTHORIZED = "unauthorized"
    private const val K_TASKS = "tasks_json"
    private const val K_TASKS_ETAG = "tasks_etag"
    private const val K_TASKS_LINKED = "tasks_linked"
    private const val K_TASKS_SYNCED_AT = "tasks_synced_at"
    private const val K_NOTES = "notes_json"
    private const val K_NOTES_ETAG = "notes_etag"
    private const val K_NOTES_SYNCED_AT = "notes_synced_at"
    private const val K_NOTES_LINKED = "notes_linked"
    private const val K_TASKS_FILTER = "tasks_filter"
    private const val K_TASKS_FILTER_AT = "tasks_filter_at"

    /** 비-기본 필터(완료·전체)가 유지되는 시간 — 지나면 진행중으로 자동 복귀(요구). */
    const val FILTER_REVERT_MS: Long = 10 * 60_000L
    private const val K_TASKS_DELETE_MARKS = "tasks_delete_marks"

    /** 표시 설정(요구) — 위젯 종류별 접미사가 붙는다: `style_text_tasks` 등. */
    private const val K_STYLE_TEXT = "style_text_"
    private const val K_STYLE_BG = "style_bg_"
    private const val K_ITEM_COLORS = "item_colors_"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /* ── 토큰 (암호화) ─────────────────────────────────────────────────── */

    private fun secretKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    fun saveToken(context: Context, token: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val ct = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
        val packed = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" +
            Base64.encodeToString(ct, Base64.NO_WRAP)
        prefs(context).edit().putString(K_TOKEN, packed).putBoolean(K_UNAUTHORIZED, false).apply()
    }

    /** 복호화 실패(키 무효화·OS 복원 등)면 토큰을 지우고 null — 재페어링 유도. */
    fun loadToken(context: Context): String? {
        val packed = prefs(context).getString(K_TOKEN, null) ?: return null
        return try {
            val (ivB64, ctB64) = packed.split(":", limit = 2).let { it[0] to it[1] }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey(),
                GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)),
            )
            String(cipher.doFinal(Base64.decode(ctB64, Base64.NO_WRAP)), Charsets.UTF_8)
        } catch (e: Exception) {
            clearPairing(context)
            null
        }
    }

    fun clearPairing(context: Context) {
        prefs(context).edit().clear().apply()
    }

    /* ── 아젠다 캐시 ───────────────────────────────────────────────────── */

    fun putAgenda(context: Context, itemsJson: String, etag: String?, syncedAt: Long) {
        prefs(context).edit()
            .putString(K_AGENDA, itemsJson)
            .putString(K_ETAG, etag)
            .putLong(K_SYNCED_AT, syncedAt)
            .putBoolean(K_UNAUTHORIZED, false)
            .apply()
    }

    fun touchSynced(context: Context, syncedAt: Long) {
        prefs(context).edit().putLong(K_SYNCED_AT, syncedAt).putBoolean(K_UNAUTHORIZED, false).apply()
    }

    fun markUnauthorized(context: Context) {
        prefs(context).edit().putBoolean(K_UNAUTHORIZED, true).apply()
    }

    fun etag(context: Context): String? = prefs(context).getString(K_ETAG, null)

    fun syncedAt(context: Context): Long = prefs(context).getLong(K_SYNCED_AT, 0L)

    fun unauthorized(context: Context): Boolean = prefs(context).getBoolean(K_UNAUTHORIZED, false)

    fun isPaired(context: Context): Boolean = prefs(context).contains(K_TOKEN)

    /** 캐시된 아젠다 — 파싱 실패 시 빈 목록(위젯을 비우기보다 안내 문구가 낫다). */
    fun agendaItems(context: Context): List<AgendaItem> {
        val json = prefs(context).getString(K_AGENDA, null) ?: return emptyList()
        return try {
            AgendaItem.listFromJson(json)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /* ── 작업(tasks) 캐시 ──────────────────────────────────────────────── */

    fun putTasks(context: Context, itemsJson: String, etag: String?, linked: Boolean, syncedAt: Long) {
        prefs(context).edit()
            .putString(K_TASKS, itemsJson)
            .putString(K_TASKS_ETAG, etag)
            .putBoolean(K_TASKS_LINKED, linked)
            .putLong(K_TASKS_SYNCED_AT, syncedAt)
            .apply()
    }

    fun touchTasksSynced(context: Context, syncedAt: Long) {
        prefs(context).edit().putLong(K_TASKS_SYNCED_AT, syncedAt).apply()
    }

    fun tasksEtag(context: Context): String? = prefs(context).getString(K_TASKS_ETAG, null)

    /** 웹에서 '모바일 홈 화면에 표시'가 켜진 작업 위젯이 있는지(없으면 안내 표시). */
    fun tasksLinked(context: Context): Boolean = prefs(context).getBoolean(K_TASKS_LINKED, false)

    fun tasksSyncedAt(context: Context): Long = prefs(context).getLong(K_TASKS_SYNCED_AT, 0L)

    fun taskItems(context: Context): List<TaskItem> {
        val json = prefs(context).getString(K_TASKS, null) ?: return emptyList()
        return try {
            TaskItem.listFromJson(json)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * 낙관적 캐시 변형(수정/삭제 즉시 반영용). ETag를 함께 지운다 — API 호출이
     * 실패한 경우에도 다음 동기화가 304로 스킵하지 않고 서버 진실을 다시 받아
     * 로컬 변형을 복원한다.
     */
    fun mutateTasks(context: Context, transform: (List<TaskItem>) -> List<TaskItem>) {
        val next = TaskItem.listToJson(transform(taskItems(context)))
        prefs(context).edit().putString(K_TASKS, next).remove(K_TASKS_ETAG).apply()
    }

    /* ── 노트(notes) 캐시 ─────────────────────────────────────────────── */

    fun putNotes(
        context: Context,
        itemsJson: String,
        etag: String?,
        linked: Boolean,
        syncedAt: Long,
    ) {
        prefs(context).edit()
            .putString(K_NOTES, itemsJson)
            .putString(K_NOTES_ETAG, etag)
            .putBoolean(K_NOTES_LINKED, linked)
            .putLong(K_NOTES_SYNCED_AT, syncedAt)
            .apply()
    }

    /** 웹에서 '모바일 홈 화면에 표시'를 켠 노트가 있는지(없으면 안내 표시). */
    fun notesLinked(context: Context): Boolean =
        prefs(context).getBoolean(K_NOTES_LINKED, false)

    fun touchNotesSynced(context: Context, syncedAt: Long) {
        prefs(context).edit().putLong(K_NOTES_SYNCED_AT, syncedAt).apply()
    }

    fun notesEtag(context: Context): String? = prefs(context).getString(K_NOTES_ETAG, null)

    fun notesSyncedAt(context: Context): Long = prefs(context).getLong(K_NOTES_SYNCED_AT, 0L)

    fun noteItems(context: Context): List<NoteItem> {
        val json = prefs(context).getString(K_NOTES, null) ?: return emptyList()
        return try {
            NoteItem.listFromJson(json)
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** 낙관적 캐시 변형 — 작업과 같은 이유로 ETag도 함께 지운다(실패 시 서버 진실로 복원). */
    fun mutateNotes(context: Context, transform: (List<NoteItem>) -> List<NoteItem>) {
        val next = NoteItem.listToJson(transform(noteItems(context)))
        prefs(context).edit().putString(K_NOTES, next).remove(K_NOTES_ETAG).apply()
    }
    /* ── 작업 위젯 필터 ────────────────────────────────────────────────── */

    /**
     * 위젯 상단 필터: "pending"(기본) | "done" | "all".
     * 완료·전체는 켠 지 10분이 지나면 진행중으로 자가 복귀한다(요구) — 렌더 시점
     * 판정 + 만료 시 저장값도 정리(외출옷 위젯의 시간대 자가 복귀와 같은 패턴).
     */
    fun tasksFilter(context: Context): String {
        val p = prefs(context)
        val stored = p.getString(K_TASKS_FILTER, "pending") ?: "pending"
        if (stored == "pending") return "pending"
        val at = p.getLong(K_TASKS_FILTER_AT, 0L)
        if (System.currentTimeMillis() - at > FILTER_REVERT_MS) {
            p.edit().putString(K_TASKS_FILTER, "pending").apply()
            return "pending"
        }
        return stored
    }

    fun setTasksFilter(context: Context, filter: String) {
        prefs(context).edit()
            .putString(K_TASKS_FILTER, filter)
            .putLong(K_TASKS_FILTER_AT, System.currentTimeMillis())
            .apply()
        // 완료·전체는 10분 뒤 복귀 시점에 재렌더가 필요하다(만료 판정은 렌더 시점) —
        // 모든 호출처(위젯 필터 버튼·관리 화면)에서 예약이 걸리도록 여기서 건다.
        if (filter == "pending") AgendaSyncWorker.cancelFilterRevert(context)
        else AgendaSyncWorker.scheduleFilterRevert(context)
    }

    /* ── 삭제 예정 마크(요구) ──────────────────────────────────────────────
     * ✕ 1탭 = 마크(행에 '삭제' 표시, 서버 호출 없음 — 즉시 시각 피드백),
     * ✕ 재탭 = 해제(유지). 실제 삭제는 다음 동기화 때 AgendaSyncWorker가 수행. */

    fun toggleDeleteMark(context: Context, id: String): Boolean {
        val next = HashSet(pendingDeleteIds(context))
        val marked = if (next.contains(id)) {
            next.remove(id); false
        } else {
            next.add(id); true
        }
        prefs(context).edit().putStringSet(K_TASKS_DELETE_MARKS, next).apply()
        return marked
    }

    fun clearDeleteMark(context: Context, id: String) {
        val next = HashSet(pendingDeleteIds(context))
        if (next.remove(id)) {
            prefs(context).edit().putStringSet(K_TASKS_DELETE_MARKS, next).apply()
        }
    }

    fun pendingDeleteIds(context: Context): Set<String> =
        prefs(context).getStringSet(K_TASKS_DELETE_MARKS, emptySet()) ?: emptySet()

    /* ── 표시 설정(요구) ───────────────────────────────────────────────────
     * 글자 크기·배경색은 위젯 종류별로, 글자색은 항목별로. 전부 **이 폰에만**
     * 남는다(웹과 동기화하지 않는다 — 이유는 WidgetStyle 주석). kind는 "tasks"|"notes". */

    fun textLevel(context: Context, kind: String): Int =
        prefs(context).getInt(K_STYLE_TEXT + kind, WidgetStyle.DEFAULT_TEXT)

    fun bgIndex(context: Context, kind: String): Int =
        prefs(context).getInt(K_STYLE_BG + kind, 0)

    fun setTextLevel(context: Context, kind: String, level: Int) {
        prefs(context).edit().putInt(K_STYLE_TEXT + kind, level).apply()
    }

    fun setBgIndex(context: Context, kind: String, index: Int) {
        prefs(context).edit().putInt(K_STYLE_BG + kind, index).apply()
    }

    /** 항목 id → 색 index. 기본색(0)은 아예 저장하지 않는다(맵이 커지지 않게). */
    fun itemColors(context: Context, kind: String): Map<String, Int> {
        val raw = prefs(context).getString(K_ITEM_COLORS + kind, null) ?: return emptyMap()
        return try {
            val obj = JSONObject(raw)
            buildMap {
                for (key in obj.keys()) put(key, obj.optInt(key, 0))
            }
        } catch (e: Exception) {
            emptyMap()
        }
    }

    fun itemColor(context: Context, kind: String, id: String): Int =
        itemColors(context, kind)[id] ?: 0

    fun setItemColor(context: Context, kind: String, id: String, index: Int) {
        val next = HashMap(itemColors(context, kind))
        if (index <= 0) next.remove(id) else next[id] = index
        // 지워진 항목의 색이 영원히 쌓이지 않게 — 커졌을 때만 살아 있는 id로 정리한다
        // (갓 추가한 항목이 아직 캐시에 없을 수 있어 매번 정리하지는 않는다).
        if (next.size > 200) {
            val live = when (kind) {
                "notes" -> noteItems(context).map { it.key }.toSet()
                else -> taskItems(context).map { it.id }.toSet()
            }
            next.keys.retainAll { it == id || it in live }
        }
        prefs(context).edit()
            .putString(K_ITEM_COLORS + kind, JSONObject(next as Map<*, *>).toString())
            .apply()
    }
}
