import { NextRequest, NextResponse } from "next/server";
import { json2satrec } from "satellite.js";
import { createSkyFrame, moonInfo, nightFor } from "@/app/radar/stars/astro";
import { solarSystemObjects } from "@/app/radar/stars/sky-catalog";
import { predictPasses, type SatelliteEntry } from "@/app/radar/stars/satellites";
import { nightScore, type SkyWeather } from "@/app/radar/stars/score";

/*
 * Kompakter Himmelsstatus fuer den Home Status Screen und andere
 * Anzeigen: Mondphase, Daemmerung/Dunkelzeit, naechster sichtbarer
 * ISS-Ueberflug und Beobachtungs-Score fuer heute Nacht.
 *
 *   GET /api/radar/stars-status?lat=47.3769&lon=8.5417
 *
 * Standort auf 0,1° gerundet, 10 min CDN-Cache.
 */

const ISS_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON";
const round = (value: number) => Math.round(value * 10) / 10;

async function loadIss(): Promise<SatelliteEntry | null> {
    try {
        const response = await fetch(ISS_URL, { next: { revalidate: 7200 }, headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/2.0 (lumalabs.ch)" } });
        if (!response.ok) return null;
        const [record] = (await response.json()) as Record<string, unknown>[];
        if (!record) return null;
        return { id: "sat-25544", norad: 25544, name: "ISS", category: "station", satrec: json2satrec(record as unknown as Parameters<typeof json2satrec>[0]) };
    } catch {
        return null;
    }
}

async function loadWeather(lat: number, lon: number): Promise<SkyWeather | null> {
    try {
        const params = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon),
            hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,relative_humidity_2m",
            timezone: "auto",
            timeformat: "unixtime",
            forecast_days: "2",
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { next: { revalidate: 1800 } });
        if (!response.ok) return null;
        const data = (await response.json()) as { timezone?: string; hourly?: Record<string, (number | null)[]> };
        const hourly = data.hourly ?? {};
        return {
            timezone: data.timezone ?? "UTC",
            hourly: {
                time: ((hourly.time ?? []) as number[]).map((seconds) => seconds * 1000),
                cloud: hourly.cloud_cover ?? [],
                low: hourly.cloud_cover_low ?? [],
                mid: hourly.cloud_cover_mid ?? [],
                high: hourly.cloud_cover_high ?? [],
                visibility: hourly.visibility ?? [],
                humidity: hourly.relative_humidity_2m ?? [],
            },
        };
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const lat = Number(request.nextUrl.searchParams.get("lat") ?? 47.3769);
    const lon = Number(request.nextUrl.searchParams.get("lon") ?? 8.5417);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return NextResponse.json({ ok: false, error: "Use lat and lon." }, { status: 400 });
    }

    const observer = { lat: round(lat), lon: round(lon) };
    const now = new Date();
    const night = nightFor(now, observer);
    const moon = moonInfo(now);
    const sunAltitudeAt = (date: Date) => {
        const sun = solarSystemObjects(date, observer).find((body) => body.id === "sun");
        return sun ? createSkyFrame(date, observer).toHorizontal(sun.ra, sun.dec).altitude : -90;
    };

    const [iss, weather] = await Promise.all([loadIss(), loadWeather(observer.lat, observer.lon)]);
    const nextIss = iss ? predictPasses(iss, now, observer, sunAltitudeAt, 72).find((pass) => pass.visible) ?? null : null;
    const score = nightScore(weather, observer, night, 5);
    const iso = (date: Date | null) => date?.toISOString() ?? null;

    return NextResponse.json(
        {
            ok: true,
            observer,
            timezone: weather?.timezone ?? null,
            generatedAt: now.toISOString(),
            moon: { phase: moon.name, illumination: Math.round(moon.illumination * 100) },
            night: {
                sunset: iso(night.sunset),
                darkFrom: iso(night.astronomicalDusk),
                darkTo: iso(night.astronomicalDawn),
                sunrise: iso(night.sunrise),
            },
            nextIssPass: nextIss
                ? { rise: iso(nextIss.rise), peak: iso(nextIss.peak), maxAltitude: Math.round(nextIss.peakAltitude), fromAzimuth: Math.round(nextIss.riseAzimuth), toAzimuth: Math.round(nextIss.setAzimuth) }
                : null,
            score: score ? { label: score.label, peak: score.peak, bestFrom: iso(score.best?.from ?? null), bestTo: iso(score.best?.to ?? null), bortle: 5 } : null,
            link: `https://lumalabs.ch/radar/stars?lat=${observer.lat}&lon=${observer.lon}`,
        },
        { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } }
    );
}
