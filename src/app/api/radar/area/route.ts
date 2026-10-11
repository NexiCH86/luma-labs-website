import { NextRequest, NextResponse } from "next/server";

/*
 * Flugzeuge ausserhalb des Schweizer Collector-Bereichs (NEX-8).
 *
 * Quelle: adsb.lol (Community-ADS-B-Netz, kein Schluessel noetig,
 * Limits je nach Serverlast). Pro Anfrage nur ein Kreis um den
 * Kartenausschnitt, max. 250 NM. Mittelpunkt und Radius werden
 * gerundet, damit das Vercel-CDN Anfragen mehrerer Besucher teilt.
 */
const SOURCE = "https://api.adsb.lol/v2/point";
const AREA_CACHE = "public, max-age=0, s-maxage=10, stale-while-revalidate=20";

const FEET_TO_METERS = 0.3048;
const KNOTS_TO_MPS = 0.514444;
const FPM_TO_MPS = 0.00508;

type AdsbAircraft = {
    hex?: string;
    flight?: string;
    r?: string;
    t?: string;
    category?: string;
    lat?: number;
    lon?: number;
    alt_baro?: number | "ground";
    alt_geom?: number;
    gs?: number;
    track?: number;
    baro_rate?: number;
    geom_rate?: number;
    squawk?: string;
    seen_pos?: number;
};

function numberParam(request: NextRequest, name: string) {
    const value = Number(request.nextUrl.searchParams.get(name));
    return Number.isFinite(value) ? value : null;
}

function roundTo(value: number, step: number) {
    return Math.round(value / step) * step;
}

export async function GET(request: NextRequest) {
    const lat = numberParam(request, "lat");
    const lon = numberParam(request, "lon");
    const radius = numberParam(request, "radius");

    if (lat == null || lon == null || radius == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return NextResponse.json(
            { error: "Use lat, lon and radius (nautical miles)." },
            { status: 400 }
        );
    }

    const radiusNm = Math.min(250, Math.max(25, roundTo(radius, 25)));
    const step = radiusNm > 100 ? 1 : 0.25;
    const centerLat = roundTo(lat, step);
    const centerLon = roundTo(lon, step);

    try {
        const response = await fetch(
            `${SOURCE}/${centerLat}/${centerLon}/${radiusNm}`,
            {
                headers: {
                    "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)",
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(8_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`adsb.lol ${response.status}`);
        }

        const data = (await response.json()) as { ac?: AdsbAircraft[]; now?: number };

        const aircraft = (data.ac ?? [])
            .filter((item) =>
                typeof item.hex === "string" &&
                Number.isFinite(item.lat) &&
                Number.isFinite(item.lon) &&
                (item.seen_pos ?? 0) < 60
            )
            .map((item) => {
                const onGround = item.alt_baro === "ground";
                const altitudeFt = typeof item.alt_baro === "number" ? item.alt_baro : null;
                const verticalFpm = item.baro_rate ?? item.geom_rate;

                return {
                    // "~" kennzeichnet TIS-B-Ziele ohne echte ICAO-Adresse.
                    icao24: item.hex!.replace(/^~/, "").toLowerCase(),
                    callsign: item.flight?.trim() ?? "",
                    country: "",
                    latitude: item.lat!,
                    longitude: item.lon!,
                    altitude: onGround ? 0 : altitudeFt != null ? altitudeFt * FEET_TO_METERS : null,
                    onGround,
                    velocity: item.gs != null ? item.gs * KNOTS_TO_MPS : null,
                    heading: item.track ?? null,
                    verticalRate: verticalFpm != null ? verticalFpm * FPM_TO_MPS : null,
                    geoAltitude: item.alt_geom != null ? item.alt_geom * FEET_TO_METERS : null,
                    squawk: item.squawk ?? null,
                    registration: item.r ?? null,
                    typeCode: item.t ?? null,
                    category: item.category ?? null,
                    source: "adsb.lol",
                };
            });

        return NextResponse.json(
            {
                count: aircraft.length,
                aircraft,
                center: [centerLat, centerLon],
                radiusNm,
                updated: data.now ?? Date.now(),
                source: "adsb.lol",
                attribution: "Flight data: adsb.lol (ODbL)",
            },
            { headers: { "Cache-Control": AREA_CACHE } }
        );
    } catch (error) {
        console.error("Radar area error:", error);

        return NextResponse.json(
            {
                count: 0,
                aircraft: [],
                error: "Worldwide flight data unavailable",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 502, headers: { "Cache-Control": "no-store" } }
        );
    }
}
