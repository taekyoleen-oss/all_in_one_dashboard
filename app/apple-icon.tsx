import { ImageResponse } from "next/og";

/**
 * apple-icon — iOS/Android home-screen icon (PNG, generated). Mirrors app/icon.svg:
 * the PaneBoard mark = one large active (teal) pane beside two stacked panes on a
 * dark canvas. 180×180 is the iOS apple-touch-icon size; iOS applies its own
 * rounded-rect mask, so we keep generous padding and a filled background.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 30,
          gap: 14,
          background: "#1B1D24",
        }}
      >
        {/* Large active pane (teal — matches --primary) */}
        <div
          style={{
            width: 44,
            height: "100%",
            borderRadius: 16,
            background: "#34AECB",
          }}
        />
        {/* Two stacked panes */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 14,
          }}
        >
          <div style={{ flex: 1, borderRadius: 16, background: "#E7ECF2" }} />
          <div style={{ flex: 1, borderRadius: 16, background: "#4A5263" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
