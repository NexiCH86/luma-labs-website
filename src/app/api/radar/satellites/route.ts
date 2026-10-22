import { NextRequest, NextResponse } from "next/server";
import { buildSatelliteResponse, createRedisSatelliteStore, loadGroup, SOURCE_DEFINITIONS } from "@/lib/satellite-source";

/*
 * Satelliten-Bahndaten fuer SAT und STARS: /api/radar/satellites?groups=STATIONS,GPS-OPS
 *
 * Jede Gruppe wird einzeln geladen. Faellt eine aus, kommen die
 * anderen trotzdem (failedGroups nennt die fehlenden). 503 nur,
 * wenn gar keine Gruppe Daten liefert.
 */
export const maxDuration = 30;

const DEFAULT_GROUPS = ["STATIONS", "GPS-OPS"];
const MAX_GROUPS_PER_REQUEST = 4;

class BadRequest extends Error {}

function parseGroups(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("groups");
    const requested = (raw ? raw.split(",") : DEFAULT_GROUPS).map((value) => value.trim().toUpperCase()).filter(Boolean);
    const unique = Array.from(new Set(requested));
    if (unique.length === 0) return DEFAULT_GROUPS;
    if (unique.length > MAX_GROUPS_PER_REQUEST) throw new BadRequest(`Maximum ${MAX_GROUPS_PER_REQUEST} satellite groups per request`);
    for (const group of unique) if (!SOURCE_DEFINITIONS[group]) throw new BadRequest(`Unsupported satellite group: ${group}`);
    return unique;
}

export async function GET(request: NextRequest) {
    let groups: string[];
    try {
        groups = parseGroups(request);
    } catch (error) {
        return NextResponse.json(
            { ok: false, source: "CelesTrak GP / OMM", generatedAt: new Date().toISOString(), count: 0, satellites: [], error: error instanceof Error ? error.message : "Bad request" },
            { status: 400, headers: { "Cache-Control": "no-store" } }
        );
    }

    const store = createRedisSatelliteStore();
    const settled = await Promise.allSettled(groups.map((group) => loadGroup(SOURCE_DEFINITIONS[group], { store })));
    const body = buildSatelliteResponse(groups, settled);

    /*
     * Vollstaendige, aktuelle Antworten darf das CDN 30 min halten,
     * Teilausfaelle nur kurz, damit sie sich schnell erholen.
     */
    const complete = body.ok && body.failedGroups.length === 0 && !body.stale;
    const cacheControl = complete
        ? "public, s-maxage=1800, stale-while-revalidate=86400"
        : body.ok
          ? "public, s-maxage=120"
          : "no-store";

    return NextResponse.json(body, { status: body.ok ? 200 : 503, headers: { "Cache-Control": cacheControl } });
}
