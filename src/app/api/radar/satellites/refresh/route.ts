import { NextRequest, NextResponse } from "next/server";

const REFRESH_GROUPS = [
    "STATIONS",
    "GPS-OPS",
    "GLO-OPS",
    "GALILEO",
    "BEIDOU",
    "WEATHER",
    "RESOURCE",
    "SCIENCE",
    "GEO",
];

export const maxDuration = 120;

export async function GET(request: NextRequest) {
    const origin = request.nextUrl.origin;
    const batches: string[][] = [];

    for (let index = 0; index < REFRESH_GROUPS.length; index += 4) {
        batches.push(REFRESH_GROUPS.slice(index, index + 4));
    }

    const results = [];

    for (const groups of batches) {
        try {
            const url = new URL("/api/radar/satellites", origin);
            url.searchParams.set("groups", groups.join(","));
            url.searchParams.set("refresh", Date.now().toString());

            const response = await fetch(url, { cache: "no-store" });
            const data = await response.json();
            results.push({
                groups,
                ok: response.ok,
                status: response.status,
                dataMode: data.dataMode,
                count: data.count,
                groupModes: data.groupModes,
            });
        } catch (error) {
            results.push({
                groups,
                ok: false,
                error: error instanceof Error ? error.message : "refresh failed",
            });
        }
    }

    return NextResponse.json({
        ok: results.some((result) => result.ok),
        refreshedAt: new Date().toISOString(),
        results,
    });
}
