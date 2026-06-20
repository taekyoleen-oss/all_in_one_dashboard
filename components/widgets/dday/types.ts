/**
 * dday widget — config shape (설계서 §2.2: 다중 D-Day, Supabase config).
 *
 *  Each entry targets a date (ISO yyyy-MM-dd). `repeatYearly` makes it an annual
 *  anniversary (the countdown always points at the next occurrence). All views
 *  compute from this config with date-fns. dataMode: 'static'.
 */
export interface DDayEntry {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Display label, e.g. "프로젝트 마감". */
  label: string;
  /** Target date as ISO "yyyy-MM-dd". */
  date: string;
  /** When true, recur every year (anniversary). */
  repeatYearly: boolean;
}

export interface DDayConfig {
  entries: DDayEntry[];
}

export const DEFAULT_DDAY_CONFIG: DDayConfig = {
  entries: [
    { id: "newyear", label: "새해", date: "2027-01-01", repeatYearly: true },
  ],
};
