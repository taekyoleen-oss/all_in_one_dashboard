"use client";

/**
 * card-usage · CardManager — register / edit / delete cards (pb_cards, 설계서 §2.1 #9, §5.2).
 *
 *  Writes DIRECTLY to `pb_cards` via the browser client (RLS-scoped to the
 *  signed-in user). LAST 4 DIGITS ONLY — the last4 input is hard-capped to 4
 *  digits and digit-filtered; a full card number can never be entered or stored
 *  (D5 guardrail). Each create/update/delete calls `onChanged()` so the parent
 *  re-reads the snapshot. Deleting a card cascades its transactions (FK on delete
 *  cascade), so a confirm is required.
 *
 *  This is a DATA editor (persists to Supabase immediately), distinct from the
 *  widget-config onChange (the card filter), which the parent owns.
 */

import * as React from "react";
import { Plus, Trash2, Save, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/output/api-shapes";

/** Draft for a new card (kept local until 추가). */
interface NewCardDraft {
  nickname: string;
  last4: string;
  issuer: string;
  billingDay: string;
  color: string;
}

const EMPTY_DRAFT: NewCardDraft = {
  nickname: "",
  last4: "",
  issuer: "",
  billingDay: "",
  color: "#0891B2",
};

/** Keep only digits, max 4 — enforces last4-only at the input boundary. */
function only4Digits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

/** Parse a 1–31 billing day, or null. */
function parseBillingDay(raw: string): number | null {
  const n = Number(raw.replace(/\D/g, ""));
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

export function CardManager({
  cards,
  onChanged,
}: {
  cards: Card[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState<NewCardDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const addCard = async () => {
    const nickname = draft.nickname.trim();
    if (!nickname) {
      setErr("카드 별칭을 입력하세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("로그인이 필요합니다.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("pb_cards").insert({
      user_id: user.id,
      nickname,
      last4: draft.last4 ? only4Digits(draft.last4) : null,
      issuer: draft.issuer.trim() || null,
      billing_day: parseBillingDay(draft.billingDay),
      color: draft.color || null,
    });
    setBusy(false);
    if (error) {
      setErr("카드를 추가하지 못했습니다.");
      return;
    }
    setDraft(EMPTY_DRAFT);
    onChanged();
  };

  const updateCard = async (id: string, fields: Partial<Card>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("pb_cards")
      .update({
        nickname: fields.nickname,
        last4: fields.last4 ? only4Digits(fields.last4) : null,
        issuer: fields.issuer ?? null,
        billing_day: fields.billing_day ?? null,
        color: fields.color ?? null,
      })
      .eq("id", id); // RLS restricts to the user's own row
    if (!error) onChanged();
  };

  const deleteCard = async (id: string, nickname: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`"${nickname}" 카드와 그 거래 내역을 모두 삭제할까요?`)
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("pb_cards").delete().eq("id", id);
    if (!error) onChanged();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* existing cards */}
      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <CardRow
            key={card.id}
            card={card}
            onSave={(fields) => updateCard(card.id, fields)}
            onDelete={() => deleteCard(card.id, card.nickname)}
          />
        ))}
        {cards.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            등록된 카드가 없습니다. 아래에서 추가하세요.
          </li>
        ) : null}
      </ul>

      {/* add a card */}
      <div className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CreditCard size={14} aria-hidden />
          카드 추가
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.nickname}
            onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
            placeholder="별칭 (예: 신한 더모아)"
            className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={draft.issuer}
            onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
            placeholder="카드사 (예: 신한)"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={draft.last4}
            onChange={(e) => setDraft({ ...draft, last4: only4Digits(e.target.value) })}
            inputMode="numeric"
            maxLength={4}
            placeholder="끝 4자리"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={draft.billingDay}
            onChange={(e) =>
              setDraft({ ...draft, billingDay: e.target.value.replace(/\D/g, "").slice(0, 2) })
            }
            inputMode="numeric"
            maxLength={2}
            placeholder="결제일 (1–31)"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            색상
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              className="size-7 cursor-pointer rounded border border-border bg-background"
              aria-label="카드 색상"
            />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          카드번호 전체는 저장하지 않습니다 — <strong>끝 4자리만</strong> 입력하세요.
        </p>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        <button
          type="button"
          onClick={addCard}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <Plus size={15} aria-hidden />
          카드 추가
        </button>
      </div>
    </div>
  );
}

/** One editable card row. Local draft committed on 저장. */
function CardRow({
  card,
  onSave,
  onDelete,
}: {
  card: Card;
  onSave: (fields: Partial<Card>) => void;
  onDelete: () => void;
}) {
  const [nickname, setNickname] = React.useState(card.nickname);
  const [last4, setLast4] = React.useState(card.last4 ?? "");
  const [issuer, setIssuer] = React.useState(card.issuer ?? "");
  const [billingDay, setBillingDay] = React.useState(
    card.billing_day != null ? String(card.billing_day) : "",
  );
  const [color, setColor] = React.useState(card.color ?? "#0891B2");

  const dirty =
    nickname !== card.nickname ||
    last4 !== (card.last4 ?? "") ||
    issuer !== (card.issuer ?? "") ||
    billingDay !== (card.billing_day != null ? String(card.billing_day) : "") ||
    color !== (card.color ?? "#0891B2");

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="별칭"
          className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="카드사"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="끝 4자리"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          maxLength={2}
          placeholder="결제일"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          색상
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-7 cursor-pointer rounded border border-border bg-background"
            aria-label={`${card.nickname} 색상`}
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              nickname: nickname.trim() || card.nickname,
              last4: last4 || null,
              issuer: issuer.trim() || null,
              billing_day:
                billingDay && Number(billingDay) >= 1 && Number(billingDay) <= 31
                  ? Number(billingDay)
                  : null,
              color,
            })
          }
          disabled={!dirty}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <Save size={13} aria-hidden />
          저장
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${card.nickname} 삭제`}
          className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}

export default CardManager;
