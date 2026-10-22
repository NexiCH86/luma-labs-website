import { NextResponse } from "next/server";
import { createRedisSatelliteStore, SOURCE_DEFINITIONS, type GroupStatus } from "@/lib/satellite-source";

/*
 * Gesundheitspruefung des SAT-Modus fuer Uptime Kuma.
 *
 * Liest nur die kleinen Statuseintraege pro Gruppe (nicht die
 * Bahndaten selbst und nicht CelesTrak). 200, wenn jede Gruppe
 * Daten hat und diese hoechstens 26 h alt sind (taeglicher
 * Abgleich plus Reserve). Sonst 503 mit Grund pro Gruppe.
 * Ein Fehler beim letzten Abruf bei noch brauchbaren Daten
 * meldet "degraded".
 */
const MAX_AGE_MS = 26 * 60 * 60 * 1000;

function result(status: number, body: Record<string, unknown>) {
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
    const store = createRedisSatelliteStore();
    if (!store) return result(503, { ok: false, reason: "RADAR_REDIS_URL is missing" });

    const now = Date.now();
    const problems: string[] = [];
    const warnings: string[] = [];
    const groups: Record<string, unknown> = {};

    try {
        const statuses = await Promise.all(Object.keys(SOURCE_DEFINITIONS).map(async (group) => [group, await store.readStatus(group)] as const));
        for (const [group, status] of statuses as (readonly [string, GroupStatus | null])[]) {
            if (!status) {
                problems.push(`${group}: never loaded`);
                groups[group] = null;
                continue;
            }
            const ageMinutes = status.lastSuccessAt == null ? null : Math.round((now - status.lastSuccessAt) / 60_000);
            groups[group] = { count: status.count, format: status.format, ageMinutes, lastError: status.lastError };
            if (status.lastSuccessAt == null || status.count < 1) problems.push(`${group}: no data${status.lastError ? ` (${status.lastError})` : ""}`);
            else if (now - status.lastSuccessAt > MAX_AGE_MS) problems.push(`${group}: data is ${Math.round((ageMinutes ?? 0) / 60)} h old`);
            else if (status.lastError) warnings.push(`${group}: ${status.lastError}`);
        }
    } catch (error) {
        return result(503, { ok: false, reason: "Radar database unavailable", details: error instanceof Error ? error.message : String(error) });
    }

    if (problems.length > 0) return result(503, { ok: false, reason: problems.join("; "), groups });
    return result(200, { ok: true, status: warnings.length ? "degraded" : "ok", warnings, groups });
}
