/**
 * news widget — small formatting helpers (설계서 §2.2).
 *
 *  `publishedAt` is epoch ms or null (the server couldn't parse a date). We show
 *  a compact relative time ("3분 전", "2시간 전", "어제") so a headline list reads
 *  at a glance, falling back to an absolute date for older items.
 */

/** Compact Korean relative time from an epoch-ms timestamp (null → ""). */
export function relativeTime(publishedAt: number | null): string {
  if (publishedAt === null) return "";
  const diffMs = Date.now() - publishedAt;
  if (!Number.isFinite(diffMs)) return "";
  if (diffMs < 0) return "방금";

  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;

  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;

  return new Date(publishedAt).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}
