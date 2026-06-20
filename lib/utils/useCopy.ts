"use client";

/**
 * useCopy — copy a string to the OS clipboard with transient "copied" feedback.
 *
 *  Backs widgets whose copyBehavior is 'custom' / 'content' and expose an in-view
 *  copy button (contacts: copy a field; essential-info: copy a value). The copy
 *  itself runs in an event handler (React-19-safe); the "copied" flag auto-resets
 *  after `resetMs` via a timer cleared on unmount.
 *
 *  `copiedKey` lets a list of buttons share one hook and show feedback on just the
 *  one that was clicked (pass a stable key per button; null ⇒ none copied).
 */

import * as React from "react";

export interface UseCopyResult {
  /** The key most recently copied (for per-button "복사됨" feedback), or null. */
  copiedKey: string | null;
  /** Copy `text`; mark `key` (default the text) as copied on success. */
  copy: (text: string, key?: string) => void;
}

export function useCopy(resetMs = 1500): UseCopyResult {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Clear any pending reset timer on unmount.
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = React.useCallback(
    (text: string, key?: string) => {
      if (!text) return;
      const mark = () => {
        setCopiedKey(key ?? text);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopiedKey(null), resetMs);
      };
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(mark).catch(() => {});
      }
    },
    [resetMs],
  );

  return { copiedKey, copy };
}

export default useCopy;
