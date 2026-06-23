/**
 * note · rich-text command engine (contentEditable).
 *
 *  Thin wrappers over the (legacy but universally supported) execCommand API plus
 *  Selection/Range helpers for the things execCommand does poorly: precise font
 *  sizes (px), table insertion, and table row/column editing. All operations act
 *  on the currently-focused editor element; callers focus it first.
 *
 *  Why execCommand: it handles bold/italic/underline/strike/color/lists/align/
 *  blocks across partial multi-node selections correctly and with native undo —
 *  reimplementing that on raw Ranges is far more error-prone. It's deprecated but
 *  not going away, and this is a personal note tool.
 */

/** Turn on CSS styling mode so marks emit <span style> (not legacy tags). */
export function enableCssStyling(): void {
  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    /* ignore */
  }
}

/** Run a basic execCommand. */
export function exec(command: string, value?: string): void {
  try {
    document.execCommand(command, false, value);
  } catch {
    /* ignore */
  }
}

export function toggleBold() { exec("bold"); }
export function toggleItalic() { exec("italic"); }
export function toggleUnderline() { exec("underline"); }
export function toggleStrike() { exec("strikeThrough"); }
export function bulletList() { exec("insertUnorderedList"); }
export function numberList() { exec("insertOrderedList"); }
export function alignLeft() { exec("justifyLeft"); }
export function alignCenter() { exec("justifyCenter"); }
export function alignRight() { exec("justifyRight"); }
export function clearFormat() { exec("removeFormat"); }
export function undo() { exec("undo"); }
export function redo() { exec("redo"); }
export function outdent() { exec("outdent"); }
export function indent() { exec("indent"); }

export function setForeColor(color: string) {
  enableCssStyling();
  exec("foreColor", color);
}

export function setHiliteColor(color: string) {
  enableCssStyling();
  // hiliteColor is the spec name; backColor is the WebKit fallback.
  document.execCommand("hiliteColor", false, color) ||
    document.execCommand("backColor", false, color);
}

/** Format the current block as a heading/paragraph/quote/code. */
export function formatBlock(tag: "P" | "H1" | "H2" | "H3" | "BLOCKQUOTE" | "PRE") {
  // Some engines want the tag wrapped in <>.
  exec("formatBlock", `<${tag}>`);
}

/**
 * Apply a precise font size (px) to the selection. execCommand('fontSize') only
 * supports the legacy 1–7 scale, so we apply size 7 then rewrite the freshly
 * created <font size="7"> elements to a px style — robust across multi-node
 * selections.
 */
export function applyFontSize(editor: HTMLElement, px: number): void {
  exec("fontSize", "7");
  const fonts = editor.querySelectorAll('font[size="7"]');
  fonts.forEach((f) => {
    f.removeAttribute("size");
    (f as HTMLElement).style.fontSize = `${px}px`;
  });
}

/** Insert sanitized HTML at the caret. */
export function insertHtml(html: string): void {
  exec("insertHTML", html);
}

/** Insert an image (data URL) inline, responsive. */
export function insertImage(dataUrl: string): void {
  insertHtml(
    `<img src="${dataUrl}" alt="" style="max-width:100%;height:auto;border-radius:6px" />`,
  );
}

/** Insert a link around the selection (or as text if nothing selected). */
export function insertLink(url: string): void {
  enableCssStyling();
  exec("createLink", url);
}

/* --------------------------------- tables --------------------------------- */

const CELL_STYLE =
  "border:1px solid var(--border);padding:6px 10px;min-width:48px;vertical-align:top";
const TABLE_STYLE =
  "border-collapse:collapse;width:100%;margin:8px 0;font-size:inherit";

/** Build + insert an R×C table at the caret (header row + body). */
export function insertTable(rows: number, cols: number): void {
  const r = Math.max(1, Math.min(20, Math.floor(rows)));
  const c = Math.max(1, Math.min(12, Math.floor(cols)));
  let html = `<table style="${TABLE_STYLE}"><tbody>`;
  for (let i = 0; i < r; i++) {
    html += "<tr>";
    for (let j = 0; j < c; j++) {
      const cell = i === 0 ? "th" : "td";
      const extra = i === 0 ? ";background:color-mix(in oklab,var(--muted) 70%,transparent);font-weight:600" : "";
      html += `<${cell} style="${CELL_STYLE}${extra}"><br/></${cell}>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table><p><br/></p>";
  insertHtml(html);
}

/** The <td>/<th> containing the current selection, scoped to `editor`. */
function caretCell(editor: HTMLElement): HTMLTableCellElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tag === "TD" || tag === "TH") return node as HTMLTableCellElement;
    }
    node = node.parentNode;
  }
  return null;
}

function caretTable(editor: HTMLElement): HTMLTableElement | null {
  const cell = caretCell(editor);
  return cell ? cell.closest("table") : null;
}

/** True when the caret is inside a table within the editor. */
export function isInTable(editor: HTMLElement): boolean {
  return caretTable(editor) !== null;
}

function newCell(like: HTMLTableCellElement): HTMLTableCellElement {
  const cell = document.createElement(like.tagName.toLowerCase()) as HTMLTableCellElement;
  cell.setAttribute("style", like.getAttribute("style") ?? CELL_STYLE);
  cell.innerHTML = "<br/>";
  return cell;
}

/** Insert a row below the caret's row. */
export function tableAddRow(editor: HTMLElement): void {
  const cell = caretCell(editor);
  const row = cell?.parentElement as HTMLTableRowElement | undefined;
  if (!cell || !row) return;
  const newRow = document.createElement("tr");
  for (const c of Array.from(row.cells)) {
    const nc = document.createElement("td") as HTMLTableCellElement;
    nc.setAttribute("style", (c.getAttribute("style") ?? CELL_STYLE).replace(/;background[^;]*/g, "").replace(/;font-weight[^;]*/g, ""));
    nc.innerHTML = "<br/>";
    newRow.appendChild(nc);
  }
  row.after(newRow);
}

/** Add a column to the right of the caret's column (every row). */
export function tableAddColumn(editor: HTMLElement): void {
  const cell = caretCell(editor);
  const table = caretTable(editor);
  if (!cell || !table) return;
  const colIndex = cell.cellIndex;
  for (const row of Array.from(table.rows)) {
    const ref = row.cells[colIndex] ?? row.cells[row.cells.length - 1];
    if (ref) ref.after(newCell(ref));
  }
}

/** Delete the caret's row (keeps at least one row). */
export function tableDeleteRow(editor: HTMLElement): void {
  const cell = caretCell(editor);
  const row = cell?.parentElement as HTMLTableRowElement | undefined;
  const table = caretTable(editor);
  if (!row || !table || table.rows.length <= 1) return;
  row.remove();
}

/** Delete the caret's column (keeps at least one column). */
export function tableDeleteColumn(editor: HTMLElement): void {
  const cell = caretCell(editor);
  const table = caretTable(editor);
  if (!cell || !table) return;
  const colIndex = cell.cellIndex;
  if ((table.rows[0]?.cells.length ?? 0) <= 1) return;
  for (const row of Array.from(table.rows)) {
    if (row.cells[colIndex]) row.cells[colIndex].remove();
  }
}

/** Delete the entire table the caret is in. */
export function tableDelete(editor: HTMLElement): void {
  caretTable(editor)?.remove();
}

/* ----------------------------- state queries ------------------------------ */

export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
}

/** Query toggle states for the current selection (for toolbar highlighting). */
export function queryActiveMarks(): ActiveMarks {
  const q = (c: string) => {
    try {
      return document.queryCommandState(c);
    } catch {
      return false;
    }
  };
  return {
    bold: q("bold"),
    italic: q("italic"),
    underline: q("underline"),
    strike: q("strikeThrough"),
    ul: q("insertUnorderedList"),
    ol: q("insertOrderedList"),
  };
}
