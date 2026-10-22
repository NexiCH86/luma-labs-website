import { NextRequest, NextResponse } from "next/server";

/*
 * Zeitzone und Bewoelkung fuer einen Standort (STARS-Modus).
 *
 * Quelle: Open-Meteo (https://open-meteo.com), stuendliche Vorhersage
 * fuer 3 Tage. Der Standort wird auf 0,1° gerundet, damit sich Besucher
 * in der Naehe die CDN-Antwort teilen (30 min Cache). Hinweis: Die freie
 * API ist fuer nicht-kommerzielle Nutzung gedacht (bis 10'000 Aufrufe/Tag).
 */

type OpenMeteoResponse = {
    timezone?: string;
    utc_offset_seconds?: number;
    hourly?: {
        time?: number[];
        cloud_cover?: (number | null)[];
        cloud_cover_low?: (number | null)[];
        cloud_cover_mid?: (number | null)[];
        cloud_cover_high?: (number | null)[];
        visibility?: (number | null)[];
        relative_humidity_2m?: (number | null)[];
    };
};

const round = (value: number) => Math.round(value * 10) / 10;

export async function GET(request: NextRequest) {
    const lat = Number(request.nextUrl.searchParams.get("lat"));
    const lon = Number(request.nextUrl.searchParams.get("lon"));

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return NextResponse.json({ ok: false, error: "Use lat and lon." }, { status: 400 });
    }

    const params = new URLSearchParams({
        latitude: String(round(lat)),
        longitude: String(round(lon)),
        hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,relative_humidity_2m",
        timezone: "auto",
        timeformat: "unixtime",
        forecast_days: "3",
    });

    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
            next: { revalidate: 1800 },
            headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" },
        });

        if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

        const data = (await response.json()) as OpenMeteoResponse;
        const hourly = data.hourly ?? {};

        return NextResponse.json(
            {
                ok: true,
                timezone: data.timezone ?? "UTC",
                utcOffsetSeconds: data.utc_offset_seconds ?? 0,
                hourly: {
                    time: (hourly.time ?? []).map((seconds) => seconds * 1000),
                    cloud: hourly.cloud_cover ?? [],
                    low: hourly.cloud_cover_low ?? [],
                    mid: hourly.cloud_cover_mid ?? [],
                    high: hourly.cloud_cover_high ?? [],
                    visibility: hourly.visibility ?? [],
                    humidity: hourly.relative_humidity_2m ?? [],
                },
                attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
            },
            { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
        );
    } catch (error) {
        console.error("STARS sky-weather error:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Weather unavailable" },
            { status: 502 }
        );
    }
}
