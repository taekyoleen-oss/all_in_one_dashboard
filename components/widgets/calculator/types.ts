/**
 * calculator widget — config shape (설계서 §2.1 #8: "(설정 없음) 표시 밀도").
 *
 *  The calculator has no functional config; only a display density preference.
 *  dataMode: 'static'. copyBehavior: 'custom' (copies the last result string).
 */
export interface CalculatorConfig {
  /** Display density for the keypad/readout. */
  display: "compact" | "comfortable";
}

export const DEFAULT_CALCULATOR_CONFIG: CalculatorConfig = {
  display: "comfortable",
};
