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
            !Array.isArray(
                payload.aircraft
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid payload",
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
                    typeof item.icao24 === "string" &&
                    Number.isFinite(
                        item.latitude
                    ) &&
                    Number.isFinite(
                        item.longitude
                    )
            );

        /*
         * 1. LIVE SNAPSHOT
         * Dieser Teil ist das Wichtigste.
         * Er sorgt dafür, dass das Radar sofort Flugzeuge sieht.
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
                ex: 60,
            }
        );

        /*
         * 2. TRACKS
         * Nicht mehr alle ~100 Flugzeuge gleichzeitig.
         * Pro Ingest nur maximal 15 Aircraft.
         *
         * Bei 5 Sekunden Refresh werden dadurch nach und nach
         * alle Flugzeuge aktualisiert, ohne die Vercel Function
         * zu überlasten.
         */
        const TRACK_BATCH_SIZE = 15;

        const cursorKey =
            "radar:track-batch-cursor";

        const previousCursor =
            (await redis.get<number>(
                cursorKey
            )) ?? 0;

        const start =
            previousCursor %
            Math.max(
                aircraft.length,
                1
            );

        const trackAircraft =
            aircraft
                .concat(aircraft)
                .slice(
                    start,
                    start +
                    Math.min(
                        TRACK_BATCH_SIZE,
                        aircraft.length
                    )
                );

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
                    `radar:track:${item.icao24}`;

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

                pipeline.rpush(
                    key,
                    point
                );

                pipeline.ltrim(
                    key,
                    -2000,
                    -1
                );

                pipeline.expire(
                    key,
                    12 * 60 * 60
                );
            }

            await pipeline.exec();

            await redis.set(
                cursorKey,
                start +
                trackAircraft.length,
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
