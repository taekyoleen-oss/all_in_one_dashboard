/**
 * App-facing re-export of the generated Supabase types.
 *
 * The single source of truth is `output/types/database.ts` (the db-architect
 * handoff artifact, regenerated from the live schema). App/lib code imports the
 * `@/types/database` alias so call sites stay stable even if the output path
 * moves; we never hand-edit the generated types.
 */
export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "@/output/types/database";
export { Constants } from "@/output/types/database";
