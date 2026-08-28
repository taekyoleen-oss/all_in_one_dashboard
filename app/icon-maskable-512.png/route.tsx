/**
 * 512×512 maskable PNG — 안드로이드 적응형 아이콘. 마크 내용이 중앙 ≈51%에만
 * 있어(안전존 80% 이내) 일반 아이콘과 같은 드로잉을 그대로 쓴다(lib/brandIcon 참조).
 */
import { brandIconResponse } from "@/lib/brandIcon";

export const dynamic = "force-static";

export function GET() {
  return brandIconResponse(512);
}
