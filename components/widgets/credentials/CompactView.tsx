"use client";

/**
 * credentials · CompactView — the 비밀번호 금고 on a canvas tile.
 *
 *  Renders the shared CredentialsBody at compact density. The vault is encrypted
 *  in localStorage (device-local); nothing sensitive touches the widget config.
 */

import type { CompactViewProps } from "@/lib/widgets/contract";
import { CredentialsBody } from "./CredentialsBody";
import type { CredentialsConfig } from "./types";

export function CredentialsCompactView({
  config,
  instanceId,
}: CompactViewProps<CredentialsConfig>) {
  return (
    <CredentialsBody config={config} instanceId={instanceId} size="compact" />
  );
}

export default CredentialsCompactView;
