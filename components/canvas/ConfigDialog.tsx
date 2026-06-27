"use client";

/**
 * ============================================================================
 *  ConfigDialog — hosts a widget's ConfigEditor (설계서 §3 편집, §9.4 컨트랙트)
 * ============================================================================
 *
 *  The widget menu's 편집 opens this dialog. It renders the widget's own
 *  `ConfigEditor(config, onChange)` (per the frozen contract — the editor reports
 *  changes up via onChange; the PARENT owns persistence). Draft state is local:
 *  편집 → 저장 commits the draft back to the page; 취소 / Back / scrim discards it.
 *
 *  Draft reset uses the React "reset state with a key" pattern: the outer gate
 *  holds NO draft state, and the inner body (which seeds its draft from props via
 *  a useState initializer) is remounted per instance via `key`. That keeps a
 *  fresh draft per open without a setState-in-effect.
 *
 *  Back-stack: keyed `edit:'+instanceId` so Android/PWA Back closes the dialog
 *  only (§6.3) — same shared LIFO as focus + the mobile palette sheet.
 * ============================================================================
 */

import * as React from "react";
import { X } from "lucide-react";
import type { WidgetRegistry } from "@/lib/widgets/contract";
import type { WidgetInstance } from "@/components/canvas/GridCanvas";
import { IconButton } from "@/components/ui/primitives";

export interface ConfigDialogProps {
  registry: WidgetRegistry;
  /** Instance being edited, or null. */
  instance: WidgetInstance | null;
  /** True while the dialog should be visible (top of back-stack). */
  open: boolean;
  /** Commit the edited config for this instance. */
  onSave: (instanceId: string, nextConfig: unknown) => void;
  /** Close without saving (routes through useBackStack.closeTop). */
  onClose: () => void;
}

export function ConfigDialog({
  registry,
  instance,
  open,
  onSave,
  onClose,
}: ConfigDialogProps) {
  if (!open || !instance) return null;
  // Remount the body per instance so its draft seeds fresh from the new config.
  return (
    <ConfigDialogBody
      key={instance.instanceId}
      registry={registry}
      instance={instance}
      onSave={onSave}
      onClose={onClose}
    />
  );
}

function ConfigDialogBody({
  registry,
  instance,
  onSave,
  onClose,
}: {
  registry: WidgetRegistry;
  instance: WidgetInstance;
  onSave: (instanceId: string, nextConfig: unknown) => void;
  onClose: () => void;
}) {
  // Seeded once on mount (the gate remounts us per instance) — no effect needed.
  const [draft, setDraft] = React.useState<unknown>(instance.config);

  const def = registry[instance.type];
  const Editor = def?.ConfigEditor;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={def ? `${def.displayName} 편집` : "위젯 편집"}
        className={[
          "relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card",
          "text-card-foreground shadow-2xl sm:rounded-2xl",
          "motion-safe:animate-[pb-sheet-up_220ms_ease-out] sm:motion-safe:animate-[pb-overlay-in_220ms_ease-out]",
        ].join(" ")}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {def?.displayName ?? instance.type} 편집
          </h2>
          <IconButton label="닫기" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="max-h-[75dvh] overflow-y-auto p-4">
          {Editor ? (
            <Editor
              config={draft}
              onChange={setDraft}
              instanceId={instance.instanceId}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              이 위젯에는 편집할 설정이 없습니다.
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(instance.instanceId, draft);
              onClose();
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}

export default ConfigDialog;
