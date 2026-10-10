import { NextRequest, NextResponse } from "next/server";
import {
    getRadarRedis,
    readTrack,
} from "@/lib/radar-store";

/*
 * Spur-Frames entstehen einmal pro Minute, daher darf das
 * Vercel-CDN die Antwort pro Flugzeug 60 Sekunden halten.
 */
const TRACK_CACHE =
    "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

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

        const redis = getRadarRedis();

        const points = await readTrack(
            redis,
            icao24
        );

        return NextResponse.json(
            {
                icao24,
                count: points.length,
                points,
            },
            {
                headers: {
                    "Cache-Control": TRACK_CACHE,
                },
            }
        );
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
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    }
}
