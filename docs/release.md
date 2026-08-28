# 안드로이드 앱(TWA) 릴리스 가이드 — com.tkleen.schedule

PLAN-android-widget.md P2 산출. 앱은 Bubblewrap TWA 셸(웹 = all-in-one-dashboard-eight.vercel.app)이며,
배포는 **서명 APK 사이드로드**(가족·소수 공유, Play 미등록) 기준이다.

## 서명 (분실 주의 — 백업 필수)

| 항목 | 값 |
| --- | --- |
| 키스토어 | `android/android.keystore` (**git 미커밋** — `.gitignore`) |
| 비밀번호 | `android/keystore.properties` (**git 미커밋**, storePassword=keyPassword) |
| alias | `android` |
| SHA-256 지문 | `5E:CF:C1:15:67:E1:53:8E:DD:F1:28:C8:F4:3F:69:B0:95:B8:98:35:FE:95:D8:CD:F0:AD:B4:F5:2E:FB:9D:99` |

- 이 지문이 `public/.well-known/assetlinks.json`에 배포되어 있어야 앱에서 주소창이 사라진다(DAL).
- **키스토어·keystore.properties를 잃으면** 같은 패키지로 업데이트 설치가 불가(재설치 필요)하고
  assetlinks도 새 지문으로 재배포해야 한다 → 두 파일을 안전한 곳에 백업할 것.

## 빌드 절차 (Windows, 이 PC)

도구: `@bubblewrap/cli`(전역), JDK 17·Android SDK는 `~/.bubblewrap/`에 설치됨(빌드 시 자동 사용).

```bash
cd android
export BUBBLEWRAP_KEYSTORE_PASSWORD=$(grep -oP '(?<=^storePassword=).*' keystore.properties)
export BUBBLEWRAP_KEY_PASSWORD=$(grep -oP '(?<=^keyPassword=).*' keystore.properties)
env -u NoDefaultCurrentDirectoryInExePath bubblewrap build --skipPwaValidation
```

- 산출물: `android/app-release-signed.apk` (사이드로드 배포용), `app-release-bundle.aab`(Play용, 필요 시).
- ⚠ `NoDefaultCurrentDirectoryInExePath=1`인 셸(Claude Code 등)에서는 위처럼 `env -u`로 해제해야
  bubblewrap이 `gradlew.bat`을 찾는다.
- ⚠ 다운로드 중 `Failed to delete original file …` 오류는 백신의 임시파일 잠금 경합(일시적) —
  성공할 때까지 재실행하면 진행된다(의존성은 시도마다 캐시에 누적).

## 버전 규칙

- 릴리스마다 `android/twa-manifest.json`의 `appVersionCode` **+1**, `appVersion`은 표시용 문자열.
- 수정 후 `bubblewrap update --skipVersionUpgrade` → build. (versionCode를 안 올리면 기기에서 업데이트 설치 거부)

## 웹 쪽 변경 시

- 웹앱(UI·API)은 Vercel 배포만으로 앱에 즉시 반영된다(앱 재배포 불필요).
- 앱 재빌드가 필요한 경우: 시작 URL·색·아이콘·패키지 등 `twa-manifest.json` 항목 변경 시.
- manifest 아이콘 경로/도메인이 바뀌면 assetlinks.json·twa-manifest.json 동기 수정.

## 릴리스 체크리스트

1. [ ] `appVersionCode` +1 (`twa-manifest.json`)
2. [ ] `bubblewrap update --skipVersionUpgrade` → 위 빌드 절차
3. [ ] `apksigner verify --print-certs` 지문이 assetlinks와 일치하는지 확인
4. [ ] 실기기 설치 → 주소창 미표시 확인(보이면 DAL 문제: 지문·패키지·배포 상태 재확인)
5. [ ] APK 공유(파일 전달) — 링크 배포 시 다운로드 후 '알 수 없는 앱 설치 허용' 필요 안내
