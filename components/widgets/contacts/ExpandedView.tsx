"use client";

/**
 * contacts · ExpandedView — full list + search + tel:/mailto: + copy (설계서 §2.1 #5).
 *
 *  Renders from `config`; the search box is local UI state (not a config edit).
 *  copyBehavior: 'custom' — each contact exposes copy buttons for its individual
 *  fields (name/phone/email). Adding/editing flows through ConfigEditor (편집).
 */

import * as React from "react";
import { Phone, Mail, Copy, Check, Star } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useCopy } from "@/lib/utils/useCopy";
import {
  contactInitial,
  mailHref,
  matchesQuery,
  telHref,
  type Contact,
  type ContactsConfig,
} from "./types";

function CopyChip({
  value,
  label,
  copyKey,
  copiedKey,
  onCopy,
}: {
  value: string;
  label: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key?: string) => void;
}) {
  const copied = copiedKey === copyKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(value, copyKey)}
      aria-label={`${label} 복사${copied ? " (복사됨)" : ""}`}
      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {copied ? "복사됨" : label}
    </button>
  );
}

function ContactCard({
  c,
  copiedKey,
  onCopy,
}: {
  c: Contact;
  copiedKey: string | null;
  onCopy: (text: string, key?: string) => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
        >
          {contactInitial(c)}
        </span>
        <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
          {c.name || "(이름 없음)"}
        </span>
        {c.favorite ? (
          <Star
            size={15}
            aria-label="즐겨찾기"
            className="shrink-0 fill-current text-primary"
          />
        ) : null}
      </div>

      {c.phone ? (
        <div className="flex items-center gap-2 text-sm">
          <a
            href={telHref(c.phone)}
            className="inline-flex items-center gap-1.5 text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone size={14} aria-hidden className="text-muted-foreground" />
            <span className="truncate">{c.phone}</span>
          </a>
          <CopyChip
            value={c.phone}
            label="전화"
            copyKey={`${c.id}:phone`}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </div>
      ) : null}

      {c.email ? (
        <div className="flex items-center gap-2 text-sm">
          <a
            href={mailHref(c.email)}
            className="inline-flex min-w-0 items-center gap-1.5 text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail size={14} aria-hidden className="text-muted-foreground" />
            <span className="truncate">{c.email}</span>
          </a>
          <CopyChip
            value={c.email}
            label="이메일"
            copyKey={`${c.id}:email`}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </div>
      ) : null}

      {c.memo ? (
        <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {c.memo}
        </p>
      ) : null}
    </li>
  );
}

export function ContactsExpandedView({ config }: ExpandedViewProps<ContactsConfig>) {
  const [query, setQuery] = React.useState("");
  const { copiedKey, copy } = useCopy();

  const filtered = config.contacts.filter((c) => matchesQuery(c, query));

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름·전화·이메일 검색…"
        aria-label="연락처 검색"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {config.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          연락처가 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((c) => (
            <ContactCard key={c.id} c={c} copiedKey={copiedKey} onCopy={copy} />
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        연락처 추가·수정·삭제는 위젯 메뉴의 “편집”에서 할 수 있습니다.
      </p>
    </div>
  );
}

export default ContactsExpandedView;
