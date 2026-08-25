import { NextRequest, NextResponse } from "next/server";
import { get, put } from "@vercel/blob";

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

type SourceDefinition = {
    group: string;
    category: SatCategory;
    label: string;
    fallbackSearches: string[];
};

type SatelliteRecord = CelesTrakRecord & {
    category: SatCategory;
    group: string;
    groupLabel: string;
};

type DataMode = "live" | "fallback" | "cached" | "offline";

type GroupLoadResult = {
    group: string;
    satellites: SatelliteRecord[];
    mode: DataMode;
    provider?: string;
    error?: string;
    cachedAt?: string;
};

type PersistentCache = {
    group: string;
    savedAt: string;
    provider: string;
    satellites: SatelliteRecord[];
};

type TleApiItem = {
    satelliteId?: number | string;
    id?: number | string;
    name?: string;
    satelliteName?: string;
    line1?: string;
    line2?: string;
    date?: string;
};

const SOURCE_DEFINITIONS: Record<string, SourceDefinition> = {
    STATIONS: {
        group: "STATIONS",
        category: "station",
        label: "Space Stations",
        fallbackSearches: ["ISS", "TIANHE"],
    },
    "GPS-OPS": {
        group: "GPS-OPS",
        category: "navigation",
        label: "GPS",
        fallbackSearches: ["GPS"],
    },
    "GLO-OPS": {
        group: "GLO-OPS",
        category: "navigation",
        label: "GLONASS",
        fallbackSearches: ["GLONASS"],
    },
    GALILEO: {
        group: "GALILEO",
        category: "navigation",
        label: "Galileo",
        fallbackSearches: ["GALILEO"],
    },
    BEIDOU: {
        group: "BEIDOU",
        category: "navigation",
        label: "BeiDou",
        fallbackSearches: ["BEIDOU"],
    },
    STARLINK: {
        group: "STARLINK",
        category: "constellation",
        label: "Starlink",
        fallbackSearches: ["STARLINK"],
    },
    WEATHER: {
        group: "WEATHER",
        category: "weather",
        label: "Weather",
        fallbackSearches: ["NOAA", "METEOR"],
    },
    NOAA: {
        group: "NOAA",
        category: "weather",
        label: "NOAA",
        fallbackSearches: ["NOAA"],
    },
    RESOURCE: {
        group: "RESOURCE",
        category: "earth",
        label: "Earth Resources",
        fallbackSearches: ["LANDSAT", "SENTINEL"],
    },
    SCIENCE: {
        group: "SCIENCE",
        category: "science",
        label: "Science",
        fallbackSearches: ["HST", "FERMI"],
    },
    AMATEUR: {
        group: "AMATEUR",
        category: "amateur",
        label: "Amateur Radio",
        fallbackSearches: ["OSCAR"],
    },
    GEO: {
        group: "GEO",
        category: "geo",
        label: "Geostationary",
        fallbackSearches: ["GOES", "INTELSAT"],
    },
};

const DEFAULT_GROUPS = ["STATIONS", "GPS-OPS"];
const MAX_GROUPS_PER_REQUEST = 4;
const CELESTRAK_BASES = [
    "https://celestrak.org",
    "https://www.celestrak.org",
    "https://celestrak.com",
];
const TLE_API_BASES = [
    "https://tle.ivanstanojevic.me",
    "https://data.ivanstanojevic.me",
];
const FETCH_TIMEOUT_MS = 6500;
const CACHE_PREFIX = "radar/sat-cache";
const memoryCache = new Map<string, PersistentCache>();

function normalizeRecords(source: SourceDefinition, data: CelesTrakRecord[]): SatelliteRecord[] {
    return data
        .filter(
            (record) =>
                record.NORAD_CAT_ID != null &&
                record.OBJECT_NAME &&
                record.EPOCH &&
                record.MEAN_MOTION != null &&
                record.ECCENTRICITY != null &&
                record.INCLINATION != null &&
                record.RA_OF_ASC_NODE != null &&
                record.ARG_OF_PERICENTER != null &&
                record.MEAN_ANOMALY != null
        )
        .map((record) => ({
            ...record,
            category: source.category,
            group: source.group,
            groupLabel: source.label,
        }));
}

function exponentField(value: string) {
    const compact = value.trim().replace(/\s+/g, "");
    if (!compact) return 0;
    const match = compact.match(/^([+-]?)(\d+)([+-]\d+)$/);
    if (!match) return Number(compact) || 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * Number(`0.${match[2]}`) * 10 ** Number(match[3]);
}

function tleEpochToIso(line1: string) {
    const raw = line1.slice(18, 32).trim();
    const year2 = Number(raw.slice(0, 2));
    const day = Number(raw.slice(2));
    if (!Number.isFinite(year2) || !Number.isFinite(day)) return new Date().toISOString();
    const year = year2 >= 57 ? 1900 + year2 : 2000 + year2;
    const start = Date.UTC(year, 0, 1);
    return new Date(start + (day - 1) * 86_400_000).toISOString();
}

function tleToRecord(source: SourceDefinition, item: TleApiItem): SatelliteRecord | null {
    const line1 = item.line1?.trim();
    const line2 = item.line2?.trim();
    if (!line1 || !line2 || line1.length < 60 || line2.length < 60) return null;

    const norad = Number(item.satelliteId ?? item.id ?? line1.slice(2, 7).trim());
    const inclination = Number(line2.slice(8, 16).trim());
    const raan = Number(line2.slice(17, 25).trim());
    const eccentricity = Number(`0.${line2.slice(26, 33).trim()}`);
    const argPerigee = Number(line2.slice(34, 42).trim());
    const meanAnomaly = Number(line2.slice(43, 51).trim());
    const meanMotion = Number(line2.slice(52, 63).trim());
    const revAtEpoch = Number(line2.slice(63, 68).trim());

    if (
        !Number.isFinite(norad) ||
        !Number.isFinite(inclination) ||
        !Number.isFinite(raan) ||
        !Number.isFinite(eccentricity) ||
        !Number.isFinite(argPerigee) ||
        !Number.isFinite(meanAnomaly) ||
        !Number.isFinite(meanMotion)
    ) {
        return null;
    }

    return {
        OBJECT_NAME: item.name ?? item.satelliteName ?? `NORAD ${norad}`,
        OBJECT_ID: line1.slice(9, 17).trim() || undefined,
        EPOCH: item.date ?? tleEpochToIso(line1),
        MEAN_MOTION: meanMotion,
        ECCENTRICITY: eccentricity,
        INCLINATION: inclination,
        RA_OF_ASC_NODE: raan,
        ARG_OF_PERICENTER: argPerigee,
        MEAN_ANOMALY: meanAnomaly,
        EPHEMERIS_TYPE: Number(line1.slice(62, 63).trim()) || 0,
        CLASSIFICATION_TYPE: line1.slice(7, 8).trim() || "U",
        NORAD_CAT_ID: norad,
        ELEMENT_SET_NO: Number(line1.slice(64, 68).trim()) || 0,
        REV_AT_EPOCH: Number.isFinite(revAtEpoch) ? revAtEpoch : 0,
        BSTAR: exponentField(line1.slice(53, 61)),
        MEAN_MOTION_DOT: Number(line1.slice(33, 43).trim()) || 0,
        MEAN_MOTION_DDOT: exponentField(line1.slice(44, 52)),
        category: source.category,
        group: source.group,
        groupLabel: source.label,
    };
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    } finally {
        clearTimeout(timer);
    }
}

function cachePath(group: string) {
    return `${CACHE_PREFIX}/${group.toLowerCase()}.json`;
}

async function readPersistentCache(group: string): Promise<PersistentCache | null> {
    const memory = memoryCache.get(group);
    if (memory) return memory;

    try {
        const result = await get(cachePath(group), { access: "private" });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        const cached = (await new Response(result.stream).json()) as PersistentCache;
        if (!Array.isArray(cached.satellites) || !cached.savedAt) return null;
        memoryCache.set(group, cached);
        return cached;
    } catch {
        return null;
    }
}

async function writePersistentCache(
    group: string,
    provider: string,
    satellites: SatelliteRecord[]
) {
    if (satellites.length === 0) return;
    const payload: PersistentCache = {
        group,
        savedAt: new Date().toISOString(),
        provider,
        satellites,
    };
    memoryCache.set(group, payload);

    try {
        await put(cachePath(group), JSON.stringify(payload), {
            access: "private",
            addRandomSuffix: false,
            overwrite: true,
            contentType: "application/json",
        });
    } catch (error) {
        console.warn(
            `SAT persistent cache write skipped for ${group}:`,
            error instanceof Error ? error.message : error
        );
    }
}

async function loadFromCelesTrak(source: SourceDefinition) {
    const errors: string[] = [];

    for (const base of CELESTRAK_BASES) {
        const url = `${base}/NORAD/elements/gp.php?GROUP=${encodeURIComponent(source.group)}&FORMAT=JSON`;
        try {
            const response = await fetchWithTimeout(url, {
                headers: { Accept: "application/json,text/plain;q=0.9,*/*;q=0.8" },
            });
            if (!response.ok) {
                errors.push(`${new URL(base).hostname}: HTTP ${response.status}`);
                continue;
            }
            const raw = await response.text();
            if (!raw.trim()) {
                errors.push(`${new URL(base).hostname}: empty response`);
                continue;
            }
            const data = JSON.parse(raw) as CelesTrakRecord[];
            if (!Array.isArray(data)) {
                errors.push(`${new URL(base).hostname}: unexpected payload`);
                continue;
            }
            const satellites = normalizeRecords(source, data);
            if (satellites.length > 0) return { satellites, provider: "CelesTrak GP / OMM" };
            errors.push(`${new URL(base).hostname}: no usable records`);
        } catch (error) {
            errors.push(
                `${new URL(base).hostname}: ${error instanceof Error ? error.message : "request failed"}`
            );
        }
    }

    throw new Error(errors.join("; "));
}

function extractTleItems(payload: unknown): TleApiItem[] {
    if (Array.isArray(payload)) return payload as TleApiItem[];
    if (!payload || typeof payload !== "object") return [];
    const object = payload as Record<string, unknown>;
    for (const key of ["member", "members", "data", "results", "items"]) {
        if (Array.isArray(object[key])) return object[key] as TleApiItem[];
    }
    return [];
}

async function loadFromTleApi(source: SourceDefinition) {
    const errors: string[] = [];
    const byNorad = new Map<number, SatelliteRecord>();

    for (const base of TLE_API_BASES) {
        for (const search of source.fallbackSearches) {
            const url = `${base}/api/tle?search=${encodeURIComponent(search)}&page-size=100`;
            try {
                const response = await fetchWithTimeout(url, {
                    headers: { Accept: "application/json" },
                });
                if (!response.ok) {
                    errors.push(`${new URL(base).hostname}/${search}: HTTP ${response.status}`);
                    continue;
                }
                const payload = (await response.json()) as unknown;
                const items = extractTleItems(payload);
                for (const item of items) {
                    const record = tleToRecord(source, item);
                    if (record?.NORAD_CAT_ID != null) byNorad.set(record.NORAD_CAT_ID, record);
                }
            } catch (error) {
                errors.push(
                    `${new URL(base).hostname}/${search}: ${error instanceof Error ? error.message : "request failed"}`
                );
            }
        }
        if (byNorad.size > 0) break;
    }

    if (byNorad.size === 0) {
        throw new Error(errors.join("; ") || "TLE API returned no usable records");
    }

    return {
        satellites: Array.from(byNorad.values()),
        provider: "TLE API / CelesTrak mirror",
    };
}

async function loadGroup(source: SourceDefinition): Promise<GroupLoadResult> {
    const errors: string[] = [];

    try {
        const live = await loadFromCelesTrak(source);
        await writePersistentCache(source.group, live.provider, live.satellites);
        return {
            group: source.group,
            satellites: live.satellites,
            mode: "live",
            provider: live.provider,
        };
    } catch (error) {
        errors.push(`CelesTrak: ${error instanceof Error ? error.message : "failed"}`);
    }

    try {
        const fallback = await loadFromTleApi(source);
        await writePersistentCache(source.group, fallback.provider, fallback.satellites);
        return {
            group: source.group,
            satellites: fallback.satellites,
            mode: "fallback",
            provider: fallback.provider,
        };
    } catch (error) {
        errors.push(`TLE API: ${error instanceof Error ? error.message : "failed"}`);
    }

    const cached = await readPersistentCache(source.group);
    if (cached?.satellites.length) {
        return {
            group: source.group,
            satellites: cached.satellites,
            mode: "cached",
            provider: cached.provider,
            cachedAt: cached.savedAt,
            error: errors.join(" | "),
        };
    }

    return {
        group: source.group,
        satellites: [],
        mode: "offline",
        error: errors.join(" | "),
    };
}

function parseGroups(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get("groups");
    const requested = (raw ? raw.split(",") : DEFAULT_GROUPS)
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
    const unique = Array.from(new Set(requested));

    if (unique.length === 0) return DEFAULT_GROUPS;
    if (unique.length > MAX_GROUPS_PER_REQUEST) {
        throw new Error(`Maximum ${MAX_GROUPS_PER_REQUEST} satellite groups per request`);
    }
    for (const group of unique) {
        if (!SOURCE_DEFINITIONS[group]) throw new Error(`Unsupported satellite group: ${group}`);
    }
    return unique;
}

function overallMode(results: GroupLoadResult[]): DataMode {
    if (results.some((result) => result.mode === "live")) return "live";
    if (results.some((result) => result.mode === "fallback")) return "fallback";
    if (results.some((result) => result.mode === "cached")) return "cached";
    return "offline";
}

export async function GET(request: NextRequest) {
    try {
        const groups = parseGroups(request);
        const results = await Promise.all(
            groups.map((group) => loadGroup(SOURCE_DEFINITIONS[group]))
        );

        const byNorad = new Map<number, SatelliteRecord>();
        for (const result of results) {
            for (const record of result.satellites) {
                if (record.NORAD_CAT_ID == null) continue;
                const existing = byNorad.get(record.NORAD_CAT_ID);
                if (!existing || record.category === "station") byNorad.set(record.NORAD_CAT_ID, record);
            }
        }

        const satellites = Array.from(byNorad.values()).sort((a, b) =>
            (a.OBJECT_NAME ?? "").localeCompare(b.OBJECT_NAME ?? "")
        );
        const failedGroups = results
            .filter((result) => result.mode === "offline")
            .map((result) => ({ group: result.group, error: result.error }));
        const degradedGroups = results
            .filter((result) => result.mode === "fallback" || result.mode === "cached")
            .map((result) => ({
                group: result.group,
                mode: result.mode,
                provider: result.provider,
                cachedAt: result.cachedAt,
                upstreamError: result.error,
            }));

        const mode = overallMode(results);
        return NextResponse.json(
            {
                ok: satellites.length > 0 || failedGroups.length < groups.length,
                source: "LuMa SAT Cloud Data Layer",
                dataMode: mode,
                groups,
                groupModes: results.map((result) => ({
                    group: result.group,
                    mode: result.mode,
                    provider: result.provider,
                    count: result.satellites.length,
                    cachedAt: result.cachedAt,
                })),
                failedGroups,
                degradedGroups,
                partial: results.some((result) => result.mode !== "live"),
                availableGroups: Object.values(SOURCE_DEFINITIONS),
                cacheSeconds: 300,
                generatedAt: new Date().toISOString(),
                count: satellites.length,
                satellites,
            },
            {
                status: satellites.length === 0 && failedGroups.length === groups.length ? 503 : 200,
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("SAT data error:", error);
        return NextResponse.json(
            {
                ok: false,
                source: "LuMa SAT Cloud Data Layer",
                dataMode: "offline",
                generatedAt: new Date().toISOString(),
                count: 0,
                satellites: [],
                error: error instanceof Error ? error.message : "Satellite data unavailable",
            },
            { status: 400 }
        );
    }
}
