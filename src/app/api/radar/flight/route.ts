import { NextRequest, NextResponse } from "next/server";

const AVIATIONSTACK_API =
    "https://api.aviationstack.com/v1/flights";

const ADSBDB_API =
    "https://api.adsbdb.com/v0/callsign";

type FlightResult = {
    found: boolean;
    callsign: string;
    source?: "aviationstack" | "adsbdb";

    airline?: {
        name: string | null;
        iata: string | null;
        icao: string | null;
    };

    flight?: {
        number: string | null;
        iata: string | null;
        icao: string | null;
    };

    departure?: {
        airport: string | null;
        iata: string | null;
        icao: string | null;
    };

    arrival?: {
        airport: string | null;
        iata: string | null;
        icao: string | null;
    };

    aircraft?: {
        registration: string | null;
        iata: string | null;
        icao: string | null;
    };

    status?: string | null;

    reason?: string;
};

type CacheEntry = {
    expires: number;
    value: FlightResult;
};

const globalForRadar = globalThis as unknown as {
    lumaFlightCache?: Map<string, CacheEntry>;
};

const cache =
    globalForRadar.lumaFlightCache ??
    new Map<string, CacheEntry>();

globalForRadar.lumaFlightCache =
    cache;

const CACHE_TIME =
    30 * 60 * 1000;

export async function GET(
    request: NextRequest
) {
    const callsign =
        request.nextUrl.searchParams
            .get("callsign")
            ?.trim()
            .toUpperCase();

    if (!callsign) {
        return NextResponse.json(
            {
                error: "Missing callsign",
            },
            {
                status: 400,
            }
        );
    }

    const cached =
        cache.get(callsign);

    if (
        cached &&
        cached.expires > Date.now()
    ) {
        return NextResponse.json({
            ...cached.value,
            cached: true,
        });
    }

    try {
        /*
         * 1. Aviationstack
         */
        const aviationstack =
            await lookupAviationstack(
                callsign
            );

        if (aviationstack) {
            cacheResult(
                callsign,
                aviationstack
            );

            return NextResponse.json(
                aviationstack
            );
        }

        /*
         * 2. ADSBDB fallback
         */
        const adsbdb =
            await lookupAdsbdb(
                callsign
            );

        if (adsbdb) {
            cacheResult(
                callsign,
                adsbdb
            );

            return NextResponse.json(
                adsbdb
            );
        }

        const result: FlightResult = {
            found: false,
            callsign,
            reason:
                "No verified route match",
        };

        cacheResult(
            callsign,
            result
        );

        return NextResponse.json(
            result
        );
    } catch (error) {
        console.error(
            "Flight lookup error:",
            error
        );

        return NextResponse.json(
            {
                found: false,
                callsign,
                error:
                    "Flight lookup failed",
            },
            {
                status: 500,
            }
        );
    }
}

function cacheResult(
    callsign: string,
    value: FlightResult
) {
    cache.set(
        callsign,
        {
            expires:
                Date.now() +
                CACHE_TIME,
            value,
        }
    );
}

async function lookupAviationstack(
    callsign: string
): Promise<FlightResult | null> {
    const apiKey =
        process.env.AVIATIONSTACK_API_KEY;

    if (!apiKey) {
        return null;
    }

    try {
        const params =
            new URLSearchParams({
                access_key:
                    apiKey,

                flight_icao:
                    callsign,

                limit: "100",
            });

        const response =
            await fetch(
                `${AVIATIONSTACK_API}?${params.toString()}`,
                {
                    cache:
                        "no-store",
                }
            );

        if (!response.ok) {
            return null;
        }

        const json =
            await response.json();

        const flights =
            Array.isArray(
                json.data
            )
                ? json.data
                : [];

        const candidate =
            flights.find(
                (flight: any) =>
                    flight.flight
                        ?.icao
                        ?.trim()
                        .toUpperCase() ===
                    callsign
            );

        if (!candidate) {
            return null;
        }

        return {
            found: true,

            callsign,

            source:
                "aviationstack",

            airline: {
                name:
                    candidate.airline
                        ?.name ??
                    null,

                iata:
                    candidate.airline
                        ?.iata ??
                    null,

                icao:
                    candidate.airline
                        ?.icao ??
                    null,
            },

            flight: {
                number:
                    candidate.flight
                        ?.number ??
                    null,

                iata:
                    candidate.flight
                        ?.iata ??
                    null,

                icao:
                    candidate.flight
                        ?.icao ??
                    null,
            },

            departure: {
                airport:
                    candidate.departure
                        ?.airport ??
                    null,

                iata:
                    candidate.departure
                        ?.iata ??
                    null,

                icao:
                    candidate.departure
                        ?.icao ??
                    null,
            },

            arrival: {
                airport:
                    candidate.arrival
                        ?.airport ??
                    null,

                iata:
                    candidate.arrival
                        ?.iata ??
                    null,

                icao:
                    candidate.arrival
                        ?.icao ??
                    null,
            },

            aircraft: {
                registration:
                    candidate.aircraft
                        ?.registration ??
                    null,

                iata:
                    candidate.aircraft
                        ?.iata ??
                    null,

                icao:
                    candidate.aircraft
                        ?.icao ??
                    null,
            },

            status:
                candidate.flight_status ??
                null,
        };
    } catch (error) {
        console.error(
            "Aviationstack lookup:",
            error
        );

        return null;
    }
}

async function lookupAdsbdb(
    callsign: string
): Promise<FlightResult | null> {
    try {
        const response =
            await fetch(
                `${ADSBDB_API}/${encodeURIComponent(
                    callsign
                )}`,
                {
                    cache:
                        "no-store",

                    headers: {
                        Accept:
                            "application/json",

                        "User-Agent":
                            "LuMa-Radar/1.0",
                    },
                }
            );

        if (!response.ok) {
            return null;
        }

        const json =
            await response.json();

        const route =
            json?.response
                ?.flightroute;

        if (!route) {
            return null;
        }

        const origin =
            route.origin;

        const destination =
            route.destination;

        if (
            !origin ||
            !destination
        ) {
            return null;
        }

        return {
            found: true,

            callsign,

            source:
                "adsbdb",

            airline: {
                name:
                    route.airline
                        ?.name ??
                    null,

                iata:
                    route.airline
                        ?.iata ??
                    null,

                icao:
                    route.airline
                        ?.icao ??
                    null,
            },

            flight: {
                number:
                    null,

                iata:
                    route.callsign_iata ??
                    null,

                icao:
                    route.callsign_icao ??
                    callsign,
            },

            departure: {
                airport:
                    origin.name ??
                    origin.municipality ??
                    null,

                iata:
                    origin.iata_code ??
                    null,

                icao:
                    origin.icao_code ??
                    null,
            },

            arrival: {
                airport:
                    destination.name ??
                    destination.municipality ??
                    null,

                iata:
                    destination.iata_code ??
                    null,

                icao:
                    destination.icao_code ??
                    null,
            },

            status:
                "airborne",
        };
    } catch (error) {
        console.error(
            "ADSBDB lookup:",
            error
        );

        return null;
    }
}