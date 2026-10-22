import {
    acquireStoreLock,
    hasRadarStore,
    readStoredJson,
    writeStoredJson,
} from "./radar-store";

/*
 * =====================================================
 * LuMa RADAR – SAT-Bahndaten (CelesTrak), ausfallsicher
 * =====================================================
 *
 * CelesTrak sperrt mit 403, wenn dieselbe Datei von derselben
 * Adresse oefter als alle 2 Stunden geladen wird. Auf Vercel
 * teilen sich viele Projekte die Adressen, deshalb:
 *
 *   - Jede Gruppe wird hoechstens alle 2 h live geladen, das
 *     Ergebnis liegt in Redis ("last known good", 7 Tage).
 *   - Eine Sperre in Redis verhindert, dass mehrere Instanzen
 *     gleichzeitig dieselbe Gruppe laden.
 *   - Liefert CelesTrak kein JSON (403, Text statt JSON), wird
 *     dieselbe Gruppe im TLE-Format versucht, bei Starlink
 *     zusaetzlich die Supplemental-Daten.
 *   - Faellt alles aus, liefert der Cache die letzten Daten.
 */

export type SatCategory =
    | "station"
    | "navigation"
    | "constellation"
    | "weather"
    | "earth"
    | "science"
    | "amateur"
    | "geo";

export type OmmRecord = {
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

export type SatelliteRecord = OmmRecord & { category: SatCategory; group: string; groupLabel: string };

export type SourceDefinition = {
    group: string;
    category: SatCategory;
    label: string;
    /* Weitere Quellen, falls JSON und TLE der Gruppe ausfallen. */
    extraUrls?: string[];
};

const CELESTRAK_GP = "https://celestrak.org/NORAD/elements/gp.php";
const CELESTRAK_SUPPLEMENTAL = "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php";

/*
 * NOAA gibt es bei CelesTrak nicht mehr als Gruppe ("Invalid query"),
 * die NOAA-Wettersatelliten sind in WEATHER enthalten.
 */
export const SOURCE_DEFINITIONS: Record<string, SourceDefinition> = {
    STATIONS: { group: "STATIONS", category: "station", label: "Space Stations" },
    VISUAL: { group: "VISUAL", category: "science", label: "100 brightest" },
    "GPS-OPS": { group: "GPS-OPS", category: "navigation", label: "GPS" },
    "GLO-OPS": { group: "GLO-OPS", category: "navigation", label: "GLONASS" },
    GALILEO: { group: "GALILEO", category: "navigation", label: "Galileo" },
    BEIDOU: { group: "BEIDOU", category: "navigation", label: "BeiDou" },
    STARLINK: {
        group: "STARLINK",
        category: "constellation",
        label: "Starlink",
        extraUrls: [`${CELESTRAK_SUPPLEMENTAL}?FILE=starlink&FORMAT=json`],
    },
    WEATHER: { group: "WEATHER", category: "weather", label: "Weather" },
    RESOURCE: { group: "RESOURCE", category: "earth", label: "Earth Resources" },
    SCIENCE: { group: "SCIENCE", category: "science", label: "Science" },
    AMATEUR: { group: "AMATEUR", category: "amateur", label: "Amateur Radio" },
    GEO: { group: "GEO", category: "geo", label: "Geostationary" },
};

/* CelesTrak erlaubt dieselbe Datei hoechstens alle 2 Stunden. */
export const FRESH_MS = 2 * 60 * 60 * 1000;

/* Aelter gilt als veraltet und wird in der Oberflaeche angezeigt. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOCK_TTL_SECONDS = 120;
const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "LuMa-RADAR/2.0 (lumalabs.ch)";

export type SourceFormat = "OMM" | "TLE";

export type GroupCacheEntry = {
    group: string;
    fetchedAt: number;
    format: SourceFormat;
    records: OmmRecord[];
};

/*
 * Kleiner Statuseintrag pro Gruppe, damit der Health-Check nicht
 * die ganzen Bahndaten (Starlink: rund 2 MB) lesen muss.
 */
export type GroupStatus = {
    lastAttemptAt: number;
    lastSuccessAt: number | null;
    count: number;
    format: SourceFormat | null;
    lastError: string | null;
};

export type SatelliteStore = {
    read(group: string): Promise<GroupCacheEntry | null>;
    write(entry: GroupCacheEntry): Promise<void>;
    lock(group: string): Promise<boolean>;
    readStatus(group: string): Promise<GroupStatus | null>;
    writeStatus(group: string, status: GroupStatus): Promise<void>;
};

export type GroupResult = {
    group: string;
    records: SatelliteRecord[];
    fetchedAt: number;
    format: SourceFormat;
    origin: "live" | "cache";
    stale: boolean;
    warning?: string;
};

/* ---------- Parser ---------- */

function isComplete(record: OmmRecord) {
    return (
        record.NORAD_CAT_ID != null &&
        Boolean(record.OBJECT_NAME) &&
        Boolean(record.EPOCH) &&
        [
            record.MEAN_MOTION,
            record.ECCENTRICITY,
            record.INCLINATION,
            record.RA_OF_ASC_NODE,
            record.ARG_OF_PERICENTER,
            record.MEAN_ANOMALY,
        ].every((value) => typeof value === "number" && Number.isFinite(value))
    );
}

/*
 * CelesTrak antwortet bei Fehlern mit Text statt JSON, z. B.
 * "Invalid query" oder "No GP data found".
 */
export function parseOmmJson(text: string): OmmRecord[] {
    const trimmed = text.trim();
    if (!trimmed.startsWith("[")) {
        throw new Error(trimmed ? `not JSON: "${trimmed.slice(0, 60)}"` : "empty response");
    }
    const data = JSON.parse(trimmed) as OmmRecord[];
    return data.filter(isComplete);
}

/* TLE-Exponentenfeld, z. B. " 59442-4" = 0.59442e-4 */
function exponentField(value: string) {
    const compact = value.trim().replace(/\s+/g, "");
    if (!compact) return 0;
    const match = compact.match(/^([+-]?)(\d+)([+-]\d+)$/);
    if (!match) return Number(compact) || 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * Number(`0.${match[2]}`) * 10 ** Number(match[3]);
}

/* Epoche "19156.50900463" (Jahr, Tag des Jahres) als ISO-Zeit ohne Zeitzone, wie in OMM. */
function tleEpoch(field: string) {
    const year2 = Number(field.slice(0, 2));
    const dayOfYear = Number(field.slice(2));
    if (!Number.isFinite(year2) || !Number.isFinite(dayOfYear)) return null;
    const year = year2 >= 57 ? 1900 + year2 : 2000 + year2;
    const ms = Date.UTC(year, 0, 1) + (dayOfYear - 1) * 86_400_000;
    return new Date(Math.round(ms)).toISOString().replace("Z", "");
}

export function tleToOmm(name: string, line1: string, line2: string): OmmRecord | null {
    if (!line1.startsWith("1 ") || !line2.startsWith("2 ") || line1.length < 64 || line2.length < 63) return null;

    const record: OmmRecord = {
        OBJECT_NAME: name.replace(/^0 /, "").trim() || undefined,
        OBJECT_ID: undefined,
        EPOCH: tleEpoch(line1.slice(18, 32).trim()) ?? undefined,
        MEAN_MOTION: Number(line2.slice(52, 63)),
        ECCENTRICITY: Number(`0.${line2.slice(26, 33).trim()}`),
        INCLINATION: Number(line2.slice(8, 16)),
        RA_OF_ASC_NODE: Number(line2.slice(17, 25)),
        ARG_OF_PERICENTER: Number(line2.slice(34, 42)),
        MEAN_ANOMALY: Number(line2.slice(43, 51)),
        EPHEMERIS_TYPE: Number(line1.slice(62, 63)) || 0,
        CLASSIFICATION_TYPE: line1.slice(7, 8).trim() || "U",
        NORAD_CAT_ID: Number(line1.slice(2, 7)),
        ELEMENT_SET_NO: Number(line1.slice(64, 68)) || 0,
        REV_AT_EPOCH: Number(line2.slice(63, 68)) || 0,
        BSTAR: exponentField(line1.slice(53, 61)),
        MEAN_MOTION_DOT: Number(line1.slice(33, 43)) || 0,
        MEAN_MOTION_DDOT: exponentField(line1.slice(44, 52)),
    };

    /* Internationale Kennung "98067A  " -> "1998-067A" */
    const designator = line1.slice(9, 17).trim();
    const launch = designator.match(/^(\d{2})(\d{3})(\w*)$/);
    if (launch) {
        const year = Number(launch[1]) >= 57 ? `19${launch[1]}` : `20${launch[1]}`;
        record.OBJECT_ID = `${year}-${launch[2]}${launch[3]}`;
    }
    if (!record.OBJECT_NAME) record.OBJECT_NAME = `NORAD ${record.NORAD_CAT_ID}`;

    return isComplete(record) && Number.isFinite(record.NORAD_CAT_ID) ? record : null;
}

/* Zwei- oder Dreizeilen-Format (mit Namenszeile). */
export function parseTle(text: string): OmmRecord[] {
    const lines = text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
    const records: OmmRecord[] = [];
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (!line.startsWith("1 ")) continue;
        const next = lines[index + 1];
        if (!next?.startsWith("2 ")) continue;
        const previous = lines[index - 1];
        const name = previous && !previous.startsWith("1 ") && !previous.startsWith("2 ") ? previous : "";
        const record = tleToOmm(name, line, next);
        if (record) records.push(record);
        index++;
    }
    if (records.length === 0) {
        const head = text.trim().slice(0, 60);
        throw new Error(head ? `no TLE records: "${head}"` : "empty response");
    }
    return records;
}

/* ---------- Live-Abruf ---------- */

async function download(url: string, fetcher: typeof fetch) {
    const response = await fetcher(url, {
        cache: "no-store",
        headers: { Accept: "application/json, text/plain", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
        const detail = text.trim().slice(0, 60);
        throw new Error(`HTTP ${response.status}${detail ? ` "${detail}"` : ""}`);
    }
    return text;
}

function errorText(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export async function fetchGroupLive(source: SourceDefinition, fetcher: typeof fetch = fetch) {
    const group = encodeURIComponent(source.group);
    const attempts: { label: string; url: string; format: SourceFormat }[] = [
        { label: "JSON", url: `${CELESTRAK_GP}?GROUP=${group}&FORMAT=JSON`, format: "OMM" },
        { label: "TLE", url: `${CELESTRAK_GP}?GROUP=${group}&FORMAT=TLE`, format: "TLE" },
        ...(source.extraUrls ?? []).map((url) => ({ label: "supplemental", url, format: "OMM" as const })),
    ];
    const errors: string[] = [];

    for (const attempt of attempts) {
        try {
            const text = await download(attempt.url, fetcher);
            const records = attempt.format === "TLE" ? parseTle(text) : parseOmmJson(text);
            if (records.length === 0) throw new Error("no usable records");
            return { records, format: attempt.format };
        } catch (error) {
            errors.push(`${attempt.label}: ${errorText(error)}`);
        }
    }

    throw new Error(`CelesTrak ${source.group} unavailable (${errors.join("; ")})`);
}

/* ---------- Cache ---------- */

export function createRedisSatelliteStore(): SatelliteStore | null {
    if (!hasRadarStore()) return null;
    return {
        read: (group) => readStoredJson<GroupCacheEntry>(`sat:group:${group}`),
        write: (entry) => writeStoredJson(`sat:group:${entry.group}`, entry, CACHE_TTL_SECONDS),
        lock: (group) => acquireStoreLock(`sat:lock:${group}`, LOCK_TTL_SECONDS),
        readStatus: (group) => readStoredJson<GroupStatus>(`sat:status:${group}`),
        writeStatus: (group, status) => writeStoredJson(`sat:status:${group}`, status, CACHE_TTL_SECONDS),
    };
}

/*
 * Fehler des Speichers duerfen den Abruf nie verhindern: ohne
 * Redis wird einfach live geladen.
 */
async function quietly<T>(task: Promise<T> | undefined, fallback: T) {
    try {
        return (await task) ?? fallback;
    } catch (error) {
        console.error("SAT store error:", error);
        return fallback;
    }
}

function withSource(source: SourceDefinition, records: OmmRecord[]): SatelliteRecord[] {
    return records.map((record) => ({ ...record, category: source.category, group: source.group, groupLabel: source.label }));
}

export type LoadOptions = { store: SatelliteStore | null; fetcher?: typeof fetch; now?: number };

export async function loadGroup(source: SourceDefinition, { store, fetcher = fetch, now = Date.now() }: LoadOptions): Promise<GroupResult> {
    const cached = await quietly(store?.read(source.group), null);
    const fromCache = (entry: GroupCacheEntry, warning?: string): GroupResult => ({
        group: source.group,
        records: withSource(source, entry.records),
        fetchedAt: entry.fetchedAt,
        format: entry.format,
        origin: "cache",
        stale: now - entry.fetchedAt > STALE_AFTER_MS,
        ...(warning ? { warning } : {}),
    });

    if (cached && now - cached.fetchedAt < FRESH_MS) return fromCache(cached);

    /*
     * Laedt gerade eine andere Instanz, reichen die alten Daten.
     * Ohne Cache wird trotzdem geladen (nur beim allerersten Abruf).
     */
    const mayFetch = store ? await quietly(store.lock(source.group), true) : true;
    if (!mayFetch && cached) return fromCache(cached);

    try {
        const live = await fetchGroupLive(source, fetcher);
        const entry: GroupCacheEntry = { group: source.group, fetchedAt: now, format: live.format, records: live.records };
        if (store) {
            await quietly(store.write(entry), undefined);
            await quietly(
                store.writeStatus(source.group, { lastAttemptAt: now, lastSuccessAt: now, count: live.records.length, format: live.format, lastError: null }),
                undefined
            );
        }
        return { group: source.group, records: withSource(source, live.records), fetchedAt: now, format: live.format, origin: "live", stale: false };
    } catch (error) {
        const message = errorText(error);
        console.error("SAT live load failed:", message);
        if (store) {
            await quietly(
                store.writeStatus(source.group, {
                    lastAttemptAt: now,
                    lastSuccessAt: cached?.fetchedAt ?? null,
                    count: cached?.records.length ?? 0,
                    format: cached?.format ?? null,
                    lastError: message,
                }),
                undefined
            );
        }
        if (cached) return fromCache(cached, message);
        throw error;
    }
}

/* ---------- Antwort der API ---------- */

export type SatelliteResponse = {
    ok: boolean;
    source: string;
    groups: string[];
    availableGroups: SourceDefinition[];
    cacheSeconds: number;
    generatedAt: string;
    dataUpdatedAt: string | null;
    stale: boolean;
    failedGroups: { group: string; error: string }[];
    count: number;
    satellites: SatelliteRecord[];
    error?: string;
};

export function buildSatelliteResponse(groups: string[], settled: PromiseSettledResult<GroupResult>[], now = Date.now()): SatelliteResponse {
    const loaded: GroupResult[] = [];
    const failedGroups: { group: string; error: string }[] = [];

    settled.forEach((result, index) => {
        if (result.status === "fulfilled") loaded.push(result.value);
        else failedGroups.push({ group: groups[index], error: errorText(result.reason) });
    });

    /* Doppelte Objekte (z. B. ISS in STATIONS und VISUAL): Raumstation gewinnt. */
    const byNorad = new Map<number, SatelliteRecord>();
    for (const record of loaded.flatMap((result) => result.records)) {
        if (record.NORAD_CAT_ID == null) continue;
        const existing = byNorad.get(record.NORAD_CAT_ID);
        if (!existing || record.category === "station") byNorad.set(record.NORAD_CAT_ID, record);
    }
    const satellites = Array.from(byNorad.values()).sort((a, b) => (a.OBJECT_NAME ?? "").localeCompare(b.OBJECT_NAME ?? ""));
    const oldest = loaded.length ? Math.min(...loaded.map((result) => result.fetchedAt)) : null;

    return {
        ok: loaded.length > 0,
        source: "CelesTrak GP / OMM",
        groups,
        availableGroups: Object.values(SOURCE_DEFINITIONS).map(({ group, category, label }) => ({ group, category, label })),
        cacheSeconds: FRESH_MS / 1000,
        generatedAt: new Date(now).toISOString(),
        dataUpdatedAt: oldest == null ? null : new Date(oldest).toISOString(),
        stale: loaded.some((result) => result.stale),
        failedGroups,
        count: satellites.length,
        satellites,
        ...(loaded.length === 0 ? { error: failedGroups.map((item) => item.error).join("; ") || "Satellite data unavailable" } : {}),
    };
}
