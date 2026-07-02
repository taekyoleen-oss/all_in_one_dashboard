"use client";

// TEMP reproduction page for the mobile widget-add sheet (카테고리 팝업) bug.
// Mirrors CanvasShell's sticky-header + main + WidgetPalette structure.
// 개발 전용 — 프로덕션 빌드에서는 404 (테스트 라우트 노출 방지).
import * as React from "react";
import { notFound } from "next/navigation";
import { WidgetPalette, usePaletteCollapsed } from "@/components/canvas/WidgetPalette";
import { widgetRegistry } from "@/components/widgets/registry";

export default function PaletteTest() {
  const [collapsed, setCollapsed] = usePaletteCollapsed();
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-2 px-4 py-2.5">
          <h1 className="text-base font-semibold text-foreground">테스트 헤더</h1>
        </div>
      </div>
      <WidgetPalette
        registry={widgetRegistry}
        onAdd={(t) => console.log("add", t)}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        <div className="min-h-[80dvh] rounded border border-dashed border-border" />
      </div>
    </main>
  );
}
