import type { MetadataRoute } from "next";

/**
 * PWA manifest — lets PaneBoard be installed to a phone/tablet home screen with
 * the app icon + dark theme chrome. Next auto-injects <link rel="manifest">.
 * Icons reuse the file-convention routes: /icon.svg (scalable, browsers) and
 * /apple-icon (180×180 PNG, generated). theme/background match --background.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "개인 Dashboard",
    short_name: "개인 Dashboard",
    description: "tkLeen · 개인 모듈형 캔버스 대시보드",
    start_url: "/",
    display: "standalone",
    // tkLeen 브랜드 Deep Navy(#1B2845) — 앱 아이콘 컨테이너 색과 통일
    background_color: "#1B2845",
    theme_color: "#1B2845",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
