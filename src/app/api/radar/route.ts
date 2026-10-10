import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/radar-store";

/*
 * Der Collector liefert alle 25 Sekunden neue Daten. Das
 * Vercel-CDN haelt die Antwort 20 Sekunden, damit nicht jeder
 * Besucher und jedes Radar-Panel (alle 5 s) Redis abfragt.
 */
const LIVE_CACHE =
    "public, max-age=0, s-maxage=20, stale-while-revalidate=40";

const WAITING_CACHE =
    "public, max-age=0, s-maxage=5";

export async function GET() {
    try {
        const snapshot =
            await readSnapshot();

        if (!snapshot) {
            return NextResponse.json(
                {
                    count: 0,
                    aircraft: [],
                    updated: null,
                    source: "redis",
                    status:
                        "waiting-for-collector",
                },
                {
                    headers: {
                        "Cache-Control":
                            WAITING_CACHE,
                    },
                }
            );
        }

        return NextResponse.json(
            {
                ...snapshot,
                source: "redis",
                status: "live",
            },
            {
                headers: {
                    "Cache-Control":
                        LIVE_CACHE,
                },
            }
        );
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
                        : String(error),
            },
            {
                status: 500,
                headers: {
                    "Cache-Control":
                        "no-store",
                },
            }
        );
    }
}
