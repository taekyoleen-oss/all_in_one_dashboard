/** 512×512 PNG 앱 아이콘 — Bubblewrap init이 요구하는 크기. 정적 프리렌더. */
import { brandIconResponse } from "@/lib/brandIcon";

export const dynamic = "force-static";

export function GET() {
  return brandIconResponse(512);
}
