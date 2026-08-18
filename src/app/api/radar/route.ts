import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

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

export async function GET() {
    try {
        const redis =
            getRedis();

        const snapshot =
            await redis.get<{
                updated: number;
                receivedAt: number;
                count: number;
                aircraft: unknown[];
            }>(
                "radar:snapshot"
            );

        if (!snapshot) {
            return NextResponse.json({
                count: 0,
                aircraft: [],
                updated: null,
                source:
                    "redis",
                status:
                    "waiting-for-collector",
            });
        }

        return NextResponse.json({
            ...snapshot,
            source:
                "redis",
            status:
                "live",
        });
    } catch (error) {
        console.error(
            "Radar API error:",
            error
        );

        return NextResponse.json(
            {
                count: 0,
                aircraft: [],
                error:
                    "Radar data unavailable",
                details:
                    error instanceof Error
                        ? error.message
                        : String(
                            error
                        ),
            },
            {
                status: 500,
            }
        );
    }
}