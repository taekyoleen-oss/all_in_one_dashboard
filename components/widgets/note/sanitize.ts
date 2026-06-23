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

  // Harden links opened in a new tab.
  if (tag === "a" && el.getAttribute("target") === "_blank") {
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

/** Sanitize an HTML fragment string → safe HTML string. SSR-safe (returns "" off-DOM). */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // No DOM (SSR) — strip tags as a coarse fallback so nothing unsafe ships.
    return html.replace(/<[^>]*>/g, "");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  walk(doc.body);
  return doc.body.innerHTML;
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
