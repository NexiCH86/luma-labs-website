import { NextRequest, NextResponse } from "next/server";
import { createRedisSatelliteStore, loadGroup, SOURCE_DEFINITIONS } from "@/lib/satellite-source";

/*
 * Taeglicher Abgleich (Vercel Cron, vercel.json): fuellt den Cache
 * aller SAT-Gruppen, auch solcher, die gerade niemand ansieht.
 * Haelt sich an die 2-Stunden-Regel von CelesTrak (frische Gruppen
 * werden nicht neu geladen), kann also nichts erzwingen.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const store = createRedisSatelliteStore();
    if (!store) {
        return NextResponse.json({ ok: false, error: "RADAR_REDIS_URL is missing" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    const sources = Object.values(SOURCE_DEFINITIONS);
    const settled = await Promise.allSettled(sources.map((source) => loadGroup(source, { store })));
    const groups: Record<string, unknown> = {};
    let failures = 0;
    settled.forEach((result, index) => {
        const group = sources[index].group;
        if (result.status === "rejected") {
            failures++;
            groups[group] = { error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
            return;
        }
        const { records, origin, format, fetchedAt, warning } = result.value;
        if (warning) failures++;
        groups[group] = { count: records.length, origin, format, fetchedAt: new Date(fetchedAt).toISOString(), warning: warning ?? null };
    });

    return NextResponse.json({ ok: failures === 0, failures, groups }, { headers: { "Cache-Control": "no-store" } });
}
