import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { createRedisSatelliteStore, parseOmmJson, saveGroup, SOURCE_DEFINITIONS } from "@/lib/satellite-source";

/*
 * Bahndaten vom Collector auf dem Raspberry Pi (collector/collector.py):
 * POST /api/radar/satellites/ingest?group=STARLINK, Body = CelesTrak-JSON
 * (OMM), gzip-komprimiert mit Header x-payload-encoding: gzip.
 * Gleicher Schluessel wie die Flugzeugdaten (RADAR_INGEST_SECRET).
 */
export const maxDuration = 30;

const MAX_RECORDS = 30_000;

function result(status: number, body: Record<string, unknown>) {
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
    const secret = process.env.RADAR_INGEST_SECRET;
    if (!secret) return result(500, { ok: false, error: "RADAR_INGEST_SECRET not configured" });
    if (request.headers.get("x-radar-secret") !== secret) return result(401, { ok: false, error: "Unauthorized" });

    const group = (request.nextUrl.searchParams.get("group") ?? "").toUpperCase();
    if (!SOURCE_DEFINITIONS[group]) return result(400, { ok: false, error: `Unsupported satellite group: ${group}` });

    const store = createRedisSatelliteStore();
    if (!store) return result(503, { ok: false, error: "RADAR_REDIS_URL is missing" });

    let records;
    try {
        const body = Buffer.from(await request.arrayBuffer());
        const text = (request.headers.get("x-payload-encoding") === "gzip" ? gunzipSync(body) : body).toString("utf8");
        records = parseOmmJson(text);
    } catch (error) {
        return result(400, { ok: false, error: `Invalid payload: ${error instanceof Error ? error.message : String(error)}` });
    }
    if (records.length === 0 || records.length > MAX_RECORDS) return result(422, { ok: false, error: `Unexpected record count: ${records.length}` });

    try {
        await saveGroup(store, group, records, "OMM", Date.now());
    } catch (error) {
        return result(503, { ok: false, error: `Radar database unavailable: ${error instanceof Error ? error.message : String(error)}` });
    }
    return result(200, { ok: true, group, count: records.length });
}
