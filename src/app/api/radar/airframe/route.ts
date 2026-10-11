import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { fetchTrace } from "@/lib/adsb-trace";

type OpenSkyRecord = {
    registration?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    typeCode?: string | null;
    serialNumber?: string | null;
    lineNumber?: string | null;
    icaoAircraftType?: string | null;
    operator?: string | null;
    operatorCallsign?: string | null;
    operatorIcao?: string | null;
    operatorIata?: string | null;
    owner?: string | null;
    registered?: string | null;
    regUntil?: string | null;
    status?: string | null;
    built?: string | null;
    firstFlightDate?: string | null;
    seatConfiguration?: string | null;
    engines?: string | null;
    categoryDescription?: string | null;
};

type Shard = Record<string, OpenSkyRecord>;

/*
 * Stammdaten aendern sich nur mit einem neuen Build.
 */
const AIRFRAME_CACHE =
    "public, max-age=3600, s-maxage=86400";

/*
 * Entpackte Shards pro Function-Instanz. Im Schweizer
 * Ausschnitt kommen nur wenige Praefixe vor.
 */
const MAX_CACHED_SHARDS = 24;
const shardCache = new Map<string, Shard | null>();

async function loadShard(
    prefix: string
): Promise<Shard | null> {
    if (shardCache.has(prefix)) {
        const cached = shardCache.get(prefix) ?? null;

        // Als zuletzt benutzt markieren.
        shardCache.delete(prefix);
        shardCache.set(prefix, cached);

        return cached;
    }

    const filePath = path.join(
        process.cwd(),
        "public",
        "data",
        "opensky-aircraft",
        `${prefix}.json.gz`
    );

    let shard: Shard | null;

    try {
        shard = JSON.parse(
            gunzipSync(
                await readFile(filePath)
            ).toString("utf8")
        ) as Shard;
    } catch (error) {
        const code =
            error &&
            typeof error === "object" &&
            "code" in error
                ? String(error.code)
                : "";

        if (code !== "ENOENT") {
            throw error;
        }

        /*
         * Fuer diesen Praefix gibt es keine Flugzeuge in der
         * OpenSky-Datenbank.
         */
        shard = null;
    }

    shardCache.set(prefix, shard);

    if (shardCache.size > MAX_CACHED_SHARDS) {
        const oldest =
            shardCache.keys().next().value;

        if (oldest !== undefined) {
            shardCache.delete(oldest);
        }
    }

    return shard;
}

/*
 * adsb.lol-Daten gibt es nur, solange das Flugzeug fliegt: kuerzer cachen.
 */
const AIRFRAME_FALLBACK_CACHE =
    "public, max-age=3600, s-maxage=21600";

const AIRFRAME_MISS_CACHE =
    "public, max-age=600, s-maxage=1800";

async function adsbAirframe(
    icao24: string
) {
    try {
        const trace =
            await fetchTrace(icao24, "recent");

        if (!trace?.r && !trace?.t) {
            return null;
        }

        const yearBuilt =
            yearFromDate(trace.year);

        return {
            found: true,
            icao24,
            source: "adsb.lol",
            registration: trace.r ?? null,
            typeCode: trace.t ?? null,
            model: trace.desc ?? null,
            operator: trace.ownOp ?? null,
            built: trace.year ?? null,
            yearBuilt,
            ageYears:
                yearBuilt != null
                    ? Math.max(0, new Date().getFullYear() - yearBuilt)
                    : null,
        };
    } catch {
        return null;
    }
}

function yearFromDate(value?: string | null) {
    if (!value) return null;

    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
}

export async function GET(
    request: NextRequest
) {
    const icao24 =
        request.nextUrl.searchParams
            .get("icao24")
            ?.trim()
            .toLowerCase();

    if (!icao24 || !/^[0-9a-f]{6}$/.test(icao24)) {
        return NextResponse.json(
            {
                found: false,
                error: "Invalid ICAO24",
            },
            {
                status: 400,
            }
        );
    }

    const prefix = icao24.slice(0, 2);
    const suffix = icao24.slice(2);

    try {
        const shard =
            await loadShard(prefix);

        const record =
            shard?.[suffix];

        if (!record) {
            /*
             * Nicht in der OpenSky-Datenbank (Stand 11/2024):
             * Stammdaten aus dem Flugverlauf von adsb.lol.
             */
            // lite=1: Massenabfragen (Kategorie-Filter) ohne adsb.lol.
            const lite =
                request.nextUrl.searchParams.get("lite") === "1";

            const fallback =
                lite ? null : await adsbAirframe(icao24);

            return NextResponse.json(
                fallback ?? {
                    found: false,
                    icao24,
                    source: "OpenSky",
                },
                {
                    headers: {
                        "Cache-Control":
                            fallback
                                ? AIRFRAME_FALLBACK_CACHE
                                : AIRFRAME_MISS_CACHE,
                    },
                }
            );
        }

        const yearBuilt =
            yearFromDate(record.built);

        return NextResponse.json(
            {
                found: true,
                icao24,
                source: "OpenSky",
                ...record,
                yearBuilt,
                ageYears:
                    yearBuilt != null
                        ? Math.max(
                            0,
                            new Date().getFullYear() - yearBuilt
                        )
                        : null,
            },
            {
                headers: {
                    "Cache-Control":
                        AIRFRAME_CACHE,
                },
            }
        );
    } catch (error) {
        console.error(
            "OpenSky airframe lookup error:",
            error
        );

        return NextResponse.json(
            {
                found: false,
                icao24,
                error:
                    "OpenSky airframe lookup failed",
            },
            {
                status: 500,
            }
        );
    }
}
