/**
 * credentials — "비밀번호 금고" WidgetDefinition (설계서 §9.4). dataMode:'static'.
 *
 *  Stores website logins (사이트·주소·아이디·비밀번호·비고) behind a master
 *  password. sensitive:true (log hygiene). copyBehavior:'custom' (per-field copy
 *  buttons inside the view). The credential list is AES-GCM encrypted in
 *  localStorage (device-local) — never in `config`, so nothing sensitive reaches
 *  Supabase.
 */

import { KeyRound } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { CredentialsCompactView } from "./CompactView";
import { CredentialsExpandedView } from "./ExpandedView";
import { CredentialsConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_CREDENTIALS_CONFIG,
  type CredentialsConfig,
} from "./types";

export const credentialsWidget: WidgetDefinition<CredentialsConfig> = {
  type: "credentials",
  displayName: "비밀번호 금고",
  icon: KeyRound,
  category: "extended",
  defaultConfig: DEFAULT_CREDENTIALS_CONFIG,
  defaultSize: { w: 8, h: 8 },
  minSize: { w: 4, h: 3 },
  maxSize: { w: 16, h: 24 },
  CompactView: CredentialsCompactView,
  ExpandedView: CredentialsExpandedView,
  ConfigEditor: CredentialsConfigEditor,
  copyBehavior: "custom",
  dataMode: "static",
  sensitive: true,
};

export default credentialsWidget;
export type { CredentialsConfig } from "./types";
