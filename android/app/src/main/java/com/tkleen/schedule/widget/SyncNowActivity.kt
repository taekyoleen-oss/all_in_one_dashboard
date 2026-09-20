package com.tkleen.schedule.widget

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import com.tkleen.schedule.sync.AgendaSyncWorker

/**
 * 위젯의 '갱신 시각 ↻'을 눌렀을 때 — **즉시 동기화**하고 바로 닫힌다.
 *
 *  동기화는 15분 주기라, 웹에서 방금 바꾼 것(예: '모바일 홈 화면에 표시'를 켠 것)이
 *  폰에 뜨기까지 최대 15분이 걸린다. 기다리지 않아도 되도록 손으로 당길 길을 준다.
 *
 *  왜 액티비티인가 — 이 기기에서 **비포그라운드 프로세스의 Glance 재렌더·작업 실행이
 *  미뤄지는 것**을 v14에서 실측했다(작업 위젯 필터가 "안 먹던" 진짜 원인). 그래서
 *  SetTasksFilterActivity와 같은 방식으로, 보이는 UI 없는 투명 액티비티가 포그라운드를
 *  잡은 채 작업을 넣고 즉시 끝낸다.
 *
 *  창에 FLAG_NOT_TOUCHABLE|NOT_FOCUSABLE을 줘 터치가 아래(런처)로 통과한다 —
 *  투명 창이 잠깐이라도 홈 화면 입력을 삼키지 않게(v15에서 고친 '입력 삼킴').
 */
class SyncNowActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        )
        AgendaSyncWorker.syncNow(this)
        Toast.makeText(this, "갱신 중…", Toast.LENGTH_SHORT).show()
        finish()
    }
}
