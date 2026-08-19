import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const AVIATIONSTACK_API =
    "https://api.aviationstack.com/v1/flights";

const ADSBDB_CALLSIGN_API =
    "https://api.adsbdb.com/v0/callsign";

const ADSBDB_AIRCRAFT_API =
    "https://api.adsbdb.com/v0/aircraft";

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

type AircraftMetadata = {
    type: string | null;
    icaoType: string | null;
    manufacturer: string | null;
    registration: string | null;
    owner: string | null;
    ownerCountry: string | null;
    photo: string | null;
    thumbnail: string | null;
};

type RadarAircraft = {
    icao24: string;
    callsign: string;
};

type RadarSnapshot = {
    aircraft?: RadarAircraft[];
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

function getRedis() {
    const url =
        process.env.RADAR_REDIS_KV_REST_API_URL;

    const token =
        process.env.RADAR_REDIS_KV_REST_API_TOKEN;

    if (!url || !token) {
        return null;
    }

    return new Redis({
        url,
        token,
    });
}

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
        const icao24 =
            await getIcao24ForCallsign(
                callsign
            );

        const aircraftMetadata =
            icao24
                ? await lookupAircraftMetadata(
                    icao24
                )
                : null;

        const aviationstack =
            await lookupAviationstack(
                callsign
            );

        if (aviationstack) {
            const enriched =
                applyAircraftMetadata(
                    aviationstack,
                    aircraftMetadata
                );

            cacheResult(
                callsign,
                enriched
            );

            return NextResponse.json(
                enriched
            );
        }

        const adsbdb =
            await lookupAdsbdb(
                callsign
            );

        if (adsbdb) {
            const enriched =
                applyAircraftMetadata(
                    adsbdb,
                    aircraftMetadata
                );

            cacheResult(
                callsign,
                enriched
            );

            return NextResponse.json(
                enriched
            );
        }

        if (aircraftMetadata) {
            const aircraftOnly: FlightResult = {
                found: false,
                callsign,
                aircraft:
                    aircraftForClient(
                        aircraftMetadata
                    ),
                reason:
                    "Aircraft identified, route unavailable",
            };

            cacheResult(
                callsign,
                aircraftOnly
            );

            return NextResponse.json(
                aircraftOnly
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

async function getIcao24ForCallsign(
    callsign: string
): Promise<string | null> {
    try {
        const redis =
            getRedis();

        if (!redis) {
            return null;
        }

        const snapshot =
            await redis.get<RadarSnapshot>(
                "radar:snapshot"
            );

        const aircraft =
            snapshot?.aircraft?.find(
                (item) =>
                    item.callsign
                        ?.trim()
                        .toUpperCase() ===
                    callsign
            );

        return aircraft?.icao24
            ?.trim()
            .toUpperCase() ??
            null;
    } catch (error) {
        console.error(
            "Radar aircraft lookup:",
            error
        );

        return null;
    }
}

async function lookupAircraftMetadata(
    icao24: string
): Promise<AircraftMetadata | null> {
    try {
        const response =
            await fetch(
                `${ADSBDB_AIRCRAFT_API}/${encodeURIComponent(
                    icao24
                )}`,
                {
                    cache: "no-store",
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

        const aircraft =
            json?.response
                ?.aircraft;

        if (!aircraft) {
            return null;
        }

        return {
            type:
                aircraft.type ??
                null,
            icaoType:
                aircraft.icao_type ??
                null,
            manufacturer:
                aircraft.manufacturer ??
                null,
            registration:
                aircraft.registration ??
                null,
            owner:
                aircraft.registered_owner ??
                null,
            ownerCountry:
                aircraft.registered_owner_country_name ??
                null,
            photo:
                aircraft.url_photo ??
                null,
            thumbnail:
                aircraft.url_photo_thumbnail ??
                null,
        };
    } catch (error) {
        console.error(
            "ADSBDB aircraft lookup:",
            error
        );

        return null;
    }
}

function aircraftForClient(
    metadata: AircraftMetadata
) {
    const displayType =
        [
            metadata.manufacturer,
            metadata.type,
        ]
            .filter(Boolean)
            .join(" ") ||
        metadata.icaoType ||
        null;

    return {
        registration:
            metadata.registration,
        iata: null,
        icao:
            displayType,
    };
}

function applyAircraftMetadata(
    result: FlightResult,
    metadata: AircraftMetadata | null
): FlightResult {
    if (!metadata) {
        return result;
    }

    const enriched =
        aircraftForClient(
            metadata
        );

    return {
        ...result,
        aircraft: {
            registration:
                enriched.registration ??
                result.aircraft
                    ?.registration ??
                null,
            iata:
                result.aircraft
                    ?.iata ??
                null,
            icao:
                enriched.icao ??
                result.aircraft
                    ?.icao ??
                null,
        },
    };
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
                `${ADSBDB_CALLSIGN_API}/${encodeURIComponent(
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
                number: null,
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
