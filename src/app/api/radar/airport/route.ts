import {
    NextRequest,
    NextResponse,
} from "next/server";

const API =
    "https://api.aviationstack.com/v1/airports";

type AirportResult = {
    found: boolean;
    icao?: string;
    iata?: string | null;
    name?: string | null;
    latitude?: number;
    longitude?: number;
    country?: string | null;
};

type CacheEntry = {
    expires: number;
    value: AirportResult;
};

const globalForRadar = globalThis as unknown as {
    lumaAirportCache?: Map<
        string,
        CacheEntry
    >;
};

const cache =
    globalForRadar.lumaAirportCache ??
    new Map<string, CacheEntry>();

globalForRadar.lumaAirportCache =
    cache;

/*
 * Airport-Koordinaten ändern sich praktisch nie.
 * Deshalb 7 Tage cachen.
 */
const CACHE_TIME =
    7 * 24 * 60 * 60 * 1000;

export async function GET(
    request: NextRequest
) {
    const icao =
        request.nextUrl.searchParams
            .get("icao")
            ?.trim()
            .toUpperCase();

    if (!icao) {
        return NextResponse.json(
            {
                error:
                    "Missing airport ICAO",
            },
            { status: 400 }
        );
    }

    const cached =
        cache.get(icao);

    if (
        cached &&
        cached.expires > Date.now()
    ) {
        return NextResponse.json({
            ...cached.value,
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
        const params =
            new URLSearchParams({
                access_key: apiKey,
                icao_code: icao,
            });

        const response =
            await fetch(
                `${API}?${params.toString()}`,
                {
                    cache: "no-store",
                }
            );

        if (!response.ok) {
            return NextResponse.json(
                {
                    error:
                        `Airport lookup returned ${response.status}`,
                },
                {
                    status:
                        response.status,
                }
            );
        }

        const json =
            await response.json();

        const airport =
            Array.isArray(json.data)
                ? json.data[0]
                : null;

        if (!airport) {
            const result: AirportResult =
            {
                found: false,
                icao,
            };

            cache.set(icao, {
                expires:
                    Date.now() +
                    CACHE_TIME,
                value: result,
            });

            return NextResponse.json(
                result
            );
        }

        const latitude =
            Number(airport.latitude);

        const longitude =
            Number(airport.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return NextResponse.json({
                found: false,
                icao,
            });
        }

        const result: AirportResult = {
            found: true,
            icao:
                airport.icao_code ??
                icao,
            iata:
                airport.iata_code ??
                null,
            name:
                airport.airport_name ??
                null,
            latitude,
            longitude,
            country:
                airport.country_name ??
                null,
        };

        cache.set(icao, {
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
            "Airport lookup:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Airport lookup failed",
            },
            { status: 500 }
        );
    }
}