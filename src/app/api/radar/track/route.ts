import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type TrackPoint = {
    latitude: number;
    longitude: number;
    altitude: number | null;
    heading: number | null;
    velocity: number | null;
    timestamp: number;
};

function getRedis() {
    const url = process.env.RADAR_REDIS_KV_REST_API_URL;
    const token = process.env.RADAR_REDIS_KV_REST_API_TOKEN;

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

export async function GET(request: NextRequest) {
    try {
        const icao24 = request.nextUrl.searchParams
            .get("icao24")
            ?.trim()
            .toLowerCase();

        if (!icao24) {
            return NextResponse.json(
                {
                    error: "Missing icao24",
                },
                {
                    status: 400,
                }
            );
        }

        const redis = getRedis();

        const key = `radar:track:${icao24}`;

        const points = await redis.lrange<TrackPoint>(
            key,
            0,
            -1
        );

        if (!points?.length) {
            return NextResponse.json({
                icao24,
                count: 0,
                points: [],
            });
        }

        return NextResponse.json({
            icao24,
            count: points.length,
            points,
        });
    } catch (error) {
        console.error(
            "Radar track API error:",
            error
        );

        return NextResponse.json(
            {
                error: "Track unavailable",
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