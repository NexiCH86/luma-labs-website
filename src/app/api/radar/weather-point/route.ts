import { NextRequest, NextResponse } from "next/server";

/*
 * Aktuelles Wetter an einem Punkt (Klick auf die Weltkarte im STARS-
 * Modus): Temperatur, Wind, Boeen, Bewoelkung, Niederschlag, Wettercode.
 * Quelle: Open-Meteo, Punkt auf 0,1° gerundet, 15 min Cache.
 */
const CURRENT = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day";

const round = (value: number) => Math.round(value * 10) / 10;

export async function GET(request: NextRequest) {
    const lat = Number(request.nextUrl.searchParams.get("lat"));
    const lon = Number(request.nextUrl.searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return NextResponse.json({ ok: false, error: "Use lat and lon." }, { status: 400 });
    }

    try {
        const params = new URLSearchParams({ latitude: String(round(lat)), longitude: String(round(lon)), current: CURRENT, timezone: "auto" });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
            next: { revalidate: 900 },
            headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" },
        });
        if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
        const data = (await response.json()) as { timezone?: string; elevation?: number; current?: Record<string, number> };
        return NextResponse.json(
            { ok: true, lat: round(lat), lon: round(lon), timezone: data.timezone ?? "UTC", elevation: data.elevation ?? null, current: data.current ?? {}, attribution: "Weather data by Open-Meteo.com (CC BY 4.0)" },
            { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
        );
    } catch (error) {
        console.error("STARS weather-point error:", error);
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Weather unavailable" }, { status: 502 });
    }
}
