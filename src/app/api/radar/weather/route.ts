import { NextRequest, NextResponse } from "next/server";

type CacheEntry = {
    expires: number;
    value: unknown;
};

const globalForWeather = globalThis as unknown as {
    lumaMetarCache?: Map<string, CacheEntry>;
};

const cache = globalForWeather.lumaMetarCache ?? new Map<string, CacheEntry>();
globalForWeather.lumaMetarCache = cache;

const CACHE_MS = 60_000;

export async function GET(request: NextRequest) {
    const icao = request.nextUrl.searchParams.get("icao")?.trim().toUpperCase();

    if (!icao || !/^[A-Z0-9]{4}$/.test(icao)) {
        return NextResponse.json({ error: "Missing or invalid ICAO airport code" }, { status: 400 });
    }

    const cached = cache.get(icao);
    if (cached && cached.expires > Date.now()) {
        return NextResponse.json({ ...(cached.value as object), cached: true });
    }

    try {
        const [metarResult, tafResult] = await Promise.all([
            fetchAviationWeather("metar", icao),
            fetchAviationWeather("taf", icao),
        ]);

        if (metarResult.status === 204) {
            const value = {
                found: false,
                icao,
                source: "AviationWeather.gov",
                taf: normalizeTaf(tafResult.data),
            };
            cache.set(icao, { expires: Date.now() + CACHE_MS, value });
            return NextResponse.json(value);
        }

        if (!metarResult.ok) {
            return NextResponse.json(
                { error: `AviationWeather METAR lookup failed (${metarResult.status})` },
                { status: 502 }
            );
        }

        const metar = Array.isArray(metarResult.data) ? metarResult.data[0] : null;

        if (!metar) {
            const value = {
                found: false,
                icao,
                source: "AviationWeather.gov",
                taf: normalizeTaf(tafResult.data),
            };
            cache.set(icao, { expires: Date.now() + CACHE_MS, value });
            return NextResponse.json(value);
        }

        const value = {
            found: true,
            icao,
            source: "AviationWeather.gov",
            raw: metar.rawOb ?? metar.raw_text ?? null,
            observedAt: metar.obsTime ?? metar.observation_time ?? null,
            temperatureC: numberOrNull(metar.temp),
            dewpointC: numberOrNull(metar.dewp),
            windDirectionDeg: numberOrNull(metar.wdir),
            windSpeedKt: numberOrNull(metar.wspd),
            windGustKt: numberOrNull(metar.wgst),
            visibilitySm: numberOrNull(metar.visib),
            altimeterHpa: altimeterToHpa(metar.altim),
            flightCategory: metar.fltCat ?? null,
            clouds: Array.isArray(metar.clouds) ? metar.clouds : [],
            weather: metar.wxString ?? null,
            taf: normalizeTaf(tafResult.data),
        };

        cache.set(icao, { expires: Date.now() + CACHE_MS, value });
        return NextResponse.json(value);
    } catch (error) {
        console.error("Weather lookup failed:", error);
        return NextResponse.json({ error: "Weather lookup failed" }, { status: 500 });
    }
}

async function fetchAviationWeather(product: "metar" | "taf", icao: string) {
    const url = new URL(`https://aviationweather.gov/api/data/${product}`);
    url.searchParams.set("ids", icao);
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "LuMa-Radar/1.0 (lumalabs.ch)",
        },
        cache: "no-store",
    });

    if (response.status === 204) {
        return { ok: true, status: response.status, data: null };
    }

    let data: any = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    return { ok: response.ok, status: response.status, data };
}

function normalizeTaf(rows: any) {
    const taf = Array.isArray(rows) ? rows[0] : null;
    if (!taf) return null;

    return {
        raw: taf.rawTAF ?? taf.raw_text ?? taf.rawText ?? taf.rawOb ?? null,
        issuedAt: taf.issueTime ?? taf.issue_time ?? taf.bulletinTime ?? null,
        validFrom: taf.validTimeFrom ?? taf.valid_time_from ?? taf.validFrom ?? null,
        validTo: taf.validTimeTo ?? taf.valid_time_to ?? taf.validTo ?? null,
        forecasts: Array.isArray(taf.fcsts)
            ? taf.fcsts
            : Array.isArray(taf.forecast)
                ? taf.forecast
                : [],
    };
}

function numberOrNull(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function altimeterToHpa(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number > 100 ? Math.round(number * 10) / 10 : Math.round(number * 33.8639 * 10) / 10;
}
