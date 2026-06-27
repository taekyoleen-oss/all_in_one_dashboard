/**
 * ============================================================================
 *  PaneBoard Widget Contract — WidgetDefinition surface (설계서 §9.4)
 * ============================================================================
 *
 *  AUTHOR: ui-builder. This is the **kernel** every widget implements and the
 *  prerequisite for Phase 4 (widget-engineer). It is FROZEN and mirrored to
 *  `output/contract.ts` (the cross-phase handoff artifact). The two files MUST
 *  stay byte-identical — edit here, then copy to output, then notify
 *  widget-engineer of any signature change.
 *
 *  View signatures (do not drift — widget-engineer codes against these):
 *    • CompactView  (config, instanceId, density)  → canvas tile, @container reflow
 *    • ExpandedView (config, instanceId)           → focus mode, full features
 *    • ConfigEditor (config, onChange)             → edit dialog; parent persists
 *
 *  @container regime: WidgetFrame establishes a container context. Views reflow
 *  to their CONTAINER width (not the viewport). `density` is a coarse helper
 *  derived from tile size; fine reflow uses CSS @container queries.
 *
 *  config (C) is persisted as `pb_widgets.config` (jsonb) and layout as
 *  `pb_widgets.layout` (jsonb) — keep C JSON-serializable so it round-trips
 *  through `output/types/database.ts`.
 * ============================================================================
 */
import type React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Coarse density bucket derived from a widget tile's rendered size.
 * Drives spacing/typography inside CompactView (with --density-* tokens).
 */
export type Density = "compact" | "cozy" | "comfortable";

/** Grid-unit size (react-grid-layout columns/rows). */
export interface WidgetSize {
  w: number;
  h: number;
}

/** Props passed to a widget's CompactView (canvas tile). */
export interface CompactViewProps<C = unknown> {
  config: C;
  instanceId: string;
  density: Density;
}

/** Props passed to a widget's ExpandedView (focus overlay). */
export interface ExpandedViewProps<C = unknown> {
  config: C;
  instanceId: string;
}

/** Props passed to a widget's ConfigEditor (edit dialog). */
export interface ConfigEditorProps<C = unknown> {
  config: C;
  onChange: (next: C) => void;
  /**
   * The instance being edited. Optional (older editors ignore it) — used by
   * editors that drive cross-instance state, e.g. the note's "공유 받기" toggle
   * which must clear the flag on every OTHER note.
   */
  instanceId?: string;
}

/**
 * The full definition of a widget type. Registered under its `type` key in
 * `widgetRegistry`. `C` is the widget's own config shape.
 */
export interface WidgetDefinition<C = unknown> {
  /** Registry key — identical to the `widgetRegistry` map key and `pb_widgets.type`. */
  type: string;
  /** Human-readable name shown in palette / headers. */
  displayName: string;
  /** Icon for palette and frame header (lucide component, or a string key). */
  icon: LucideIcon | string;
  /** core = 핵심 9, extended = 확장 6. */
  category: "core" | "extended";

  /** Initial config for a freshly added instance. */
  defaultConfig: C;
  /** Initial grid size when dropped from the palette. */
  defaultSize: WidgetSize;
  /** Smallest allowed grid size (enforced by RGL resize constraints). */
  minSize: WidgetSize;
  /** Largest allowed grid size (enforced by RGL resize constraints). */
  maxSize: WidgetSize;

  /** Canvas tile view. Reflows to its @container; uses `density`. */
  CompactView: React.FC<CompactViewProps<C>>;
  /** Focus-mode view with full functionality. */
  ExpandedView: React.FC<ExpandedViewProps<C>>;
  /** Edit dialog; reports changes via `onChange` (parent owns persistence). */
  ConfigEditor: React.FC<ConfigEditorProps<C>>;

  /**
   * What "copy" yields for this widget:
   *  - 'config'  → duplicate the widget with its settings
   *  - 'content' → copy the rendered content (e.g. memo text, calc result)
   *  - 'custom'  → widget-specific behavior
   */
  copyBehavior: "config" | "content" | "custom";

  /**
   * Data refresh model. Omitted ⇒ no external data.
   *  - 'static' → no polling/stream
   *  - 'poll'   → periodic fetch (환율/날씨/뉴스) — see `refreshInterval`
   *  - 'stream' → live push (주식, via SSE)
   */
  dataMode?: "static" | "poll" | "stream";
  /** Poll period in ms. Only meaningful when `dataMode === 'poll'`. */
  refreshInterval?: number;
  /**
   * Marks widgets that render sensitive personal data (essential-info,
   * card-usage). Used for masking/redaction & log hygiene.
   */
  sensitive?: boolean;
  /** Requires Google OAuth scope (calendar). */
  needsGoogleScope?: boolean;
}

/**
 * The global widget registry: `type` key → its definition.
 * Each entry may have a different config type, so values are erased to
 * `WidgetDefinition` (unknown config) at the registry boundary; concrete config
 * typing lives inside each widget module.
 */
export type WidgetRegistry = Record<string, WidgetDefinition>;
