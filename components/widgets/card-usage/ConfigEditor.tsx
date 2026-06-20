"use client";

/**
 * card-usage · ConfigEditor — the control center (설계서 §2.1 #9, §6.4).
 *
 *  Composes four DATA panels that write directly to Supabase (RLS-scoped via the
 *  browser client) + the widget-config controls the parent persists via onChange:
 *    ① CardManager   — register / edit / delete cards (pb_cards, last4-only)
 *    ② ManualEntry   — add a transaction by hand (pb_card_transactions)
 *    ③ ImportPanel   — CSV upload → /api/cards/import
 *    ④ IngestSettings— mint/show the per-user ingest token + Android guide
 *  …plus a display section: which cards to include in the summary (config.cardIds)
 *  and how many months the trend spans (config.trendMonths).
 *
 *  Two persistence lanes, deliberately separate:
 *   • DATA (cards/txns/token) → Supabase immediately (the panels own this).
 *   • WIDGET CONFIG (filter/trend) → onChange, the parent persists to pb_widgets.
 *
 *  The card list is read via useCardData; a write in any panel calls refresh() so
 *  every panel + the filter list stay in sync within the dialog.
 */

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useCardData } from "./useCardData";
import { CardManager } from "./CardManager";
import { ManualEntry } from "./ManualEntry";
import { ImportPanel } from "./ImportPanel";
import { IngestSettings } from "./IngestSettings";
import { cardLabel } from "./cardLabel";
import type { CardUsageConfig } from "./types";

/** A collapsible-free section heading (kept simple; the dialog scrolls). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function CardUsageConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<CardUsageConfig>) {
  const { cards, status, refresh } = useCardData();

  const toggleCard = (id: string) => {
    const set = new Set(config.cardIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...config, cardIds: [...set] });
  };

  const setTrendMonths = (n: number) => {
    const clamped = Math.min(12, Math.max(3, n));
    onChange({ ...config, trendMonths: clamped });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ① card CRUD */}
      <Section title="① 카드 관리">
        <CardManager cards={cards} onChanged={refresh} />
      </Section>

      {/* ② manual entry */}
      <Section title="② 수기 거래 입력">
        <ManualEntry cards={cards} onChanged={refresh} />
      </Section>

      {/* ③ CSV import */}
      <Section title="③ CSV 가져오기">
        <ImportPanel cards={cards} onChanged={refresh} />
      </Section>

      {/* ④ ingest settings */}
      <Section title="④ SMS/이메일 인제스트">
        <IngestSettings />
      </Section>

      {/* display preferences (widget config) */}
      <Section title="표시 설정">
        <div className="flex flex-col gap-3 rounded-md border border-border bg-background/40 p-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal size={14} aria-hidden />
            요약에 포함할 카드
          </div>
          {status === "ready" && cards.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {cards.map((c) => {
                const checked =
                  config.cardIds.length === 0 || config.cardIds.includes(c.id);
                const allMode = config.cardIds.length === 0;
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={allMode}
                        onChange={() => toggleCard(c.id)}
                        className="size-4 accent-[var(--primary)] disabled:opacity-50"
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: c.color ?? "var(--muted-foreground)" }}
                      />
                      <span className="truncate">{cardLabel(c)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {cards.length === 0 ? "등록된 카드가 없습니다." : "불러오는 중…"}
            </p>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={config.cardIds.length === 0}
              onChange={(e) =>
                onChange({
                  ...config,
                  cardIds: e.target.checked ? [] : cards.map((c) => c.id),
                })
              }
              className="size-4 accent-[var(--primary)]"
            />
            전체 카드 합산
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            추이 기간 (개월): {config.trendMonths}
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={config.trendMonths}
              onChange={(e) => setTrendMonths(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </label>
        </div>
      </Section>
    </div>
  );
}

export default CardUsageConfigEditor;
