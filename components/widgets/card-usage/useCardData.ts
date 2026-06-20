"use client";

/**
 * useCardData — read this user's cards + card transactions via the BROWSER
 * Supabase client (RLS-scoped) and expose them for client-side aggregation
 * (설계서 §2.1 #9, dataMode:'static' — a read-only snapshot).
 *
 *  No server route is involved: RLS restricts the browser client to the signed-in
 *  user's own rows (`user_id = auth.uid()`), so the widget reads `pb_cards` and
 *  `pb_card_transactions` directly and aggregates with summarize(). Rows are
 *  validated against the shared schemas in output/api-shapes.ts (CardSchema /
 *  CardTxnSchema) — the types are IMPORTED, never re-declared.
 *
 *  The fetch runs in an effect (React-19-safe: no synchronous setState in render,
 *  same shape as useStockQuotes/usePoll). A `refresh()` re-runs it after a write
 *  (e.g. CSV import or a manual entry committed from the ConfigEditor). Because
 *  dataMode is 'static' there is no polling — the snapshot refreshes on mount and
 *  on demand.
 *
 *  PRIVACY: card data is never logged; only last4 is ever present on a card.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CardSchema,
  CardTxnSchema,
  type Card,
  type CardTxn,
} from "@/output/api-shapes";

export type CardDataStatus = "loading" | "ready" | "error" | "signed-out";

export interface CardData {
  cards: Card[];
  txns: CardTxn[];
  status: CardDataStatus;
  /** Re-fetch (after a write). */
  refresh: () => void;
}

/** How many recent transactions to pull (the widget aggregates; a cap is plenty). */
const TXN_LIMIT = 2000;

export function useCardData(): CardData {
  const [cards, setCards] = React.useState<Card[]>([]);
  const [txns, setTxns] = React.useState<CardTxn[]>([]);
  const [status, setStatus] = React.useState<CardDataStatus>("loading");
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const load = async () => {
      // All state changes below are in response to the async query result, not a
      // synchronous render — the React-19-safe pattern.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setStatus("signed-out");
        return;
      }

      const [cardsRes, txnsRes] = await Promise.all([
        supabase
          .from("pb_cards")
          .select("id, user_id, nickname, last4, issuer, billing_day, color")
          .order("nickname", { ascending: true }),
        supabase
          .from("pb_card_transactions")
          .select(
            "id, card_id, user_id, txn_date, merchant, amount, category, source, raw_hash",
          )
          .order("txn_date", { ascending: false })
          .limit(TXN_LIMIT),
      ]);
      if (cancelled) return;

      if (cardsRes.error || txnsRes.error) {
        setStatus("error");
        return;
      }

      // Defensive validation (drops a malformed row rather than crashing).
      const parsedCards: Card[] = [];
      for (const r of cardsRes.data ?? []) {
        const p = CardSchema.safeParse(r);
        if (p.success) parsedCards.push(p.data);
      }
      const parsedTxns: CardTxn[] = [];
      for (const r of txnsRes.data ?? []) {
        const p = CardTxnSchema.safeParse(r);
        if (p.success) parsedTxns.push(p.data);
      }

      setCards(parsedCards);
      setTxns(parsedTxns);
      setStatus("ready");
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { cards, txns, status, refresh };
}

export default useCardData;
