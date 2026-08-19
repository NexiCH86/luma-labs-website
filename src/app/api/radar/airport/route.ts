import {
    NextRequest,
    NextResponse,
} from "next/server";

const API =
    "https://api.aviationstack.com/v1/airports";

type AirportResult = {
    found: boolean;
    icao?: string | null;
    iata?: string | null;
    name?: string | null;
    latitude?: number;
    longitude?: number;
    country?: string | null;
    city?: string | null;
    timezone?: string | null;
    gmt?: string | null;
    source?: "aviationstack";
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

const CACHE_TIME =
    7 * 24 * 60 * 60 * 1000;

export async function GET(
    request: NextRequest
) {
    const legacyIcao =
        request.nextUrl.searchParams
            .get("icao")
            ?.trim()
            .toUpperCase();

    const code =
        request.nextUrl.searchParams
            .get("code")
            ?.trim()
            .toUpperCase() ??
        legacyIcao;

    if (
        !code ||
        !/^[A-Z0-9]{3,4}$/.test(code)
    ) {
        return NextResponse.json(
            {
                error:
                    "Missing or invalid airport code",
            },
            { status: 400 }
        );
    }

    const cacheKey =
        code;

    const cached =
        cache.get(cacheKey);

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
            });

        if (code.length === 3) {
            params.set(
                "iata_code",
                code
            );
        } else {
            params.set(
                "icao_code",
                code
            );
        }

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

        const airports =
            Array.isArray(json.data)
                ? json.data
                : [];

        const airport =
            airports.find(
                (candidate: any) =>
                    code.length === 3
                        ? candidate.iata_code
                            ?.trim()
                            .toUpperCase() ===
                            code
                        : candidate.icao_code
                            ?.trim()
                            .toUpperCase() ===
                            code
            ) ??
            airports[0] ??
            null;

        if (!airport) {
            const result: AirportResult = {
                found: false,
                ...(code.length === 3
                    ? { iata: code }
                    : { icao: code }),
            };

            cache.set(
                cacheKey,
                {
                    expires:
                        Date.now() +
                        CACHE_TIME,
                    value: result,
                }
            );

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
                ...(code.length === 3
                    ? { iata: code }
                    : { icao: code }),
            });
        }

        const result: AirportResult = {
            found: true,
            icao:
                airport.icao_code ??
                null,
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
            city:
                airport.city_iata_code ??
                null,
            timezone:
                airport.timezone ??
                null,
            gmt:
                airport.gmt ??
                null,
            source:
                "aviationstack",
        };

        cache.set(
            cacheKey,
            {
                expires:
                    Date.now() +
                    CACHE_TIME,
                value: result,
            }
        );

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
