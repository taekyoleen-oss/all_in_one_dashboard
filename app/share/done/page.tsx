/**
 * /share/done — confirmation screen after a mobile share was routed into a note.
 *
 *  The /share Route Handler does the work (auth + append + persist) and redirects
 *  here with `?status=…` (+ the note `title` on success). This page is PURE — it
 *  only reads the status and renders a friendly result with a link back to the
 *  dashboard. Next 16: `searchParams` is a Promise and must be awaited.
 */

import Link from "next/link";
import { CheckCircle2, AlertCircle, Inbox } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

type ResultKey = "ok" | "empty" | "nonote" | "error";

const RESULTS: Record<
  ResultKey,
  { icon: typeof CheckCircle2; tone: string; heading: string; body: string }
> = {
  ok: {
    icon: CheckCircle2,
    tone: "text-primary",
    heading: "노트에 저장했어요",
    body: "공유한 내용이 ‘공유 받기’ 노트에 추가되었습니다.",
  },
  empty: {
    icon: Inbox,
    tone: "text-muted-foreground",
    heading: "저장할 내용이 없어요",
    body: "공유된 제목·텍스트·링크가 비어 있어 저장하지 않았습니다.",
  },
  nonote: {
    icon: AlertCircle,
    tone: "text-destructive",
    heading: "받을 노트가 없어요",
    body: "먼저 노트 위젯을 추가하면 공유 내용을 저장할 수 있습니다.",
  },
  error: {
    icon: AlertCircle,
    tone: "text-destructive",
    heading: "저장하지 못했어요",
    body: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

export default async function ShareDonePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; title?: string }>;
}) {
  const { status, title } = await searchParams;
  const key: ResultKey =
    status === "ok" || status === "empty" || status === "nonote" || status === "error"
      ? status
      : "error";
  const r = RESULTS[key];
  const Icon = r.icon;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <BrandMark height={28} className="text-foreground" />

      <div className="flex flex-col items-center gap-3">
        <Icon size={48} aria-hidden className={r.tone} />
        <h1 className="text-lg font-semibold text-foreground">{r.heading}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{r.body}</p>
        {key === "ok" && title ? (
          <p className="text-sm font-medium text-foreground">
            대상 노트: <span className="text-primary">{title}</span>
          </p>
        ) : null}
      </div>

      <Link
        href="/"
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        대시보드로 가기
      </Link>
    </main>
  );
}
