"use client";

/**
 * subscriptions · ConfigEditor — manage recurring payments (구독 관리).
 *
 *  Delegates to SubscriptionManager (add/edit/remove + base currency). All
 *  changes report up via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { SubscriptionManager } from "./SubscriptionManager";
import type { SubscriptionsConfig } from "./types";

export function SubscriptionsConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<SubscriptionsConfig>) {
  return <SubscriptionManager config={config} onChange={onChange} />;
}

export default SubscriptionsConfigEditor;
