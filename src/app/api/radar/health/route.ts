import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/radar-store";

/*
 * Gesundheitspruefung fuer Uptime Kuma (Monitor "LuMa RADAR",
 * Benachrichtigung an Discord).
 *
 * 200 nur, wenn der Collector in den letzten 3 Minuten geliefert
 * hat und Flugzeuge im Snapshot sind. Sonst 503 mit Grund, z. B.
 * Datenbank nicht erreichbar oder Collector liefert nicht mehr.
 * Der Snapshot selbst verfaellt in Redis nach 90 s.
 */
const MAX_AGE_MS = 3 * 60 * 1000;

function result(status: number, body: Record<string, unknown>) {
    return NextResponse.json(body, {
        status,
        headers: { "Cache-Control": "no-store" },
    });
}

export async function GET() {
    try {
        const snapshot = await readSnapshot();

        if (!snapshot) {
            return result(503, {
                ok: false,
                reason: "No snapshot – collector has not delivered for over 90 s",
            });
        }

        const ageMs = Date.now() - snapshot.receivedAt;

        if (ageMs > MAX_AGE_MS) {
            return result(503, {
                ok: false,
                reason: `Snapshot is ${Math.round(ageMs / 1000)} s old`,
                count: snapshot.count,
            });
        }

        if (snapshot.count < 1) {
            return result(503, {
                ok: false,
                reason: "Snapshot contains no aircraft",
                ageSeconds: Math.round(ageMs / 1000),
            });
        }

        return result(200, {
            ok: true,
            count: snapshot.count,
            ageSeconds: Math.round(ageMs / 1000),
        });
    } catch (error) {
        return result(503, {
            ok: false,
            reason: "Radar database unavailable",
            details: error instanceof Error ? error.message : String(error),
        });
    }
}
