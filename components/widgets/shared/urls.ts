/**
 * 텍스트 속 웹주소 찾기 — 노트(자동 링크)와 메모(링크 칩)가 함께 쓴다.
 *
 *  순수 함수라 브라우저 없이도 테스트된다(lib/widgets/shared/urls.test.ts).
 *  주소로 인정하는 범위는 좁게 잡았다: `http(s)://…` 와 `www.…` 만, 그리고
 *  ASCII 문자만. 한글·괄호·따옴표는 애초에 매칭에서 빠지므로 "https://a.com를
 *  보세요" 같은 문장에서도 조사가 주소에 딸려 들어가지 않는다.
 */

/** 주소에 쓰이는 ASCII 문자만 — 괄호·따옴표·한글은 제외(문장에서 자연히 끊긴다). */
const URL_RE = /\b(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#@!$&*+,;=%]+/g;

export interface FoundUrl {
  /** 원본 문자열에서의 시작/끝 인덱스(끝 = 문장부호를 뺀 위치). */
  start: number;
  end: number;
  /** 화면에 보이는 그대로의 주소 문자열. */
  text: string;
  /** 실제로 여는 주소(www.… 는 https:// 를 붙인다). */
  href: string;
}

/** 문자열에서 웹주소를 찾아 위치와 함께 돌려준다(없으면 빈 배열). */
export function findUrls(s: string): FoundUrl[] {
  const out: FoundUrl[] = [];
  for (const m of s.matchAll(URL_RE)) {
    // 문장 끝 부호는 주소가 아니다: "…참고 https://a.com," → https://a.com
    const text = m[0].replace(/[.,;:!?]+$/, "");
    const host = text.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
    // 점 없는 호스트(https://, http://localhost)는 링크로 보지 않는다.
    if (!host.includes(".") || host.endsWith(".")) continue;
    const start = m.index ?? 0;
    out.push({
      start,
      end: start + text.length,
      text,
      href: /^https?:\/\//i.test(text) ? text : `https://${text}`,
    });
  }
  return out;
}

/** 링크 라벨용 호스트 이름(www. 제거) — 어느 사이트인지 한눈에 식별하려고. */
export function urlHost(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./i, "");
  } catch {
    return href;
  }
}
