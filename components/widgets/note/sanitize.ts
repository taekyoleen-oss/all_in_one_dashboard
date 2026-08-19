/**
 * note · HTML sanitizer (allowlist) — defends the note body.
 *
 *  contentEditable + paste can bring arbitrary HTML (e.g. pasting from a web
 *  page). Before any note HTML is STORED or RENDERED we run it through this
 *  allowlist sanitizer: only known-safe tags/attributes survive, `on*` handlers
 *  and `javascript:`/`data:text-html` URLs are dropped, and `style` is filtered
 *  to a safe property allowlist. Runs in the browser via DOMParser.
 *
 *  This is intentionally conservative — it's a personal note tool, so we favor
 *  safety over preserving every exotic tag.
 */

// 상대경로 + .ts 확장자 — 별칭(@/)이면 node --test가 이 파일을 못 연다
// (lib/widgets/note/sanitize.test.ts가 소스를 직접 import한다).
import { findUrls, type FoundUrl } from "../shared/urls.ts";

/** Tags allowed in note HTML (everything else is unwrapped or dropped). */
const ALLOWED_TAGS = new Set([
  "p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike",
  "sub", "sup", "mark", "small", "font",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "pre", "code", "hr",
  "a", "img",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
]);

/** Tags whose entire subtree is removed (never just unwrapped). */
const FORBIDDEN_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "form",
  "input", "button", "textarea", "select", "option", "svg", "math", "base",
  "noscript", "template",
]);

/** Per-tag allowed attributes (besides the global `style`). */
const ALLOWED_ATTR: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "title"]),
  img: new Set(["src", "alt", "width", "height", "title"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  ol: new Set(["start", "type"]),
};

/** Safe CSS properties allowed inside a filtered `style` attribute. */
const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "background",
  "font-size", "font-weight", "font-style", "font-family",
  "text-decoration", "text-decoration-line", "text-align", "vertical-align",
  "border", "border-collapse", "border-color", "border-width", "border-style",
  "padding", "margin", "width", "height", "min-width", "max-width",
  "list-style-type", "line-height", "white-space",
]);

function isSafeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith("javascript:") || u.startsWith("vbscript:")) return false;
  // Allow data: images only (not data:text/html).
  if (u.startsWith("data:")) return u.startsWith("data:image/");
  return true;
}

function filterStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    const v = value.toLowerCase();
    // Drop any url()/expression()/javascript payloads.
    if (v.includes("url(") || v.includes("expression") || v.includes("javascript:")) {
      continue;
    }
    out.push(`${prop}: ${value}`);
  }
  return out.join("; ");
}

function cleanElement(el: Element): void {
  const tag = el.tagName.toLowerCase();

  // Remove all attributes that aren't explicitly allowed.
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name === "style") {
      const filtered = filterStyle(attr.value);
      if (filtered) el.setAttribute("style", filtered);
      else el.removeAttribute("style");
      continue;
    }
    const allowed = ALLOWED_ATTR[tag];
    if (!allowed || !allowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    // URL attributes: validate scheme.
    if ((name === "href" || name === "src") && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }

  // 링크는 항상 새 탭으로 — 대시보드(캔버스 상태)를 두고 떠나지 않게 한다.
  if (tag === "a" && el.getAttribute("href")) {
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
  }
  // Keep images responsive.
  if (tag === "img") {
    const style = el.getAttribute("style") ?? "";
    if (!/max-width/.test(style)) {
      el.setAttribute("style", `${style ? style + "; " : ""}max-width: 100%; height: auto`);
    }
  }
}

/** Recursively sanitize a node's children, unwrapping unknown tags. */
function walk(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (FORBIDDEN_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: keep the (sanitized) children, drop the tag itself.
        walk(el);
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        continue;
      }
      cleanElement(el);
      walk(el);
    } else if (
      child.nodeType !== Node.TEXT_NODE &&
      child.nodeType !== Node.CDATA_SECTION_NODE
    ) {
      // Comments / processing instructions → drop.
      child.parentNode?.removeChild(child);
    }
  }
}

/**
 * 평문으로 적힌 웹주소를 실제 링크(<a>)로 바꾼다.
 *
 *  이미 링크인 곳(a)과 코드 블록(code/pre)은 건드리지 않는다. 살균이 끝난 뒤에
 *  돌므로 여기서 만드는 <a>는 애초에 안전한 형태(http(s)만, 새 탭)다.
 *  ⚠ 저장 시점에는 돌리지 않는다(sanitizeHtml의 기본값) — 타이핑 도중의
 *    "https://exam" 같은 미완성 주소가 링크로 굳는 걸 막으려는 것. 화면에
 *    그릴 때와 편집기에 처음 넣을 때만 적용한다.
 */
function linkify(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Array<{ node: Text; urls: FoundUrl[] }> = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    if (node.parentElement?.closest("a, code, pre")) continue;
    const urls = findUrls(node.data);
    if (urls.length > 0) targets.push({ node, urls });
  }
  // 순회가 끝난 뒤에 교체 — 도는 중에 DOM을 바꾸면 walker가 어긋난다.
  for (const { node, urls } of targets) {
    const frag = doc.createDocumentFragment();
    let i = 0;
    for (const u of urls) {
      if (u.start > i) frag.append(doc.createTextNode(node.data.slice(i, u.start)));
      const a = doc.createElement("a");
      a.setAttribute("href", u.href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.textContent = u.text;
      frag.append(a);
      i = u.end;
    }
    if (i < node.data.length) frag.append(doc.createTextNode(node.data.slice(i)));
    node.replaceWith(frag);
  }
}

/**
 * Sanitize an HTML fragment string → safe HTML string. SSR-safe (returns "" off-DOM).
 *
 * `linkify: true` 면 평문 주소도 링크로 만든다 — 읽기 전용 렌더와 편집기 최초
 * 주입에서만 켠다(저장 경로는 끈 채로 둔다. linkify 주석 참고).
 */
export function sanitizeHtml(
  html: string,
  opts?: { linkify?: boolean },
): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // No DOM (SSR) — strip tags as a coarse fallback so nothing unsafe ships.
    return html.replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  walk(doc.body);
  if (opts?.linkify) linkify(doc.body);
  return doc.body.innerHTML;
}

/**
 * 내용이 사실상 비었는가 — 글자도, 이미지·표 같은 미디어도 없을 때 true.
 * (머리말을 삭제했는지 판단하는 데 쓴다: 빈 <p></p>만 남아도 '비었다'로 본다.)
 */
export function isBlankHtml(html: string): boolean {
  if (!html || !html.trim()) return true;
  // 글자가 없어도 이미지/표/구분선만 있으면 내용이 있는 것이다.
  if (/<(img|table|hr|iframe|video|audio)\b/i.test(html)) return false;
  return htmlToText(html) === "";
}

/** Plain-text preview (for empty checks / titles) from HTML. */
export function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
