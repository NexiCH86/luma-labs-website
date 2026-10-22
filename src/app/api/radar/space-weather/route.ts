import { NextResponse } from "next/server";

/*
 * Kp-Index (geomagnetische Aktivitaet) fuer die Polarlicht-Aussicht im
 * STARS-Modus. Quelle: NOAA Space Weather Prediction Center, gemessene
 * und vorhergesagte Werte in 3-Stunden-Schritten. 30 min CDN-Cache.
 */
type NoaaKp = { time_tag?: string; kp?: number; observed?: string };

export async function GET() {
    try {
        const response = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", {
            next: { revalidate: 1800 },
            headers: { Accept: "application/json", "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" },
        });
        if (!response.ok) throw new Error(`NOAA returned ${response.status}`);
        const data = (await response.json()) as NoaaKp[];
        const kp = data
            .filter((entry) => entry.time_tag && Number.isFinite(entry.kp))
            .map((entry) => ({ time: `${entry.time_tag}Z`, kp: Number(entry.kp), observed: entry.observed === "observed" }));
        return NextResponse.json(
            { ok: true, kp, source: "NOAA SWPC" },
            { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
        );
    } catch (error) {
        console.error("STARS space-weather error:", error);
        return NextResponse.json({ ok: false, kp: [], error: error instanceof Error ? error.message : "Space weather unavailable" }, { status: 502 });
    }
}
