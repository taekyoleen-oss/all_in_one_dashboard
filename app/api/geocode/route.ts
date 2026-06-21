/**
 * ============================================================================
 *  GET /api/geocode?q=... — place/address search for the weather widget
 * ============================================================================
 *
 *  Returns candidate locations ({label, detail, lat, lon}) for a free-text query
 *  (주소 동 단위·골프장·랜드마크). Server-only geocoding (Kakao when keyed, else
 *  keyless Nominatim) — the upstream key never reaches the client. Short cache
 *  since place coordinates are effectively static.
 *
 *  Route Handler (Next.js 16). Reads the request URL → dynamic.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/api/geocodeClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ results: [] }, { headers: { "cache-control": "no-store" } });
  }
  const results = await searchPlaces(q, 8);
  return Response.json(
    { results },
    {
      headers: {
        // Coordinates are static → cache the lookup briefly to spare the upstream.
        "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
