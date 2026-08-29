package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * '지금 갱신' 트램펄린 — 화면 없음, 즉시 finish.
 * 전용 클래스인 이유는 SetFilterActivity 주석 참조(PendingIntent extras 병합 충돌).
 */
class SyncNowActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AgendaSyncWorker.syncNow(this)
        Toast.makeText(this, "갱신 중…", Toast.LENGTH_SHORT).show()
        finish() // Theme.NoDisplay는 onResume 전에 반드시 finish
    }
}
