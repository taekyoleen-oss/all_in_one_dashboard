/**
 * ============================================================================
 *  Server-side board loader + first-login bootstrap (설계서 §5.1/§5.2/§5.4)
 * ============================================================================
 *
 *  SERVER-ONLY. Imported by the Server Component (app/page.tsx). Reads through
 *  the authed server client, so every query is RLS-scoped to the signed-in user
 *  (auth.uid()) automatically — we still pass the user id explicitly on inserts.
 *
 *  Responsibilities:
 *    1. Load the user's pb_dashboards (ordered by sort_order, then created/name)
 *       and all their pb_widgets in two parallel queries.
 *    2. First-login bootstrap: if the user has NO dashboards, insert one default
 *       board (is_default=true, "내 보드") + a couple of seed widgets so the
 *       canvas is never empty, then return that.
 *    3. Map rows → BoardState[] (the shape <CanvasShell> consumes as initial data).
 *
 *  The browser persistence hook (lib/persistence/usePersistence.ts) then owns all
 *  subsequent writes — this module is read + one-time bootstrap only.
 * ============================================================================
 */

// NOTE: server-only by construction — it imports lib/supabase/server.ts, which
// reads HttpOnly cookies via next/headers and therefore can never be bundled
// into a Client Component. It is only ever imported from app/page.tsx (RSC).

import { createClient } from "@/lib/supabase/server";
import { widgetRegistry } from "@/components/widgets/registry";
import { createInstance } from "@/lib/utils/grid";
import { layoutFromJson, type BoardState } from "@/lib/persistence/types";
import type { Json, TablesInsert } from "@/types/database";
import type { CanvasLayoutItem } from "@/components/canvas/GridCanvas";

/** Default board name used for the first-login bootstrap. */
const DEFAULT_BOARD_NAME = "내 보드";

/** Seed widget types planted into a brand-new default board (must exist in registry). */
const SEED_WIDGET_TYPES = ["memo", "todo", "stock"] as const;

/**
 * Load every board (with its widgets) for the signed-in user, bootstrapping a
 * default board on first login. Returns boards already ordered for the canvas.
 */
export async function loadUserBoards(userId: string): Promise<BoardState[]> {
  const supabase = await createClient();

  // Parallel reads — RLS scopes both to auth.uid(), so no user_id filter needed,
  // but we keep the queries explicit and ordered.
  const [dashRes, widgetRes] = await Promise.all([
    supabase
      .from("pb_dashboards")
      .select("id,name,is_default,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("pb_widgets").select("id,dashboard_id,type,config,layout"),
  ]);

  if (dashRes.error) throw dashRes.error;
  if (widgetRes.error) throw widgetRes.error;

  const dashboards = dashRes.data ?? [];

  // ── First-login bootstrap ────────────────────────────────────────────────
  if (dashboards.length === 0) {
    return bootstrapDefaultBoard(userId);
  }

  // ── Map rows → BoardState[] ───────────────────────────────────────────────
  const widgetsByBoard = new Map<string, typeof widgetRes.data>();
  for (const w of widgetRes.data ?? []) {
    const list = widgetsByBoard.get(w.dashboard_id) ?? [];
    list.push(w);
    widgetsByBoard.set(w.dashboard_id, list);
  }

  return dashboards.map((d) => {
    const rows = widgetsByBoard.get(d.id) ?? [];
    const instances = rows.map((r) => ({
      instanceId: r.id,
      type: r.type,
      config: r.config as unknown,
    }));
    const layout: CanvasLayoutItem[] = rows.map((r) =>
      layoutFromJson(r.layout, r.id),
    );
    return {
      meta: {
        id: d.id,
        name: d.name,
        isDefault: d.is_default,
        sortOrder: d.sort_order,
      },
      instances,
      layout,
    };
  });
}

/**
 * Insert a single default board + seed widgets for a user with no dashboards,
 * and return it as the initial board set. All inserts carry user_id explicitly
 * (RLS with_check requires user_id = auth.uid() AND parent ownership for widgets).
 */
async function bootstrapDefaultBoard(userId: string): Promise<BoardState[]> {
  const supabase = await createClient();

  const { data: board, error: boardErr } = await supabase
    .from("pb_dashboards")
    .insert({
      user_id: userId,
      name: DEFAULT_BOARD_NAME,
      is_default: true,
      sort_order: 0,
    } satisfies TablesInsert<"pb_dashboards">)
    .select("id,name,is_default,sort_order")
    .single();

  if (boardErr || !board) {
    // If the bootstrap insert fails, degrade gracefully to an empty in-memory
    // board (the user can still add widgets; the client hook will try to persist
    // and surface a toast on failure). We do NOT throw — an empty canvas beats a
    // crashed page.
    return [
      {
        meta: {
          id: crypto.randomUUID(),
          name: DEFAULT_BOARD_NAME,
          isDefault: true,
          sortOrder: 0,
        },
        instances: [],
        layout: [],
      },
    ];
  }

  // Build seed widgets locally (instanceId/config/layout) from the registry, then
  // insert them with the new board id as parent.
  const seeds = buildSeedWidgets();
  if (seeds.length > 0) {
    const rows: TablesInsert<"pb_widgets">[] = seeds.map((s) => ({
      id: s.instance.instanceId,
      dashboard_id: board.id,
      user_id: userId,
      type: s.instance.type,
      config: (s.instance.config ?? {}) as Json,
      layout: s.layout as unknown as Json,
    }));
    // Best-effort: if seeding fails, return the empty board rather than failing.
    const { error: seedErr } = await supabase.from("pb_widgets").insert(rows);
    if (seedErr) {
      return [
        {
          meta: {
            id: board.id,
            name: board.name,
            isDefault: board.is_default,
            sortOrder: board.sort_order,
          },
          instances: [],
          layout: [],
        },
      ];
    }
  }

  return [
    {
      meta: {
        id: board.id,
        name: board.name,
        isDefault: board.is_default,
        sortOrder: board.sort_order,
      },
      instances: seeds.map((s) => s.instance),
      layout: seeds.map((s) => ({ ...s.layout, instanceId: s.instance.instanceId })),
    },
  ];
}

/** Mint the seed widget instances + layout for a fresh default board. */
function buildSeedWidgets() {
  const out: {
    instance: { instanceId: string; type: string; config: unknown };
    layout: CanvasLayoutItem;
  }[] = [];
  const existing: CanvasLayoutItem[] = [];
  for (const type of SEED_WIDGET_TYPES) {
    const created = createInstance(widgetRegistry, type, {
      // Use a real uuid so the DB id === instanceId from the very first write.
      existingLayout: existing,
    });
    if (!created) continue;
    // createInstance mints a `${type}-xxxx` id; replace with a uuid so it matches
    // the pb_widgets.id we insert (the column default is gen_random_uuid, but we
    // supply the id so the client already holds the canonical instanceId).
    const id = crypto.randomUUID();
    const instance = { ...created.instance, instanceId: id };
    const layout = { ...created.layoutItem, instanceId: id };
    existing.push(layout);
    out.push({ instance, layout });
  }
  return out;
}
