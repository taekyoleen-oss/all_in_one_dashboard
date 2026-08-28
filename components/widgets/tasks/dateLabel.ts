/**
 * 작업 일자 표시 규칙(요구, 웹·안드로이드 공통 — TasksWidget.kt에 동일 로직 미러):
 *  - 다른 연도            → "2027.1.5"
 *  - 같은 연도, 다른 월    → "9.15"  (월일만)
 *  - 같은 연도·같은 월     → "15일"  (일자만)
 * 잘못된 값·미입력은 빈 문자열.
 */
export function taskDateLabel(dueOn: string | null | undefined, today: Date): string {
  if (!dueOn) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueOn);
  if (!m) return "";
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (year !== today.getFullYear()) return `${year}.${month}.${day}`;
  if (month !== today.getMonth() + 1) return `${month}.${day}`;
  return `${day}일`;
}
