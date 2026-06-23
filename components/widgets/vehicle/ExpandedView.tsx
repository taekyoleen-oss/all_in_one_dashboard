"use client";

/**
 * vehicle · ExpandedView — full dashboard (차량 관리).
 *
 *  Stat cards (주행거리·평균/최근 연비·이번 달·누적 주유비), the renewal reminders with
 *  D-day, and recent fuel + maintenance history. Managing flows through the
 *  ConfigEditor (편집) per the frozen contract.
 */

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import {
  computeStats,
  sortedReminders,
  formatKrw,
  ddayLabel,
} from "./compute";
import type { VehicleConfig } from "./types";

const TONE: Record<string, string> = {
  ok: "text-muted-foreground",
  soon: "text-amber-600 dark:text-amber-400",
  overdue: "text-destructive",
};

function fmtDate(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "yyyy.MM.dd") : iso;
}

export function VehicleExpandedView({ config }: ExpandedViewProps<VehicleConfig>) {
  const now = useNow(3_600_000);
  const stats = computeStats(config, now);
  const reminders = sortedReminders(config, now);
  const recentFuel = [...config.fuelLogs].sort((a, b) => b.odo - a.odo).slice(0, 6);
  const recentMaint = [...config.maintLogs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-foreground">{config.name || "내 차"}</span>
        {config.plate ? (
          <span className="text-sm text-muted-foreground">{config.plate}</span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="주행거리" value={stats.odometer !== null ? `${stats.odometer.toLocaleString("ko-KR")}` : "—"} unit="km" />
        <Card label="평균 연비" value={stats.avgKmPerL !== null ? stats.avgKmPerL.toFixed(1) : "—"} unit="km/L" />
        <Card label="최근 연비" value={stats.recentKmPerL !== null ? stats.recentKmPerL.toFixed(1) : "—"} unit="km/L" />
        <Card label="이번 달 주유비" value={formatKrw(stats.monthFuelCost)} />
      </div>

      {reminders.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">갱신 만기</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reminders.map((r) => (
              <li
                key={r.reminder.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card/60 p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {r.reminder.label || "(항목 없음)"}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.text}</span>
                </div>
                <span className={`shrink-0 font-mono text-lg font-semibold tabular-nums ${TONE[r.tone]}`}>
                  {ddayLabel(r.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">최근 주유</h3>
          {recentFuel.length === 0 ? (
            <p className="text-xs text-muted-foreground">주유 기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-[var(--radius)] border border-border">
              {recentFuel.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{fmtDate(f.date)}</span>
                  <span className="text-foreground">{f.liters}L · {formatKrw(f.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">최근 정비·이벤트</h3>
          {recentMaint.length === 0 ? (
            <p className="text-xs text-muted-foreground">기록이 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-[var(--radius)] border border-border">
              {recentMaint.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">{m.label || "기록"}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {fmtDate(m.date)}
                    {m.odo !== undefined ? ` · ${m.odo.toLocaleString("ko-KR")}km` : ""}
                    {m.cost !== undefined ? ` · ${formatKrw(m.cost)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        기록 추가·수정은 위젯 메뉴의 “편집”에서 할 수 있습니다. 연비는 주유 간 주행거리÷주유량으로 계산됩니다.
      </p>
    </div>
  );
}

function Card({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius)] border border-border bg-card/60 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
      </span>
    </div>
  );
}

export default VehicleExpandedView;
