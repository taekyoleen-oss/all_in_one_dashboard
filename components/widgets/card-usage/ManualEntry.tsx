"use client";

/**
 * card-usage · ManualEntry — add one transaction by hand (설계서 §6.4 수기 입력).
 *
 *  Writes DIRECTLY to `pb_card_transactions` via the browser client (RLS-scoped).
 *  Computes the SAME `raw_hash` (일시|금액|가맹점) as the CSV/ingest paths via
 *  buildRawHash, and upserts on `unique(user_id, raw_hash)` with ignoreDuplicates
 *  so a hand-entered row that duplicates an SMS/CSV row is a no-op. source:'manual'.
 *  On success the form clears and `onChanged()` re-reads the snapshot.
 */

import * as React from "react";
import { PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildRawHash, guessCategory } from "@/lib/api/cardParser";
import type { Card } from "@/output/api-shapes";

/** Today as ISO yyyy-mm-dd (local), the default date for a new entry. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear().toString().padStart(4, "0")}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function ManualEntry({
  cards,
  onChanged,
}: {
  cards: Card[];
  onChanged: () => void;
}) {
  // The user's explicit pick (may be "" or stale if the card list changed).
  const [picked, setPicked] = React.useState<string>("");
  const [date, setDate] = React.useState<string>(todayIso());
  const [merchant, setMerchant] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  // Derive the EFFECTIVE selection during render (no setState-in-effect): the
  // user's pick if it still maps to a card, else the first card.
  const cardId =
    picked && cards.some((c) => c.id === picked) ? picked : cards[0]?.id ?? "";
  const setCardId = setPicked;

  const submit = async () => {
    const amt = Number(amount.replace(/[^\d.-]/g, ""));
    if (!cardId) {
      setMsg({ kind: "err", text: "카드를 먼저 등록하세요." });
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setMsg({ kind: "err", text: "날짜를 확인하세요." });
      return;
    }
    if (!Number.isFinite(amt) || amt === 0) {
      setMsg({ kind: "err", text: "금액을 입력하세요." });
      return;
    }
    setBusy(true);
    setMsg(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMsg({ kind: "err", text: "로그인이 필요합니다." });
      setBusy(false);
      return;
    }

    const merch = merchant.trim();
    const cat = category.trim() || guessCategory(merch || undefined);
    const raw_hash = buildRawHash(date, amt, merch);

    const { data, error } = await supabase
      .from("pb_card_transactions")
      .upsert(
        {
          user_id: user.id,
          card_id: cardId,
          txn_date: date,
          merchant: merch || null,
          amount: amt,
          category: cat,
          source: "manual",
          raw_hash,
        },
        { onConflict: "user_id,raw_hash", ignoreDuplicates: true },
      )
      .select("id");

    setBusy(false);
    if (error) {
      setMsg({ kind: "err", text: "저장하지 못했습니다." });
      return;
    }
    if (!data || data.length === 0) {
      setMsg({ kind: "err", text: "이미 동일한 거래가 있습니다 (중복)." });
      return;
    }
    setMerchant("");
    setAmount("");
    setCategory("");
    setMsg({ kind: "ok", text: "거래를 추가했습니다." });
    onChanged();
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <PlusCircle size={14} aria-hidden />
        수기 거래 입력
      </div>

      {cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          먼저 카드를 등록하면 거래를 입력할 수 있습니다.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
              카드
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
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              날짜
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              금액 (원)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder="12500"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              가맹점
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="스타벅스"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              카테고리 (선택)
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="자동 분류"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
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
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <PlusCircle size={15} aria-hidden />
            거래 추가
          </button>
        </>
      )}
    </div>
  );
}

export default ManualEntry;
