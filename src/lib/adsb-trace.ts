/*
 * Flugverlaeufe von adsb.lol (readsb-"globe"-Format).
 *
 *   trace_recent_<hex>.json  ~20 KB, letzte Minuten, aktuell
 *   trace_full_<hex>.json    ganzer Tag, bis ca. 20 min verzoegert
 *
 * Beide enthalten im Kopf auch Registration (r), Typcode (t) und
 * Klartext-Beschreibung (desc).
 */
const BASE = "https://globe.adsb.lol/data/traces";

const FEET_TO_METERS = 0.3048;
const KNOTS_TO_MPS = 0.514444;

export type AdsbTraceFile = {
    icao?: string;
    r?: string;
    t?: string;
    desc?: string;
    ownOp?: string;
    year?: string;
    timestamp: number;
    // [Sekunden seit timestamp, lat, lon, Hoehe ft | "ground", Speed kt, Kurs, ...]
    trace: [number, number, number, number | "ground" | null, number | null, number | null, ...unknown[]][];
};

export type TracePoint = {
    latitude: number;
    longitude: number;
    altitude: number | null;
    heading: number | null;
    velocity: number | null;
    timestamp: number;
};

export async function fetchTrace(
    icao24: string,
    kind: "recent" | "full"
): Promise<AdsbTraceFile | null> {
    const hex = icao24.toLowerCase();

    const response = await fetch(
        `${BASE}/${hex.slice(-2)}/trace_${kind}_${hex}.json`,
        {
            headers: { "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" },
            signal: AbortSignal.timeout(8_000),
            cache: "no-store",
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`adsb.lol trace ${response.status}`);
    }

    return (await response.json()) as AdsbTraceFile;
}

export function tracePoints(file: AdsbTraceFile | null): TracePoint[] {
    if (!file?.trace?.length) {
        return [];
    }

    return file.trace
        .filter(([, lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
        .map(([offset, latitude, longitude, altitudeFt, speedKt, heading]) => ({
            latitude,
            longitude,
            altitude:
                altitudeFt === "ground"
                    ? 0
                    : typeof altitudeFt === "number"
                      ? Math.round(altitudeFt * FEET_TO_METERS)
                      : null,
            heading: typeof heading === "number" ? Math.round(heading) : null,
            velocity: typeof speedKt === "number" ? Math.round(speedKt * KNOTS_TO_MPS) : null,
            timestamp: Math.round((file.timestamp + offset) * 1000),
        }));
}
