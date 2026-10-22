import { NextRequest, NextResponse } from "next/server";

/*
 * Gesundheitspruefung des STARS-Modus fuer Uptime Kuma.
 *
 * 200, wenn Sternkatalog und Weltkarte ausgeliefert werden und
 * plausibel gross sind. Die Wikipedia-Route wird mitgeprueft, ihr
 * Ausfall fuehrt aber nur zu "degraded" (Bilder fehlen, Karte laeuft).
 */
function result(status: number, body: Record<string, unknown>) {
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
    const origin = request.nextUrl.origin;
    const problems: string[] = [];
    const details: Record<string, unknown> = {};

    try {
        const catalog = (await (await fetch(`${origin}/data/sky/catalog.json`, { cache: "no-store" })).json()) as { stars?: unknown[]; dsos?: unknown[]; constellations?: unknown[]; generatedAt?: string };
        details.stars = catalog.stars?.length ?? 0;
        details.deepSky = catalog.dsos?.length ?? 0;
        details.constellations = catalog.constellations?.length ?? 0;
        details.catalogGeneratedAt = catalog.generatedAt ?? null;
        if ((catalog.stars?.length ?? 0) < 4000) problems.push("Sky catalog has too few stars");
        if ((catalog.constellations?.length ?? 0) < 88) problems.push("Sky catalog is missing constellations");
    } catch (error) {
        problems.push(`Sky catalog unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
        const earth = (await (await fetch(`${origin}/data/sky/earth.json`, { cache: "no-store" })).json()) as { land?: unknown[] };
        details.landPolygons = earth.land?.length ?? 0;
        if ((earth.land?.length ?? 0) < 50) problems.push("Earth map has too few land polygons");
    } catch (error) {
        problems.push(`Earth map unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    let wikipedia = "ok";
    try {
        const info = await fetch(`${origin}/api/radar/sky-info?titles=Vega`, { cache: "no-store" });
        if (!info.ok) wikipedia = `HTTP ${info.status}`;
    } catch (error) {
        wikipedia = error instanceof Error ? error.message : String(error);
    }
    details.wikipedia = wikipedia;

    if (problems.length > 0) return result(503, { ok: false, reason: problems.join("; "), ...details });
    return result(200, { ok: true, status: wikipedia === "ok" ? "ok" : "degraded", ...details });
}
