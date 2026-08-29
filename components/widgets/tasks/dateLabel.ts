/**
 * 작업 일자 표시 규칙(요구, 웹·안드로이드 공통 — TasksWidget.kt에 동일 로직 미러):
 *  - 다른 연도            → "2027.1.5 (화)"
 *  - 같은 연도, 다른 월    → "9.15 (화)"  (월일만)
 *  - 같은 연도·같은 월     → "15일 (화)"  (일자만)
 * 요일은 항상 괄호로 병기한다(요구). 잘못된 값·미입력은 빈 문자열.
 */
const KOR_DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function taskDateLabel(dueOn: string | null | undefined, today: Date): string {
  if (!dueOn) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueOn);
  if (!m) return "";
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const dow = KOR_DOW[new Date(year, month - 1, day).getDay()];
  const base =
    year !== today.getFullYear()
      ? `${year}.${month}.${day}`
      : month !== today.getMonth() + 1
        ? `${month}.${day}`
        : `${day}일`;
  return `${base} (${dow})`;
}
