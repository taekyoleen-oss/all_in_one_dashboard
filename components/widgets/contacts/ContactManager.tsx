"use client";

/**
 * contacts · ContactManager — add / edit / remove contacts (설계서 §2.1 #5).
 *
 *  Controlled: reports the whole next config via onChange (parent owns draft +
 *  persistence). Each contact edits name + phone + email + memo + favorite flag.
 *  No reorder controls here (contacts are searched/filtered, not ordered), but
 *  the favorite flag governs the compact pin order.
 */

import * as React from "react";
import { Trash2, Plus, Star } from "lucide-react";
import type { ContactsConfig, Contact } from "./types";

function newContactId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `ct-${crypto.randomUUID().slice(0, 6)}`
    : `ct-${Math.random().toString(36).slice(2, 8)}`;
}

const FIELD =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ContactManager({
  config,
  onChange,
}: {
  config: ContactsConfig;
  onChange: (next: ContactsConfig) => void;
}) {
  const setContacts = (contacts: Contact[]) => onChange({ ...config, contacts });

  const patch = (id: string, fields: Partial<Contact>) =>
    setContacts(config.contacts.map((c) => (c.id === id ? { ...c, ...fields } : c)));

  const remove = (id: string) =>
    setContacts(config.contacts.filter((c) => c.id !== id));

  const add = () => {
    setContacts([
      ...config.contacts,
      { id: newContactId(), name: "", phone: "", email: "", memo: "", favorite: false },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {config.contacts.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => patch(c.id, { name: e.target.value })}
                placeholder="이름"
                className={`min-w-0 flex-1 ${FIELD}`}
              />
              <button
                type="button"
                aria-label={`${c.name || "연락처"} 즐겨찾기`}
                aria-pressed={c.favorite}
                onClick={() => patch(c.id, { favorite: !c.favorite })}
                className={[
                  "inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  c.favorite
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-accent",
                ].join(" ")}
              >
                <Star size={15} className={c.favorite ? "fill-current" : undefined} />
              </button>
              <button
                type="button"
                aria-label={`${c.name || "연락처"} 삭제`}
                onClick={() => remove(c.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={c.phone}
                onChange={(e) => patch(c.id, { phone: e.target.value })}
                placeholder="전화 (010-…)"
                className={`min-w-0 flex-1 ${FIELD}`}
              />
              <input
                type="email"
                inputMode="email"
                value={c.email}
                onChange={(e) => patch(c.id, { email: e.target.value })}
                placeholder="이메일"
                className={`min-w-0 flex-1 ${FIELD}`}
              />
            </div>
            <input
              value={c.memo}
              onChange={(e) => patch(c.id, { memo: e.target.value })}
              placeholder="메모 (선택)"
              className={FIELD}
            />
          </li>
        ))}
        {config.contacts.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 연락처가 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        연락처 추가
      </button>
    </div>
  );
}

export default ContactManager;
