"use client";

/**
 * card-usage · ImportPanel — CSV upload → POST /api/cards/import (설계서 §6.4).
 *
 *  Picks the target card + a CSV file and POSTs it (multipart) to the
 *  session-authenticated import route, which parses + RLS-inserts the rows with
 *  raw_hash dedup and returns inserted/skipped counts (validated against
 *  CardImportResponseSchema from output/api-shapes.ts — imported, not re-declared).
 *  On success `onChanged()` re-reads the snapshot.
 */

import * as React from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { CardImportResponseSchema, type Card } from "@/output/api-shapes";

export function ImportPanel({
  cards,
  onChanged,
}: {
  cards: Card[];
  onChanged: () => void;
}) {
  // The user's explicit pick (may be "" or stale if cards changed).
  const [picked, setPicked] = React.useState<string>("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Derive the EFFECTIVE selection during render (no setState-in-effect): the
  // user's pick if it still maps to a card, else the first card.
  const cardId =
    picked && cards.some((c) => c.id === picked) ? picked : cards[0]?.id ?? "";
  const setCardId = setPicked;

  const upload = async () => {
    if (!cardId) {
      setMsg({ kind: "err", text: "카드를 먼저 등록하세요." });
      return;
    }
    if (!file) {
      setMsg({ kind: "err", text: "CSV 파일을 선택하세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("card_id", cardId);
      const res = await fetch("/api/cards/import", {
        method: "POST",
        body: form,
      });
      const json: unknown = await res.json();
      const parsed = CardImportResponseSchema.safeParse(json);
      if (!res.ok || !parsed.success || !parsed.data.ok) {
        setMsg({ kind: "err", text: "가져오기에 실패했습니다. 파일 형식을 확인하세요." });
        setBusy(false);
        return;
      }
      const { inserted, skipped, total } = parsed.data;
      setMsg({
        kind: "ok",
        text: `총 ${total}건 중 ${inserted}건 추가, ${skipped}건 건너뜀(중복/형식).`,
      });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      if (inserted > 0) onChanged();
    } catch {
      setMsg({ kind: "err", text: "업로드 중 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileSpreadsheet size={14} aria-hidden />
        CSV 가져오기
      </div>
      <p className="text-[11px] text-muted-foreground">
        카드사 이용내역 CSV를 업로드하세요. 컬럼(이용일·가맹점·금액)을 자동 인식하고,
        중복 거래는 자동으로 제외합니다.
      </p>

      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">먼저 카드를 등록하세요.</p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            대상 카드
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                  {c.last4 ? ` (••${c.last4})` : ""}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:text-foreground hover:file:bg-accent/40"
          />
          {msg ? (
            <p
              className={[
                "text-xs",
                msg.kind === "ok" ? "text-emerald-600" : "text-destructive",
              ].join(" ")}
            >
              {msg.text}
            </p>
          ) : null}
          <button
            type="button"
            onClick={upload}
            disabled={busy || !file}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <Upload size={15} aria-hidden />
            {busy ? "가져오는 중…" : "업로드"}
          </button>
        </>
      )}
    </div>
  );
}

export default ImportPanel;
