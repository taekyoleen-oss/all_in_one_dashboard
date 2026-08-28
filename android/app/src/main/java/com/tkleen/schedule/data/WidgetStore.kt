package com.tkleen.schedule.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.tkleen.schedule.data.model.AgendaItem
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
}
