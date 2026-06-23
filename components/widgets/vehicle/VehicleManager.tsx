"use client";

/**
 * vehicle · VehicleManager — edit vehicle, fuel logs, maintenance, reminders.
 *
 *  Controlled: reports the whole next config via onChange (parent persists). Four
 *  sections, each with add/remove. Kept compact with small inline inputs.
 */

import * as React from "react";
import { format } from "date-fns";
import { Trash2, Plus } from "lucide-react";
import { newItemId } from "@/components/widgets/shared/QuickAdd";
import type {
  VehicleConfig,
  FuelLog,
  MaintLog,
  Reminder,
} from "./types";

const inputCls =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const today = () => format(new Date(), "yyyy-MM-dd");

export function VehicleManager({
  config,
  onChange,
}: {
  config: VehicleConfig;
  onChange: (next: VehicleConfig) => void;
}) {
  const set = (fields: Partial<VehicleConfig>) => onChange({ ...config, ...fields });

  return (
    <div className="flex flex-col gap-4">
      {/* Vehicle identity */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">차량 정보</legend>
        <div className="flex gap-2">
          <input
            value={config.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="차량 이름 (예: 아반떼)"
            className={`${inputCls} flex-1`}
          />
          <input
            value={config.plate}
            onChange={(e) => set({ plate: e.target.value })}
            placeholder="번호판 (선택)"
            className={`${inputCls} w-32`}
          />
        </div>
      </fieldset>

      {/* Fuel logs */}
      <Section
        title="주유 기록 (연비 자동 계산)"
        items={config.fuelLogs}
        onAdd={() =>
          set({
            fuelLogs: [
              ...config.fuelLogs,
              { id: newItemId("fuel"), date: today(), odo: 0, liters: 0, cost: 0 },
            ],
          })
        }
        addLabel="주유 추가"
        renderItem={(f) => (
          <FuelRow
            key={f.id}
            log={f}
            onChange={(next) =>
              set({
                fuelLogs: config.fuelLogs.map((x) => (x.id === f.id ? next : x)),
              })
            }
            onRemove={() =>
              set({ fuelLogs: config.fuelLogs.filter((x) => x.id !== f.id) })
            }
          />
        )}
        emptyText="주유 기록이 없습니다."
      />

      {/* Maintenance */}
      <Section
        title="정비 기록"
        items={config.maintLogs}
        onAdd={() =>
          set({
            maintLogs: [
              ...config.maintLogs,
              { id: newItemId("maint"), date: today(), label: "", odo: undefined, cost: undefined },
            ],
          })
        }
        addLabel="정비 추가"
        renderItem={(m) => (
          <MaintRow
            key={m.id}
            log={m}
            onChange={(next) =>
              set({
                maintLogs: config.maintLogs.map((x) => (x.id === m.id ? next : x)),
              })
            }
            onRemove={() =>
              set({ maintLogs: config.maintLogs.filter((x) => x.id !== m.id) })
            }
          />
        )}
        emptyText="정비 기록이 없습니다."
      />

      {/* Reminders */}
      <Section
        title="갱신 만기 (보험·검사·세금 → D-day)"
        items={config.reminders}
        onAdd={() =>
          set({
            reminders: [
              ...config.reminders,
              { id: newItemId("rem"), label: "", date: today() },
            ],
          })
        }
        addLabel="만기 추가"
        renderItem={(r) => (
          <ReminderRow
            key={r.id}
            reminder={r}
            onChange={(next) =>
              set({
                reminders: config.reminders.map((x) => (x.id === r.id ? next : x)),
              })
            }
            onRemove={() =>
              set({ reminders: config.reminders.filter((x) => x.id !== r.id) })
            }
          />
        )}
        emptyText="등록된 만기가 없습니다."
      />
    </div>
  );
}

function Section<T extends { id: string }>({
  title,
  items,
  onAdd,
  addLabel,
  renderItem,
  emptyText,
}: {
  title: string;
  items: T[];
  onAdd: () => void;
  addLabel: string;
  renderItem: (item: T) => React.ReactNode;
  emptyText: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{title}</legend>
      <ul className="flex flex-col gap-2">
        {items.map(renderItem)}
        {items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-2 text-center text-xs text-muted-foreground">
            {emptyText}
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        {addLabel}
      </button>
    </fieldset>
  );
}

function RemoveBtn({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onRemove}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Trash2 size={15} />
    </button>
  );
}

function FuelRow({
  log,
  onChange,
  onRemove,
}: {
  log: FuelLog;
  onChange: (next: FuelLog) => void;
  onRemove: () => void;
}) {
  const num = (v: string) => Number(v) || 0;
  return (
    <li className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/40 p-2">
      <input
        type="date"
        value={log.date}
        onChange={(e) => onChange({ ...log, date: e.target.value })}
        aria-label="주유 날짜"
        className={inputCls}
      />
      <input
        type="number"
        value={log.odo === 0 ? "" : log.odo}
        onChange={(e) => onChange({ ...log, odo: num(e.target.value) })}
        placeholder="주행거리 km"
        className={`${inputCls} w-28`}
      />
      <input
        type="number"
        value={log.liters === 0 ? "" : log.liters}
        onChange={(e) => onChange({ ...log, liters: num(e.target.value) })}
        placeholder="리터 L"
        className={`${inputCls} w-20`}
      />
      <input
        type="number"
        value={log.cost === 0 ? "" : log.cost}
        onChange={(e) => onChange({ ...log, cost: num(e.target.value) })}
        placeholder="금액 ₩"
        className={`${inputCls} w-24`}
      />
      <RemoveBtn onRemove={onRemove} label="주유 기록 삭제" />
    </li>
  );
}

function MaintRow({
  log,
  onChange,
  onRemove,
}: {
  log: MaintLog;
  onChange: (next: MaintLog) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/40 p-2">
      <input
        type="date"
        value={log.date}
        onChange={(e) => onChange({ ...log, date: e.target.value })}
        aria-label="정비 날짜"
        className={inputCls}
      />
      <input
        value={log.label}
        onChange={(e) => onChange({ ...log, label: e.target.value })}
        placeholder="내용 (예: 엔진오일)"
        className={`${inputCls} flex-1`}
      />
      <input
        type="number"
        value={log.cost ?? ""}
        onChange={(e) =>
          onChange({ ...log, cost: e.target.value === "" ? undefined : Number(e.target.value) })
        }
        placeholder="금액 ₩"
        className={`${inputCls} w-24`}
      />
      <RemoveBtn onRemove={onRemove} label="정비 기록 삭제" />
    </li>
  );
}

function ReminderRow({
  reminder,
  onChange,
  onRemove,
}: {
  reminder: Reminder;
  onChange: (next: Reminder) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/40 p-2">
      <input
        value={reminder.label}
        onChange={(e) => onChange({ ...reminder, label: e.target.value })}
        placeholder="항목 (예: 자동차 보험 만기)"
        className={`${inputCls} flex-1`}
      />
      <input
        type="date"
        value={reminder.date}
        onChange={(e) => onChange({ ...reminder, date: e.target.value })}
        aria-label="만기 날짜"
        className={inputCls}
      />
      <RemoveBtn onRemove={onRemove} label="만기 삭제" />
    </li>
  );
}

export default VehicleManager;
