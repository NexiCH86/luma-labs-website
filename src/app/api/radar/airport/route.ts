import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type RunwayRecord = {
    id?: string | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    surface?: string | null;
    lighted?: boolean;
    leIdent?: string | null;
    leHeading?: number | null;
    leElevationFt?: number | null;
    leDisplacedThresholdFt?: number | null;
    heIdent?: string | null;
    heHeading?: number | null;
    heElevationFt?: number | null;
    heDisplacedThresholdFt?: number | null;
};

type FrequencyRecord = {
    type?: string | null;
    description?: string | null;
    frequencyMhz: number;
};

type AirportRecord = {
    icao?: string | null;
    iata?: string | null;
    ident?: string | null;
    name?: string | null;
    latitude: number;
    longitude: number;
    elevationFt?: number | null;
    country?: string | null;
    countryIso?: string | null;
    city?: string | null;
    region?: string | null;
    type?: string | null;
    scheduledService?: boolean;
    wikipedia?: string | null;
    website?: string | null;
    runways?: RunwayRecord[];
    frequencies?: FrequencyRecord[];
};

type AirportResult = AirportRecord & {
    found: boolean;
    timezone?: string | null;
    gmt?: string | null;
    source?: "OurAirports";
    reason?: string;
};

type CacheEntry = { expires: number; value: AirportResult };
const globalForRadar = globalThis as unknown as { lumaAirportCache?: Map<string, CacheEntry> };
const cache = globalForRadar.lumaAirportCache ?? new Map<string, CacheEntry>();
globalForRadar.lumaAirportCache = cache;
const CACHE_TIME = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
    const legacyIcao = request.nextUrl.searchParams.get("icao")?.trim().toUpperCase();
    const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? legacyIcao;

    if (!code || !/^[A-Z0-9]{3,4}$/.test(code)) {
        return NextResponse.json({ error: "Missing or invalid airport code" }, { status: 400 });
    }

    const cached = cache.get(code);
    if (cached && cached.expires > Date.now()) {
        return NextResponse.json({ ...cached.value, cached: true });
    }

    try {
        const kind = code.length === 3 ? "iata" : "icao";
        const shard = code[0].toUpperCase();
        const filePath = path.join(process.cwd(), "public", "data", "ourairports", kind, `${shard}.json`);
        const raw = await readFile(filePath, "utf8");
        const records = JSON.parse(raw) as Record<string, AirportRecord>;
        const airport = records[code];

        if (!airport) {
            const result: AirportResult = {
                found: false,
                latitude: 0,
                longitude: 0,
                ...(code.length === 3 ? { iata: code } : { icao: code }),
                source: "OurAirports",
            };
            cache.set(code, { expires: Date.now() + CACHE_TIME, value: result });
            return NextResponse.json(result);
        }

        const result: AirportResult = {
            found: true,
            icao: airport.icao ?? null,
            iata: airport.iata ?? null,
            ident: airport.ident ?? null,
            name: airport.name ?? null,
            latitude: airport.latitude,
            longitude: airport.longitude,
            elevationFt: airport.elevationFt ?? null,
            country: airport.country ?? null,
            countryIso: airport.countryIso ?? null,
            city: airport.city ?? null,
            region: airport.region ?? null,
            type: airport.type ?? null,
            scheduledService: airport.scheduledService ?? false,
            wikipedia: airport.wikipedia ?? null,
            website: airport.website ?? null,
            runways: Array.isArray(airport.runways) ? airport.runways : [],
            frequencies: Array.isArray(airport.frequencies) ? airport.frequencies : [],
            timezone: null,
            gmt: null,
            source: "OurAirports",
        };

        cache.set(code, { expires: Date.now() + CACHE_TIME, value: result });
        return NextResponse.json(result);
    } catch (error) {
        const codeValue = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (codeValue === "ENOENT") {
            return NextResponse.json({ found: false, error: "OurAirports data not synced. Run npm run radar:sync-airports.", reason: "OurAirports metadata not synced" }, { status: 503 });
        }
        console.error("OurAirports lookup:", error);
        return NextResponse.json({ error: "Airport lookup failed" }, { status: 500 });
    }
}
