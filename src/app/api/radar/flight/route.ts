import { NextRequest, NextResponse } from "next/server";

const API = "https://api.aviationstack.com/v1/flights";

type CacheEntry = {
    expires: number;
    value: unknown;
};

const globalForRadar = globalThis as unknown as {
    lumaFlightCache?: Map<string, CacheEntry>;
};

const cache =
    globalForRadar.lumaFlightCache ??
    new Map<string, CacheEntry>();

globalForRadar.lumaFlightCache = cache;

const CACHE_TIME = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
    const callsign = request.nextUrl.searchParams
        .get("callsign")
        ?.trim()
        .toUpperCase();

    if (!callsign) {
        return NextResponse.json(
            { error: "Missing callsign" },
            { status: 400 }
        );
    }

    const cached = cache.get(callsign);

    if (cached && cached.expires > Date.now()) {
        return NextResponse.json({
            ...(cached.value as object),
            cached: true,
        });
    }

    const apiKey =
        process.env.AVIATIONSTACK_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            {
                error:
                    "AVIATIONSTACK_API_KEY missing",
            },
            { status: 500 }
        );
    }

    try {
        const params = new URLSearchParams({
            access_key: apiKey,
            flight_icao: callsign,
            limit: "100",
        });

        const response = await fetch(
            `${API}?${params.toString()}`,
            {
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return NextResponse.json(
                {
                    error:
                        `Aviationstack returned ${response.status}`,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        const json = await response.json();

        const flights =
            Array.isArray(json.data)
                ? json.data
                : [];

        const candidate =
            flights.find(
                (flight: any) =>
                    flight.flight?.icao
                        ?.trim()
                        .toUpperCase() ===
                    callsign
            );

        if (!candidate) {
            const result = {
                found: false,
                callsign,
                reason:
                    "No exact Aviationstack ICAO match",
            };

            cache.set(callsign, {
                expires:
                    Date.now() +
                    CACHE_TIME,
                value: result,
            });

            return NextResponse.json(
                result
            );
        }

        const result = {
            found: true,

            callsign,

            airline: {
                name:
                    candidate.airline?.name ??
                    null,

                iata:
                    candidate.airline?.iata ??
                    null,

                icao:
                    candidate.airline?.icao ??
                    null,
            },

            flight: {
                number:
                    candidate.flight?.number ??
                    null,

                iata:
                    candidate.flight?.iata ??
                    null,

                icao:
                    candidate.flight?.icao ??
                    null,
            },

            departure: {
                airport:
                    candidate.departure
                        ?.airport ?? null,

                iata:
                    candidate.departure
                        ?.iata ?? null,

                icao:
                    candidate.departure
                        ?.icao ?? null,

                terminal:
                    candidate.departure
                        ?.terminal ?? null,

                gate:
                    candidate.departure
                        ?.gate ?? null,

                scheduled:
                    candidate.departure
                        ?.scheduled ?? null,

                actual:
                    candidate.departure
                        ?.actual ?? null,
            },

            arrival: {
                airport:
                    candidate.arrival
                        ?.airport ?? null,

                iata:
                    candidate.arrival
                        ?.iata ?? null,

                icao:
                    candidate.arrival
                        ?.icao ?? null,

                terminal:
                    candidate.arrival
                        ?.terminal ?? null,

                gate:
                    candidate.arrival
                        ?.gate ?? null,

                scheduled:
                    candidate.arrival
                        ?.scheduled ?? null,

                estimated:
                    candidate.arrival
                        ?.estimated ?? null,
            },

            aircraft: {
                registration:
                    candidate.aircraft
                        ?.registration ?? null,

                iata:
                    candidate.aircraft
                        ?.iata ?? null,

                icao:
                    candidate.aircraft
                        ?.icao ?? null,
            },

            status:
                candidate.flight_status ??
                null,
        };

        cache.set(callsign, {
            expires:
                Date.now() +
                CACHE_TIME,
            value: result,
        });

        return NextResponse.json(
            result
        );
    } catch (error) {
        console.error(
            "Aviationstack lookup:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Flight lookup failed",
            },
            { status: 500 }
        );
    }
}