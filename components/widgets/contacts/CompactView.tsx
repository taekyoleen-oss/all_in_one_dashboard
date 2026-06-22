"use client";

/**
 * contacts · CompactView — pinned favorite contacts (설계서 §2.1 #5).
 *
 *  Renders from `config`: shows pinned `favorite` contacts (falls back to the
 *  first few), each with quick tel:/mailto:. 타일 하단 QuickAdd로 이름+전화를
 *  바로 추가한다(상세는 편집에서). Actions carry icons + aria-labels.
 */

import * as React from "react";
import { Phone, Mail } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import {
  contactInitial,
  mailHref,
  telHref,
  type ContactsConfig,
} from "./types";

export function ContactsCompactView({
  config,
  instanceId,
  density,
}: CompactViewProps<ContactsConfig>) {
  const favorites = config.contacts.filter((c) => c.favorite);
  const list = favorites.length > 0 ? favorites : config.contacts;
  const maxRows = density === "compact" ? 3 : density === "cozy" ? 5 : 8;
  const shown = list.slice(0, maxRows);
  const hidden = list.length - shown.length;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {config.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">연락처가 없습니다.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-scroll">
          {favorites.length === 0 ? (
            <li className="text-xs text-muted-foreground">
              즐겨찾기 연락처 없음 — 전체 목록
            </li>
          ) : null}
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
      )}

      <ContactsQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 이름 + 전화. 추가된 연락처는 즐겨찾기로 둬 타일에 바로 보이게 한다. */
function ContactsQuickAdd({
  config,
  instanceId,
}: {
  config: ContactsConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const add = () => {
    const n = name.trim();
    if (!n) return;
    save(instanceId, {
      ...config,
      contacts: [
        ...config.contacts,
        {
          id: newItemId("c"),
          name: n,
          phone: phone.trim(),
          email: "",
          memo: "",
          favorite: true,
        },
      ],
    });
    setName("");
    setPhone("");
  };
  return (
    <QuickAdd label="연락처 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-1.5"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className={`${quickInputClass} w-20 flex-1`}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화 (선택)"
            inputMode="tel"
            className={`${quickInputClass} w-24 flex-1`}
          />
          <button type="submit" disabled={!name.trim()} className={quickBtnClass}>
            추가
          </button>
        </form>
      )}
    </QuickAdd>
  );
}

export default ContactsCompactView;
