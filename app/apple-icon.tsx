import { ImageResponse } from "next/og";

/**
 * apple-icon — iOS/Android home-screen icon (PNG, generated). Mirrors app/icon.svg:
 * the 모두의 Dashboard mark — four rounded panes (clock · bar chart · list · line
 * chart) on a deep-navy container. 180×180 is the iOS apple-touch-icon size; iOS
 * applies its own rounded-rect mask, so the navy fills the full canvas. The mark
 * SVG (1024 space) is rasterized via an <img> data URI so it stays 1:1 with icon.svg.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same artwork as app/icon.svg, minus the outer rounded container (iOS masks it);
// a flat navy background fills the canvas instead.
const MARK_SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect x="252" y="252" width="230" height="230" rx="44" fill="#FAFAF7"/><circle cx="367" cy="367" r="60" fill="none" stroke="#DBE3EE" stroke-width="26"/><path d="M 367 307 A 60 60 0 1 1 307 367" fill="none" stroke="#4A90C2" stroke-width="26" stroke-linecap="round"/><rect x="542" y="252" width="230" height="230" rx="44" fill="#4A90C2"/><rect x="588" y="372" width="36" height="60" rx="12" fill="#FFFFFF"/><rect x="641" y="332" width="36" height="100" rx="12" fill="#FFFFFF"/><rect x="694" y="300" width="36" height="132" rx="12" fill="#FFFFFF"/><rect x="252" y="542" width="230" height="230" rx="44" fill="#FAFAF7"/><rect x="300" y="602" width="134" height="22" rx="11" fill="#1B2845"/><rect x="300" y="648" width="96" height="22" rx="11" fill="#CBD5E1"/><rect x="300" y="694" width="116" height="22" rx="11" fill="#4A90C2"/><rect x="542" y="542" width="230" height="230" rx="44" fill="#FAFAF7"/><polyline points="584,714 636,658 690,686 732,598" fill="none" stroke="#4A90C2" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="732" cy="598" r="15" fill="#1B2845"/></svg>`;

export default function AppleIcon() {
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
        <img src={dataUri} width={180} height={180} alt="모두의 Dashboard" />
      </div>
    ),
    { ...size },
  );
}
