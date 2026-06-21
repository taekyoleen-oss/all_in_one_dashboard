import { ImageResponse } from "next/og";

/**
 * apple-icon — iOS/Android home-screen icon (PNG, generated). Mirrors app/icon.svg:
 * the tkLeen mark (T = cream, K = Sky Blue tiles) on a deep-navy container. The K's
 * stair of square tiles echoes the modular dashboard panes. 180×180 is the iOS
 * apple-touch-icon size; iOS applies its own rounded-rect mask, so the navy fills
 * the full canvas. Coordinates are the brand guide's canonical mark, scaled ×0.9
 * (200→180) so the 200-space rects map 1:1 into 180px.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SKY = "#4A90C2";
const CREAM = "#FAFAF7";

/** Canonical mark rect, scaled from the 200×200 brand space into 180×180. */
function Tile({ x, y, w, h, fill }: { x: number; y: number; w: number; h: number; fill: string }) {
  const s = 180 / 200;
  return (
    <div
      style={{
        position: "absolute",
        left: x * s,
        top: y * s,
        width: w * s,
        height: h * s,
        background: fill,
      }}
    />
  );
}

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#1B2845",
        }}
      >
        {/* T — cream */}
        <Tile x={40} y={40} w={80} h={20} fill={CREAM} />
        <Tile x={60} y={60} w={20} h={40} fill={CREAM} />
        {/* K — Sky Blue tiles */}
        <Tile x={60} y={100} w={20} h={60} fill={SKY} />
        <Tile x={80} y={100} w={20} h={20} fill={SKY} />
        <Tile x={100} y={80} w={20} h={20} fill={SKY} />
        <Tile x={120} y={60} w={20} h={20} fill={SKY} />
        <Tile x={80} y={120} w={20} h={20} fill={SKY} />
        <Tile x={100} y={140} w={20} h={20} fill={SKY} />
        <Tile x={120} y={160} w={20} h={20} fill={SKY} />
      </div>
    ),
    { ...size },
  );
}
