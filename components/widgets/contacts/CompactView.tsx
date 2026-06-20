"use client";

/**
 * contacts · CompactView — pinned favorite contacts (설계서 §2.1 #5).
 *
 *  Renders purely from `config`: shows contacts flagged `favorite` (falls back to
 *  the first few when none are pinned), each with quick tel:/mailto: actions.
 *  Color is never the only signal — actions carry icons + aria-labels.
 */

import * as React from "react";
import { Phone, Mail } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import {
  contactInitial,
  mailHref,
  telHref,
  type ContactsConfig,
} from "./types";

export function ContactsCompactView({
  config,
  density,
}: CompactViewProps<ContactsConfig>) {
  if (config.contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        연락처가 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  const favorites = config.contacts.filter((c) => c.favorite);
  const list = favorites.length > 0 ? favorites : config.contacts;
  const maxRows = density === "compact" ? 3 : density === "cozy" ? 5 : 8;
  const shown = list.slice(0, maxRows);
  const hidden = list.length - shown.length;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {favorites.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          즐겨찾기 연락처 없음 — 전체 목록
        </span>
      ) : null}
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        {shown.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            >
              {contactInitial(c)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {c.name || "(이름 없음)"}
            </span>
            {c.phone ? (
              <a
                href={telHref(c.phone)}
                aria-label={`${c.name} 전화`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Phone size={14} />
              </a>
            ) : null}
            {c.email ? (
              <a
                href={mailHref(c.email)}
                aria-label={`${c.name} 이메일`}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Mail size={14} />
              </a>
            ) : null}
          </li>
        ))}
        {hidden > 0 ? (
          <li className="text-xs text-muted-foreground">+{hidden}명 더</li>
        ) : null}
      </ul>
    </div>
  );
}

export default ContactsCompactView;
