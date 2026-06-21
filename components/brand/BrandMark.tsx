/**
 * ============================================================================
 *  BrandMark — tkLeen 로고 마크 (정답 SVG, 테마 적응)
 * ============================================================================
 *
 *  tkLeen 브랜드 가이드(00-BRAND-GUIDE.md §2)의 "절대 정답" 마크를 verbatim으로
 *  옮긴 컴포넌트. T와 K는 가운데 세로획(x=60-80)을 공유하는 합자(ligature)이며,
 *  9개 rect의 좌표는 절대 재계산하지 않는다.
 *
 *  색 규칙:
 *    • T(가로획 + 세로획 위) → `currentColor`. 헤더의 `text-foreground`를 상속해
 *      다크에선 Cream(밝은색), 라이트에선 Ink(어두운색)로 자동 전환 →
 *      브랜드 가이드의 reversed(다크)/primary(라이트) 규칙을 한 컴포넌트로 충족.
 *    • K(세로획 아래 + 상·하 사선 6개) → Sky Blue(#4A90C2). 잠긴 시그니처 색,
 *      절대 변경 금지.
 *
 *  viewBox는 콘텐츠(x40~140, y40~180)에 균등 패딩(10)을 준 "30 30 120 160"로
 *  크롭해 헤더에서 좌측 치우침 없이 보이게 한다(원본 200×200 캔버스의 비대칭
 *  여백 제거). 가로:세로 = 3:4.
 * ============================================================================
 */

import * as React from "react";

const SKY = "#4A90C2"; // 브랜드 시그니처(잠금) — 변경 금지

export interface BrandMarkProps {
  /** 렌더 높이(px). 너비는 3:4 비율로 자동(height × 0.75). */
  height?: number;
  className?: string;
}

export function BrandMark({ height = 26, className }: BrandMarkProps) {
  return (
    <svg
      width={Math.round(height * 0.75)}
      height={height}
      viewBox="30 30 120 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="tkLeen"
      className={className}
    >
      {/* T — currentColor(=foreground): 다크 Cream / 라이트 Ink */}
      <rect x="40" y="40" width="80" height="20" fill="currentColor" />
      <rect x="60" y="60" width="20" height="40" fill="currentColor" />
      {/* K — Sky Blue(잠금) */}
      <rect x="60" y="100" width="20" height="60" fill={SKY} />
      <rect x="80" y="100" width="20" height="20" fill={SKY} />
      <rect x="100" y="80" width="20" height="20" fill={SKY} />
      <rect x="120" y="60" width="20" height="20" fill={SKY} />
      <rect x="80" y="120" width="20" height="20" fill={SKY} />
      <rect x="100" y="140" width="20" height="20" fill={SKY} />
      <rect x="120" y="160" width="20" height="20" fill={SKY} />
    </svg>
  );
}

export default BrandMark;
