"use client";

/**
 * vehicle · CompactView — odometer + 연비 + 이번 달 주유비 + 다가오는 만기 (차량 관리).
 *
 *  Header stats (주행거리·최근연비), then upcoming renewal reminders with a D-day
 *  badge. 타일 하단 QuickAdd로 주유 1건(주행거리/리터/금액)을 바로 기록한다.
 */

import * as React from "react";
import { format } from "date-fns";
import { Car } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
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

export function VehicleCompactView({
  config,
  instanceId,
}: CompactViewProps<VehicleConfig>) {
  const now = useNow(3_600_000);
  const stats = computeStats(config, now);
  const reminders = sortedReminders(config, now);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Car size={13} aria-hidden className="shrink-0" />
        <span className="truncate font-medium text-foreground">{config.name || "내 차"}</span>
        {config.plate ? <span className="truncate">· {config.plate}</span> : null}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-1.5">
        <Stat
          label="주행거리"
          value={stats.odometer !== null ? `${stats.odometer.toLocaleString("ko-KR")} km` : "—"}
        />
        <Stat
          label="최근 연비"
          value={stats.recentKmPerL !== null ? `${stats.recentKmPerL.toFixed(1)} km/L` : "—"}
        />
      </div>
      <div className="shrink-0 text-[11px] text-muted-foreground">
        이번 달 주유비 {formatKrw(stats.monthFuelCost)}
      </div>

      {reminders.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-scroll">
          <ul className="my-auto flex flex-col gap-1">
            {reminders.map((r) => (
              <li key={r.reminder.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-foreground">
                  {r.reminder.label || "(항목 없음)"}
                </span>
                <span className={`shrink-0 font-mono text-xs font-semibold tabular-nums ${TONE[r.tone]}`}>
                  {ddayLabel(r.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <FuelQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md bg-muted/40 px-2 py-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function FuelQuickAdd({
  config,
  instanceId,
}: {
  config: VehicleConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [odo, setOdo] = React.useState("");
  const [liters, setLiters] = React.useState("");
  const [cost, setCost] = React.useState("");
  const add = () => {
    const o = Number(odo);
    const l = Number(liters);
    const c = Number(cost);
    if (!Number.isFinite(o) || o <= 0) return;
    save(instanceId, {
      ...config,
      fuelLogs: [
        ...config.fuelLogs,
        {
          id: newItemId("fuel"),
          date: format(new Date(), "yyyy-MM-dd"),
          odo: o,
          liters: Number.isFinite(l) ? l : 0,
          cost: Number.isFinite(c) ? c : 0,
        },
      ],
    });
    setOdo("");
    setLiters("");
    setCost("");
  };
  return (
    <QuickAdd label="주유 기록">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={odo}
            onChange={(e) => setOdo(e.target.value)}
            inputMode="numeric"
            placeholder="주행 km"
            className={`${quickInputClass} w-20`}
          />
          <input
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            inputMode="decimal"
            placeholder="L"
            className={`${quickInputClass} w-14`}
          />
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            inputMode="numeric"
            placeholder="₩"
            className={`${quickInputClass} w-20`}
          />
          <button type="submit" disabled={!odo} className={quickBtnClass}>
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default VehicleCompactView;
