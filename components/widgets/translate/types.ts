/**
 * translate widget — config shape (번역기).
 *
 *  Stores only the default source/target languages. Translations are on-demand
 *  (not poll); the input text is volatile UI state, not config. dataMode:'static'
 *  (no background polling — it fetches when you press 번역).
 */
export interface TranslateConfig {
  /** Source language ("auto" allowed). */
  source: string;
  /** Target language. */
  target: string;
}

export const DEFAULT_TRANSLATE_CONFIG: TranslateConfig = {
  source: "auto",
  target: "ko",
};
