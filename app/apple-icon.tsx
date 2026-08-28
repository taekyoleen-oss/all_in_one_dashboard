/**
 * apple-icon — iOS/Android home-screen icon (PNG, generated). Mirrors app/icon.svg:
 * the 모두의 Dashboard mark — four rounded panes (clock · bar chart · list · line
 * chart) on a deep-navy container. 180×180 is the iOS apple-touch-icon size; iOS
 * applies its own rounded-rect mask, so the navy fills the full canvas.
 * Drawing lives in lib/brandIcon (shared with the TWA icon routes /icon-*.png).
 */
import { brandIconResponse } from "@/lib/brandIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIconResponse(180);
}
