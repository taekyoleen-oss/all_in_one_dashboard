"use client";

/**
 * credentials · ExpandedView — the 비밀번호 금고 in focus mode.
 *
 *  Same shared body at expanded density (adds the 마스터 비밀번호 변경 control).
 */

import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { CredentialsBody } from "./CredentialsBody";
import type { CredentialsConfig } from "./types";

export function CredentialsExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<CredentialsConfig>) {
  return (
    <div className="h-full">
      <CredentialsBody config={config} instanceId={instanceId} size="expanded" />
    </div>
  );
}

export default CredentialsExpandedView;
