import { ImageResponse } from "next/og";

/**
 * 브랜드 마크 PNG 렌더러 — apple-icon과 TWA용 아이콘 라우트(/icon-192.png 등)가
 * 공유한다. 마크 SVG(1024 space)는 app/icon.svg와 1:1 — 네 개의 라운드 패널
 * (시계·막대그래프·목록·선그래프)을 딥네이비 배경 위에 그린다.
 *
 * maskable 안전영역: 마크 내용이 캔버스의 중앙 25%~75% 구간(≈51%)에만 있어
 * 안드로이드 마스크 안전존(중앙 80%) 안에 넉넉히 들어간다 — 별도 패딩 불요.
 */

export const MARK_SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect x="252" y="252" width="230" height="230" rx="44" fill="#FAFAF7"/><circle cx="367" cy="367" r="60" fill="none" stroke="#DBE3EE" stroke-width="26"/><path d="M 367 307 A 60 60 0 1 1 307 367" fill="none" stroke="#4A90C2" stroke-width="26" stroke-linecap="round"/><rect x="542" y="252" width="230" height="230" rx="44" fill="#4A90C2"/><rect x="588" y="372" width="36" height="60" rx="12" fill="#FFFFFF"/><rect x="641" y="332" width="36" height="100" rx="12" fill="#FFFFFF"/><rect x="694" y="300" width="36" height="132" rx="12" fill="#FFFFFF"/><rect x="252" y="542" width="230" height="230" rx="44" fill="#FAFAF7"/><rect x="300" y="602" width="134" height="22" rx="11" fill="#1B2845"/><rect x="300" y="648" width="96" height="22" rx="11" fill="#CBD5E1"/><rect x="300" y="694" width="116" height="22" rx="11" fill="#4A90C2"/><rect x="542" y="542" width="230" height="230" rx="44" fill="#FAFAF7"/><polyline points="584,714 636,658 690,686 732,598" fill="none" stroke="#4A90C2" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="732" cy="598" r="15" fill="#1B2845"/></svg>`;

/** 딥네이비 풀블리드 배경 + 마크를 px×px PNG로. */
export function brandIconResponse(px: number) {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#1B2845",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={px} height={px} alt="모두의 Dashboard" />
      </div>
    ),
    { width: px, height: px },
  );
}
