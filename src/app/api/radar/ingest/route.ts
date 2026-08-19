import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type Aircraft = {
    icao24: string;
    callsign: string;
    country: string;
    longitude: number;
    latitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    verticalRate: number | null;
    geoAltitude: number | null;
    squawk: string | null;
};

type RadarPayload = {
    updated: number;
    aircraft: Aircraft[];
};

function getRedis() {
    const url =
        process.env.RADAR_REDIS_KV_REST_API_URL;

    const token =
        process.env.RADAR_REDIS_KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error(
            "Radar Redis environment variables are missing"
        );
    }

    return new Redis({
        url,
        token,
    });
}

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

        const redis =
            getRedis();

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

        await redis.set(
            "radar:snapshot",
            snapshot,
            {
                /*
                 * Collector laeuft alle 25 Sekunden.
                 * Nach 90 Sekunden ohne Collector gelten
                 * die Daten als veraltet.
                 */
                ex: 90,
            }
        );

        /*
         * =====================================================
         * PERSISTENT TRACK HISTORY
         * =====================================================
         *
         * Wir schreiben nicht mehr nur 15 Aircraft pro Runde,
         * sondern 100.
         *
         * Bei rund 200 Flugzeugen erhaelt damit jedes Aircraft
         * ungefaehr alle 50 Sekunden einen persistenten Punkt.
         *
         * Pro Flugzeug nur:
         *
         *   RPUSH
         *   EXPIRE
         *
         * Kein LTRIM mehr notwendig.
         */

        const TRACK_BATCH_SIZE = 100;

        const cursorKey =
            "radar:track-batch-cursor";

        const previousCursor =
            (await redis.get<number>(
                cursorKey
            )) ?? 0;

        const aircraftCount =
            aircraft.length;

        let trackAircraft:
            Aircraft[] = [];

        let nextCursor = 0;

        if (aircraftCount > 0) {
            const start =
                previousCursor %
                aircraftCount;

            const amount =
                Math.min(
                    TRACK_BATCH_SIZE,
                    aircraftCount
                );

            /*
             * Array verdoppeln, damit ein Batch sauber
             * ueber das Ende des Arrays hinauslaufen kann.
             */

            trackAircraft =
                aircraft
                    .concat(aircraft)
                    .slice(
                        start,
                        start + amount
                    );

            nextCursor =
                (
                    start +
                    amount
                ) %
                aircraftCount;
        }

        if (
            trackAircraft.length >
            0
        ) {
            const pipeline =
                redis.pipeline();

            for (
                const item of
                trackAircraft
            ) {
                const key =
                    `radar:track:${item.icao24.toLowerCase()}`;

                const point = {
                    latitude:
                        item.latitude,

                    longitude:
                        item.longitude,

                    altitude:
                        item.altitude,

                    heading:
                        item.heading,

                    velocity:
                        item.velocity,

                    timestamp:
                        now,
                };

                /*
                 * Neuen Punkt ans Ende des Tracks schreiben.
                 */

                pipeline.rpush(
                    key,
                    point
                );

                /*
                 * Track verschwindet 12 Stunden nach dem
                 * letzten empfangenen Punkt automatisch.
                 */

                pipeline.expire(
                    key,
                    12 * 60 * 60
                );
            }

            /*
             * Alle Redis-Befehle gemeinsam senden.
             */

            await pipeline.exec();

            /*
             * Cursor fuer den naechsten Collector-Durchlauf.
             */

            await redis.set(
                cursorKey,
                nextCursor,
                {
                    ex:
                        12 * 60 * 60,
                }
            );
        }

        return NextResponse.json({
            ok: true,

            count:
                aircraft.length,

            updated:
                snapshot.updated,

            tracksUpdated:
                trackAircraft.length,

            trackBatchSize:
                TRACK_BATCH_SIZE,

            nextCursor,
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