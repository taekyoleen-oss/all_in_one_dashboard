/**
 * translate · language catalog (번역기).
 *
 *  A compact set of common languages (ISO 639-1 codes the providers accept).
 *  "auto" is offered only as a SOURCE option (detect).
 */

export interface Lang {
  code: string;
  label: string;
}

/** Selectable target languages. */
export const LANGS: Lang[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "영어" },
  { code: "ja", label: "일본어" },
  { code: "zh", label: "중국어(간체)" },
  { code: "zh-TW", label: "중국어(번체)" },
  { code: "es", label: "스페인어" },
  { code: "fr", label: "프랑스어" },
  { code: "de", label: "독일어" },
  { code: "ru", label: "러시아어" },
  { code: "vi", label: "베트남어" },
  { code: "th", label: "태국어" },
  { code: "id", label: "인도네시아어" },
  { code: "it", label: "이탈리아어" },
  { code: "pt", label: "포르투갈어" },
  { code: "ar", label: "아랍어" },
];

/** Source options = "auto" (자동 감지) + all target languages. */
export const SOURCE_LANGS: Lang[] = [{ code: "auto", label: "자동 감지" }, ...LANGS];

export function langLabel(code: string): string {
  if (code === "auto") return "자동 감지";
  return LANGS.find((l) => l.code === code)?.label ?? code;
}
