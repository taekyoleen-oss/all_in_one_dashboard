/** 192×192 PNG 앱 아이콘 — PWA manifest·TWA(Bubblewrap)용. 정적 프리렌더. */
import { brandIconResponse } from "@/lib/brandIcon";

export const dynamic = "force-static";

export function GET() {
  return brandIconResponse(192);
}
