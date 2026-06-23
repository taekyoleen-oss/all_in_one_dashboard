/**
 * vehicle widget — config shape (차량 관리: 주유·정비·갱신 만기).
 *
 *  All data lives in config (jsonb, like dday/subscriptions) — no external API,
 *  no new DB table. Tracks one vehicle's fuel logs (→ 연비), maintenance logs, and
 *  renewal reminders (보험만기·정기검사 → D-day). dataMode: 'static'.
 */

/** A single refuel record. */
export interface FuelLog {
  id: string;
  /** Date of the fill (ISO yyyy-MM-dd). */
  date: string;
  /** Odometer reading at the fill (km). */
  odo: number;
  /** Liters added. */
  liters: number;
  /** Total cost of the fill (KRW). */
  cost: number;
}

/** A maintenance / service record. */
export interface MaintLog {
  id: string;
  date: string;
  /** What was done, e.g. "엔진오일 교체". */
  label: string;
  /** Odometer at service (km), optional. */
  odo?: number;
  /** Cost (KRW), optional. */
  cost?: number;
}

/** A renewal reminder with a target date (보험만기/정기검사/세금 등). */
export interface Reminder {
  id: string;
  label: string;
  /** Target date (ISO yyyy-MM-dd). */
  date: string;
}

export interface VehicleConfig {
  /** Vehicle nickname, e.g. "아반떼". */
  name: string;
  /** Plate number (optional). */
  plate: string;
  fuelLogs: FuelLog[];
  maintLogs: MaintLog[];
  reminders: Reminder[];
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  name: "내 차",
  plate: "",
  fuelLogs: [],
  maintLogs: [],
  reminders: [],
};
