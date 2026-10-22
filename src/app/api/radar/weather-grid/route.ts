import { NextResponse } from "next/server";

/*
 * Weltweites Wetter-Raster fuer die Erdansicht des STARS-Modus:
 * 12°-Raster (Breite -84..84, Laenge -180..168, 450 Punkte), stuendlich
 * fuer die naechsten 12 Stunden: Bewoelkung, Niederschlag, Wind (Tempo,
 * Richtung), Boeen, Temperatur.
 *
 * Quelle: Open-Meteo (frei fuer nicht-kommerzielle Nutzung, 10'000
 * Aufrufe/Tag und 600/Minute; ein Punkt zaehlt als Aufruf). 120 Punkte
 * je Anfrage, Ergebnis 3 Stunden im Daten-Cache und im CDN -> rund
 * 3'600 Aufrufe pro Tag, egal wie viele Besucher.
 */

const STEP = 12;
const LATS = Array.from({ length: 15 }, (_, i) => -84 + i * STEP);
const LONS = Array.from({ length: 30 }, (_, i) => -180 + i * STEP);
const HOURS = 12;
const CHUNK = 120;
const VARIABLES = ["cloud_cover", "precipitation", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "temperature_2m"] as const;

type OpenMeteoPoint = { hourly?: Partial<Record<(typeof VARIABLES)[number] | "time", (number | null)[]>> };

export async function GET() {
    const points = LATS.flatMap((lat) => LONS.map((lon) => ({ lat, lon })));
    const fields: Record<(typeof VARIABLES)[number], number[]> = Object.fromEntries(VARIABLES.map((name) => [name, new Array(points.length * HOURS).fill(0)])) as Record<(typeof VARIABLES)[number], number[]>;
    let times: number[] = [];

    try {
        for (let start = 0; start < points.length; start += CHUNK) {
            const chunk = points.slice(start, start + CHUNK);
            const params = new URLSearchParams({
                latitude: chunk.map((point) => point.lat).join(","),
                longitude: chunk.map((point) => point.lon).join(","),
                hourly: VARIABLES.join(","),
                forecast_hours: String(HOURS),
                timeformat: "unixtime",
                timezone: "GMT",
            });
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
                next: { revalidate: 10800 },
                headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" },
            });
            if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
            const data = (await response.json()) as OpenMeteoPoint[] | OpenMeteoPoint;
            const list = Array.isArray(data) ? data : [data];
            list.forEach((point, offset) => {
                const index = start + offset;
                if (!times.length && point.hourly?.time) times = (point.hourly.time as number[]).map((seconds) => seconds * 1000);
                for (const name of VARIABLES) {
                    const values = point.hourly?.[name] ?? [];
                    for (let hour = 0; hour < HOURS; hour++) {
                        // Layout: [Stunde][Punkt], Punkte zeilenweise von Sued nach Nord.
                        fields[name][hour * points.length + index] = Math.round((values[hour] ?? 0) * 10) / 10;
                    }
                }
            });
        }

        return NextResponse.json(
            {
                ok: true,
                generatedAt: new Date().toISOString(),
                lats: LATS,
                lons: LONS,
                times,
                fields: {
                    cloud: fields.cloud_cover,
                    precipitation: fields.precipitation,
                    wind: fields.wind_speed_10m,
                    direction: fields.wind_direction_10m,
                    gusts: fields.wind_gusts_10m,
                    temperature: fields.temperature_2m,
                },
                units: { wind: "km/h", gusts: "km/h", precipitation: "mm/h", temperature: "°C", cloud: "%" },
                attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
            },
            { headers: { "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=10800" } }
        );
    } catch (error) {
        console.error("STARS weather-grid error:", error);
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Weather grid unavailable" }, { status: 502 });
    }
}
