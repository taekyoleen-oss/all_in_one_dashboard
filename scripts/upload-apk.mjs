// 빌드한 APK를 Storage에 최신본으로 올린다 → 설정 > 위젯의 '앱 다운로드' 링크가 이 파일을 준다.
// 사용: node scripts/upload-apk.mjs   (bubblewrap build 뒤, paneboard/ 에서)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

await sb.storage.createBucket("pb-releases", { public: false }).catch(() => {}); // 이미 있으면 무시
const apk = readFileSync("android/app-release-signed.apk");
const { error } = await sb.storage.from("pb-releases").upload("paneboard.apk", apk, {
  upsert: true,
  contentType: "application/vnd.android.package-archive",
});
if (error) {
  console.error("업로드 실패:", error.message);
  process.exit(1);
}
console.log(`업로드 완료: pb-releases/paneboard.apk (${(apk.length / 1048576).toFixed(1)}MB)`);
