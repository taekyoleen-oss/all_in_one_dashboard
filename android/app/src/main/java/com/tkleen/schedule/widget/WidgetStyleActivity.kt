package com.tkleen.schedule.widget

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import com.tkleen.schedule.data.WidgetStore

/**
 * 위젯 표시 설정(요구) — 글자 크기 5단계 · 배경 5색. 위젯 제목(`작업 ⚙`·`노트 ⚙`)을
 * 누르면 열린다.
 *
 *  종류는 data URI host로 받는다(`pbstyle://tasks`) — 값마다 고유 인텐트가 되어
 *  PendingIntent filterEquals 병합의 여지가 없다(v10 교훈).
 *
 *  고르는 즉시 저장하고 위젯을 다시 그린다 — '저장' 버튼이 없다. 폰 안에만 남는
 *  값이라 서버 왕복이 없고, 미리보기 상자가 결과를 그대로 보여 준다.
 */
class WidgetStyleActivity : Activity() {

    /** 표시 설정을 쓰는 위젯 종류(저장 키 접미사이기도 하다). */
    private val KINDS = setOf("tasks", "notes", "stocks", "fx")

    private lateinit var kind: String
    private var night = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        actionBar?.hide() // edge-to-edge에서 제목 바가 내용 위로 겹친다(기존 화면과 동일)

        kind = intent?.data?.host?.takeIf { it in KINDS } ?: "tasks"
        night = isNightMode()

        val pad = (16 * resources.displayMetrics.density).toInt()
        val subject = when (kind) {
            "notes" -> "노트"
            "stocks" -> "주식"
            "fx" -> "환율"
            else -> "작업"
        }

        val preview = TextView(this).apply {
            text = when (kind) {
                "notes" -> "1주차 강의 정리"
                "stocks" -> "삼성전자          77,800  +1.24%"
                "fx" -> "USD                1,378.20원"
                else -> "장보기 목록 정리"
            }
            setPadding(pad, pad, pad, pad)
        }
        val previewSub = TextView(this).apply {
            text = "미리보기 — 홈 화면 위젯에 이렇게 보입니다"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }

        fun applyPreview() {
            val level = WidgetStore.textLevel(this, kind)
            val bg = WidgetStore.bgIndex(this, kind)
            preview.setTextSize(TypedValue.COMPLEX_UNIT_SP, WidgetStyle.bodySp(level))
            preview.setBackgroundColor(
                if (bg == 0) defaultBgArgb() else WidgetStyle.bgArgb(bg, night),
            )
            preview.setTextColor(if (night) 0xFFECEFF4.toInt() else 0xFF1B2845.toInt())
        }

        /* 글자 크기 — 라디오 글자 자체를 그 크기로 그려 고르기 전에 확인된다. */
        val sizeGroup = RadioGroup(this).apply {
            orientation = RadioGroup.VERTICAL
            WidgetStyle.TEXT_LABELS.forEachIndexed { i, label ->
                addView(
                    RadioButton(this@WidgetStyleActivity).apply {
                        text = label
                        id = 100 + i
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, WidgetStyle.bodySp(i))
                    },
                )
            }
            check(100 + WidgetStore.textLevel(this@WidgetStyleActivity, kind))
            setOnCheckedChangeListener { _, checkedId ->
                WidgetStore.setTextLevel(this@WidgetStyleActivity, kind, checkedId - 100)
                applyPreview()
                refreshWidget(this@WidgetStyleActivity, kind)
            }
        }

        /* 배경색 — 버튼 자체를 그 색으로 칠한다. */
        val bgButtons = mutableListOf<Button>()
        fun paintBg() {
            val current = WidgetStore.bgIndex(this, kind)
            bgButtons.forEachIndexed { i, b ->
                b.text = if (i == current) "✓ " + WidgetStyle.BG_LABELS[i] else WidgetStyle.BG_LABELS[i]
                b.setBackgroundColor(if (i == 0) defaultBgArgb() else WidgetStyle.bgArgb(i, night))
                b.setTextColor(if (night) 0xFFECEFF4.toInt() else 0xFF1B2845.toInt())
                b.setTypeface(null, if (i == current) Typeface.BOLD else Typeface.NORMAL)
            }
        }
        val bgRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        WidgetStyle.BG_LABELS.indices.forEach { i ->
            val b = Button(this).apply {
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                setPadding(0, 0, 0, 0)
                setOnClickListener {
                    WidgetStore.setBgIndex(this@WidgetStyleActivity, kind, i)
                    paintBg()
                    applyPreview()
                    refreshWidget(this@WidgetStyleActivity, kind)
                }
            }
            bgButtons += b
            bgRow.addView(b, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        paintBg()
        applyPreview()

        setContentView(
            ScrollView(this).apply {
                addView(
                    LinearLayout(this@WidgetStyleActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        fitsSystemWindows = true
                        setPadding(pad, pad, pad, pad)
                        addView(
                            TextView(this@WidgetStyleActivity).apply {
                                text = "$subject 위젯 표시 설정"
                                setTypeface(typeface, Typeface.BOLD)
                                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                            },
                        )
                        addView(
                            TextView(this@WidgetStyleActivity).apply {
                                text = "이 폰에서만 적용됩니다 (웹 대시보드는 그대로)"
                                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                            },
                        )
                        addView(space(pad))
                        addView(sectionLabel("글자 크기"))
                        addView(sizeGroup)
                        addView(space(pad))
                        addView(sectionLabel("배경색"))
                        addView(bgRow, wide())
                        addView(space(pad))
                        addView(previewSub)
                        addView(preview, wide())
                        addView(space(pad))
                        if (kind == "tasks" || kind == "notes") {
                            addView(
                                TextView(this@WidgetStyleActivity).apply {
                                    text = "작업·소제목 하나하나의 글자색은 그 항목을 눌러 여는 화면에서 고릅니다."
                                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                                },
                            )
                        }
                        addView(space(pad))
                        addView(
                            Button(this@WidgetStyleActivity).apply {
                                text = "닫기"
                                setOnClickListener { finish() }
                            },
                            wide(),
                        )
                    },
                )
            },
        )
    }

    /** '기본' 배경 = 위젯 고유 배경(작업=흰색, 노트=옅은 회색 — AgendaTheme과 같은 값). */
    private fun defaultBgArgb(): Int = when {
        kind == "notes" && night -> 0xFF20252B.toInt()
        kind == "notes" -> 0xFFF1F3F5.toInt()
        night -> 0xFF16191C.toInt()
        else -> 0xFFFFFFFF.toInt()
    }

    private fun sectionLabel(text: String) = TextView(this).apply {
        this.text = text
        setTypeface(typeface, Typeface.BOLD)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
    }

    private fun wide() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    )

    private fun space(h: Int) = TextView(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, h)
    }
}

/** 표시 설정 화면 인텐트 — 종류마다 고유 data URI(PendingIntent 병합 방지, v10 교훈). */
internal fun styleIntent(context: Context, kind: String): Intent =
    Intent(context, WidgetStyleActivity::class.java).setData(Uri.parse("pbstyle://$kind"))
