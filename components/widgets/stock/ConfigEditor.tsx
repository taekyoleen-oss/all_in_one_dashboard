"use client";

/**
 * stock · ConfigEditor — pick indices + 국내 종목 (설계서 §2.1).
 *
 *  Delegates to SymbolManager (index toggles + KR-stock add/remove/reorder).
 *  All changes report up via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { SymbolManager } from "./SymbolManager";
import type { StockConfig } from "./types";

export function StockConfigEditor({ config, onChange }: ConfigEditorProps<StockConfig>) {
  return (
    <div className="flex flex-col gap-2">
      <SymbolManager config={config} onChange={onChange} />
    </div>
  );
}

export default StockConfigEditor;
