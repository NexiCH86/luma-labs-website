import { NextRequest, NextResponse } from "next/server";

type CelesTrakRecord = {
    OBJECT_NAME?: string;
    OBJECT_ID?: string;
    EPOCH?: string;
    MEAN_MOTION?: number;
    ECCENTRICITY?: number;
    INCLINATION?: number;
    RA_OF_ASC_NODE?: number;
    ARG_OF_PERICENTER?: number;
    MEAN_ANOMALY?: number;
    EPHEMERIS_TYPE?: number;
    CLASSIFICATION_TYPE?: string;
    NORAD_CAT_ID?: number;
    ELEMENT_SET_NO?: number;
    REV_AT_EPOCH?: number;
    BSTAR?: number;
    MEAN_MOTION_DOT?: number;
    MEAN_MOTION_DDOT?: number;
};

type SatCategory =
    | "station"
    | "navigation"
    | "constellation"
    | "weather"
    | "earth"
    | "science"
    | "amateur"
    | "geo";

type SourceDefinition = { group: string; category: SatCategory; label: string };
type SatelliteRecord = CelesTrakRecord & { category: SatCategory; group: string; groupLabel: string };

const SOURCE_DEFINITIONS: Record<string, SourceDefinition> = {
    STATIONS: { group: "STATIONS", category: "station", label: "Space Stations" },
    "GPS-OPS": { group: "GPS-OPS", category: "navigation", label: "GPS" },
    "GLO-OPS": { group: "GLO-OPS", category: "navigation", label: "GLONASS" },
    GALILEO: { group: "GALILEO", category: "navigation", label: "Galileo" },
    BEIDOU: { group: "BEIDOU", category: "navigation", label: "BeiDou" },
    STARLINK: { group: "STARLINK", category: "constellation", label: "Starlink" },
    WEATHER: { group: "WEATHER", category: "weather", label: "Weather" },
    NOAA: { group: "NOAA", category: "weather", label: "NOAA" },
    RESOURCE: { group: "RESOURCE", category: "earth", label: "Earth Resources" },
    SCIENCE: { group: "SCIENCE", category: "science", label: "Science" },
    AMATEUR: { group: "AMATEUR", category: "amateur", label: "Amateur Radio" },
    GEO: { group: "GEO", category: "geo", label: "Geostationary" },
};

const DEFAULT_GROUPS = ["STATIONS", "GPS-OPS"];
const MAX_GROUPS_PER_REQUEST = 4;

async function loadGroup(source: SourceDefinition): Promise<SatelliteRecord[]> {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(source.group)}&FORMAT=JSON`;
    const response = await fetch(url, {
        next: { revalidate: 7200 },
        headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/2.0 (lumalabs.ch)" },
    });
    if (!response.ok) throw new Error(`CelesTrak ${source.group} returned ${response.status}`);
    const data = (await response.json()) as CelesTrakRecord[];
    return data
        .filter((record) => record.NORAD_CAT_ID != null && record.OBJECT_NAME && record.EPOCH && record.MEAN_MOTION != null && record.ECCENTRICITY != null && record.INCLINATION != null && record.RA_OF_ASC_NODE != null && record.ARG_OF_PERICENTER != null && record.MEAN_ANOMALY != null)
        .map((record) => ({ ...record, category: source.category, group: source.group, groupLabel: source.label }));
}

function parseGroups(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("groups");
    const requested = (raw ? raw.split(",") : DEFAULT_GROUPS).map((value) => value.trim().toUpperCase()).filter(Boolean);
    const unique = Array.from(new Set(requested));
    if (unique.length === 0) return DEFAULT_GROUPS;
    if (unique.length > MAX_GROUPS_PER_REQUEST) throw new Error(`Maximum ${MAX_GROUPS_PER_REQUEST} satellite groups per request`);
    for (const group of unique) if (!SOURCE_DEFINITIONS[group]) throw new Error(`Unsupported satellite group: ${group}`);
    return unique;
}

export async function GET(request: NextRequest) {
    try {
        const groups = parseGroups(request);
        const loadedGroups = await Promise.all(groups.map((group) => loadGroup(SOURCE_DEFINITIONS[group])));
        const byNorad = new Map<number, SatelliteRecord>();
        for (const record of loadedGroups.flat()) {
            if (record.NORAD_CAT_ID == null) continue;
            const existing = byNorad.get(record.NORAD_CAT_ID);
            if (!existing || record.category === "station") byNorad.set(record.NORAD_CAT_ID, record);
        }
        const satellites = Array.from(byNorad.values()).sort((a, b) => (a.OBJECT_NAME ?? "").localeCompare(b.OBJECT_NAME ?? ""));
        return NextResponse.json({ ok: true, source: "CelesTrak GP / OMM", groups, availableGroups: Object.values(SOURCE_DEFINITIONS), cacheSeconds: 7200, generatedAt: new Date().toISOString(), count: satellites.length, satellites }, { headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=86400" } });
    } catch (error) {
        console.error("SAT data error:", error);
        return NextResponse.json({ ok: false, source: "CelesTrak GP / OMM", generatedAt: new Date().toISOString(), count: 0, satellites: [], error: error instanceof Error ? error.message : "Satellite data unavailable" }, { status: 400 });
    }
}
