/**
 * /api/app/apk — 안드로이드 앱(APK) 최신본 다운로드(요구: "앱에서 다운로드할 수 있게").
 *
 *  APK는 git에 넣지 않는다(릴리스마다 6MB씩 저장소가 불어난다 — .gitignore). 대신
 *  비공개 Storage 버킷 `pb-releases`의 `paneboard.apk` 하나를 최신본으로 덮어쓰고
 *  (scripts/upload-apk.mjs), 이 라우트가 **로그인한 회원에게만** 5분짜리 서명 URL로
 *  넘겨준다. 승인제 앱이라 외부에 주소가 새도 받을 수 없게 한다.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireUser();
  if (gate) return gate;

  const { data, error } = await createAdminClient()
    .storage.from("pb-releases")
    .createSignedUrl("paneboard.apk", 300, { download: "PaneBoard.apk" });
  if (error || !data) {
    return Response.json(
      { error: "not_found", message: "아직 올라간 APK가 없습니다." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.redirect(data.signedUrl);
}
