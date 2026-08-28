package com.tkleen.schedule.widget

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.tkleen.schedule.pairing.PairingActivity

/** 두 위젯(오늘 일정·작업)이 공유하는 미연결/해제 안내 CTA. */
@Composable
internal fun PairingCta(revoked: Boolean, subject: String) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            if (revoked) "연결이 해제되었습니다" else "$subject 위젯을 연결하세요",
            style = TextStyle(color = AgendaTheme.text, fontSize = 13.sp, fontWeight = FontWeight.Medium),
        )
        Spacer(GlanceModifier.height(4.dp))
        Text(
            "웹 설정 > 위젯에서 코드를 발급받아 입력",
            style = TextStyle(color = AgendaTheme.textDim, fontSize = 11.sp),
        )
        Spacer(GlanceModifier.height(8.dp))
        Button(text = if (revoked) "다시 연결" else "연결하기", onClick = actionStartActivity<PairingActivity>())
    }
}
