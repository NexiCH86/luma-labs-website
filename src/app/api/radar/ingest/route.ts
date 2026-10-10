import { NextRequest, NextResponse } from "next/server";
import {
    isTrackFrameDue,
    writeSnapshot,
    writeTrackFrame,
    type RadarAircraft,
} from "@/lib/radar-store";

type RadarPayload = {
    updated: number;
    aircraft: RadarAircraft[];
};

export async function POST(
    request: NextRequest
) {
    try {
        const expectedSecret =
            process.env.RADAR_INGEST_SECRET;

        if (!expectedSecret) {
            return NextResponse.json(
                {
                    error:
                        "RADAR_INGEST_SECRET not configured",
                },
                {
                    status: 500,
                }
            );
        }

        const providedSecret =
            request.headers.get(
                "x-radar-secret"
            );

        if (
            !providedSecret ||
            providedSecret !== expectedSecret
        ) {
            return NextResponse.json(
                {
                    error: "Unauthorized",
                },
                {
                    status: 401,
                }
            );
        }

        const payload =
            (await request.json()) as RadarPayload;

        if (
            !payload ||
            !Array.isArray(payload.aircraft)
        ) {
            return NextResponse.json(
                {
                    error: "Invalid payload",
                },
                {
                    status: 400,
                }
            );
        }

        const now =
            Date.now();

        const aircraft =
            payload.aircraft.filter(
                (item) =>
                    typeof item.icao24 ===
                    "string" &&
                    Number.isFinite(
                        item.latitude
                    ) &&
                    Number.isFinite(
                        item.longitude
                    )
            );

        /*
         * =====================================================
         * LIVE SNAPSHOT
         * =====================================================
         *
         * Wird bei jedem Collector-Durchlauf komplett ersetzt.
         * Der Browser liest diesen Snapshot ueber /api/radar.
         */

        const snapshot = {
            updated:
                payload.updated ??
                now,

            receivedAt:
                now,

            count:
                aircraft.length,

            aircraft,
        };

        await writeSnapshot(
            snapshot
        );

        /*
         * =====================================================
         * PERSISTENT TRACK HISTORY
         * =====================================================
         *
         * Einmal pro Minute ein Frame mit allen Flugzeugen
         * (1 Redis-Befehl). Frueher waren es bis zu 200 Befehle
         * pro Lieferung, das hat das Upstash-Monatslimit
         * innerhalb eines Tages aufgebraucht.
         */

        const trackFrameWritten =
            isTrackFrameDue(now);

        if (trackFrameWritten) {
            await writeTrackFrame(
                now,
                aircraft
            );
        }

        return NextResponse.json({
            ok: true,

            count:
                aircraft.length,

            updated:
                snapshot.updated,

            trackFrameWritten,
        });
    } catch (error) {
        console.error(
            "Radar ingest error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Radar ingest failed",

                details:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
            {
                status: 500,
            }
        );
    }
}
