import { NextRequest, NextResponse } from "next/server";
import { fetchTrace, tracePoints } from "@/lib/adsb-trace";

/*
 * Spurenverlauf weltweit von adsb.lol (Punkt 5 der Radar-Liste).
 * Fuer Flugzeuge in der Schweiz liefert /api/radar/track die Spur
 * aus den eigenen Collector-Daten; diese Route ist der Fallback.
 *
 * Gleiches Antwortformat wie /api/radar/track, letzte 2 Stunden.
 */
const HISTORY_MS = 2 * 60 * 60 * 1000;
const TRACE_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=120";

export async function GET(request: NextRequest) {
    const icao24 = request.nextUrl.searchParams.get("icao24")?.trim().toLowerCase();

    if (!icao24 || !/^[0-9a-f]{6}$/.test(icao24)) {
        return NextResponse.json({ error: "Invalid icao24" }, { status: 400 });
    }

    try {
        const [full, recent] = await Promise.all([
            fetchTrace(icao24, "full").catch(() => null),
            fetchTrace(icao24, "recent"),
        ]);

        const since = Date.now() - HISTORY_MS;
        const byTime = new Map<number, ReturnType<typeof tracePoints>[number]>();

        for (const point of [...tracePoints(full), ...tracePoints(recent)]) {
            if (point.timestamp >= since) {
                byTime.set(point.timestamp, point);
            }
        }

        const points = [...byTime.values()].sort((a, b) => a.timestamp - b.timestamp);

        return NextResponse.json(
            { icao24, count: points.length, points, source: "adsb.lol" },
            { headers: { "Cache-Control": TRACE_CACHE } }
        );
    } catch (error) {
        return NextResponse.json(
            {
                icao24,
                count: 0,
                points: [],
                error: "Trace unavailable",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 502, headers: { "Cache-Control": "no-store" } }
        );
    }
}
