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
import { Trash2, Plus, Star, Smartphone, Upload } from "lucide-react";
import type { ContactsConfig, Contact } from "./types";
import { parseVCards, type ParsedContact } from "./vcard";

function newContactId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `ct-${crypto.randomUUID().slice(0, 6)}`
    : `ct-${Math.random().toString(36).slice(2, 8)}`;
}

const FIELD =
  "rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/* ---- Web Contact Picker API (Android Chrome) — minimal typing + detection ---- */
interface ContactInfo {
  name?: string[];
  tel?: string[];
  email?: string[];
}
interface ContactsManagerLike {
  getProperties?(): Promise<string[]>;
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<ContactInfo[]>;
}
function getContactsApi(): ContactsManagerLike | null {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return null;
  const api = (navigator as Navigator & { contacts?: ContactsManagerLike })
    .contacts;
  return api && "ContactsManager" in window ? api : null;
}
const subscribeNoop = () => () => {};
/** True only on browsers exposing the Contact Picker (Android Chrome). */
function useContactPickerSupported(): boolean {
  return React.useSyncExternalStore(
    subscribeNoop,
    () => getContactsApi() != null,
    () => false,
  );
}

export function ContactManager({
  config,
  onChange,
}: {
  config: ContactsConfig;
  onChange: (next: ContactsConfig) => void;
}) {
  const setContacts = (contacts: Contact[]) => onChange({ ...config, contacts });

  const pickerSupported = useContactPickerSupported();
  const [notice, setNotice] = React.useState<string | null>(null);
  const vcfRef = React.useRef<HTMLInputElement | null>(null);

  const phoneKey = (p: string) => p.replace(/\D/g, "");

  /** Append imported contacts, skipping ones that duplicate an existing phone/email. */
  const mergeImported = (incoming: ParsedContact[]) => {
    const seenPhones = new Set(
      config.contacts.map((c) => phoneKey(c.phone)).filter(Boolean),
    );
    const seenEmails = new Set(
      config.contacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean),
    );
    const toAdd: Contact[] = [];
    for (const p of incoming) {
      const pk = phoneKey(p.phone);
      const ek = p.email.trim().toLowerCase();
      if (!p.name && !pk && !ek) continue;
      if ((pk && seenPhones.has(pk)) || (ek && seenEmails.has(ek))) continue;
      if (pk) seenPhones.add(pk);
      if (ek) seenEmails.add(ek);
      toAdd.push({
        id: newContactId(),
        name: p.name,
        phone: p.phone,
        email: p.email,
        memo: p.memo,
        favorite: false,
      });
    }
    if (toAdd.length > 0) {
      setContacts([...config.contacts, ...toAdd]);
      setNotice(`${toAdd.length}명을 가져왔습니다.`);
    } else {
      setNotice("새로 가져올 연락처가 없습니다.");
    }
  };

  const pickFromPhone = async () => {
    setNotice(null);
    const api = getContactsApi();
    if (!api) return;
    try {
      const available = (await api.getProperties?.()) ?? ["name", "tel", "email"];
      const wanted = ["name", "tel", "email"].filter((p) =>
        available.includes(p),
      );
      const selected = await api.select(
        wanted.length > 0 ? wanted : ["name", "tel", "email"],
        { multiple: true },
      );
      mergeImported(
        selected.map((c) => ({
          name: (c.name?.[0] ?? "").trim(),
          phone: (c.tel?.[0] ?? "").trim(),
          email: (c.email?.[0] ?? "").trim(),
          memo: "",
        })),
      );
    } catch {
      setNotice("연락처 가져오기를 취소했거나 사용할 수 없습니다.");
    }
  };

  const importVcf = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setNotice(null);
    try {
      const parsed = parseVCards(await file.text());
      if (parsed.length === 0) {
        setNotice("연락처를 찾지 못했습니다 (.vcf 형식을 확인하세요).");
        return;
      }
      mergeImported(parsed);
    } catch {
      setNotice("파일을 읽지 못했습니다.");
    }
  };

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
      {/* 휴대폰 / 파일에서 가져오기 */}
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <span className="text-xs font-medium text-muted-foreground">
          휴대폰 연락처 가져오기
        </span>
        <div className="flex flex-wrap gap-2">
          {pickerSupported ? (
            <button
              type="button"
              onClick={pickFromPhone}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Smartphone size={15} aria-hidden />
              휴대폰에서 선택
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => vcfRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Upload size={15} aria-hidden />
            .vcf 파일에서 가져오기
          </button>
          <input
            ref={vcfRef}
            type="file"
            accept=".vcf,text/vcard,text/x-vcard"
            className="hidden"
            onChange={(e) => {
              void importVcf(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {notice ? (
          <p className="text-xs text-muted-foreground">{notice}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {pickerSupported
              ? "안드로이드 크롬은 ‘휴대폰에서 선택’으로 바로 가져옵니다. 아이폰·PC는 연락처를 .vcf(vCard)로 내보내 가져오세요."
              : "휴대폰 연락처 앱에서 .vcf(vCard)로 내보낸 뒤 가져오세요. (안드로이드 크롬은 ‘휴대폰에서 선택’ 직접 지원)"}
          </p>
        )}
      </div>

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
