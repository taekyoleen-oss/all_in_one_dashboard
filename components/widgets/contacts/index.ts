/**
 * contacts — WidgetDefinition (설계서 §2.1 #5). dataMode: 'static'.
 * copyBehavior: 'custom' (copy a selected contact field — phone/email — via the
 * in-view copy buttons). Personal contacts are allowed (not in the D5 forbidden
 * set), so this is NOT flagged `sensitive`.
 */

import { Contact as ContactIcon } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { ContactsCompactView } from "./CompactView";
import { ContactsExpandedView } from "./ExpandedView";
import { ContactsConfigEditor } from "./ConfigEditor";
import { DEFAULT_CONTACTS_CONFIG, type ContactsConfig } from "./types";

export const contactsWidget: WidgetDefinition<ContactsConfig> = {
  type: "contacts",
  displayName: "연락처",
  icon: ContactIcon,
  category: "core",
  defaultConfig: DEFAULT_CONTACTS_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: ContactsCompactView,
  ExpandedView: ContactsExpandedView,
  ConfigEditor: ContactsConfigEditor,
  copyBehavior: "custom",
  dataMode: "static",
};

export default contactsWidget;
export type { ContactsConfig } from "./types";
