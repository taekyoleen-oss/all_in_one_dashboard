"use client";

/**
 * contacts · ConfigEditor — manage the contact list (설계서 §2.1 #5).
 *
 *  Delegates to ContactManager (name/phone/email/memo/favorite; add/edit/remove).
 *  All changes report up via onChange (parent owns persistence). Personal contacts
 *  are allowed (not in the D5 forbidden set), so no sensitive-info warning here.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { ContactManager } from "./ContactManager";
import type { ContactsConfig } from "./types";

export function ContactsConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<ContactsConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <ContactManager config={config} onChange={onChange} />
    </div>
  );
}

export default ContactsConfigEditor;
