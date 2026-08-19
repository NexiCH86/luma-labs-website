import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type OpenSkyRecord = {
    registration?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    typeCode?: string | null;
    serialNumber?: string | null;
    lineNumber?: string | null;
    icaoAircraftType?: string | null;
    operator?: string | null;
    operatorCallsign?: string | null;
    operatorIcao?: string | null;
    operatorIata?: string | null;
    owner?: string | null;
    registered?: string | null;
    regUntil?: string | null;
    status?: string | null;
    built?: string | null;
    firstFlightDate?: string | null;
    seatConfiguration?: string | null;
    engines?: string | null;
    categoryDescription?: string | null;
};

function yearFromDate(value?: string | null) {
    if (!value) return null;

    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : null;
}

export async function GET(
    request: NextRequest
) {
    const icao24 =
        request.nextUrl.searchParams
            .get("icao24")
            ?.trim()
            .toLowerCase();

    if (!icao24 || !/^[0-9a-f]{6}$/.test(icao24)) {
        return NextResponse.json(
            {
                found: false,
                error: "Invalid ICAO24",
            },
            {
                status: 400,
            }
        );
    }

    const prefix = icao24.slice(0, 2);
    const suffix = icao24.slice(2);

    try {
        const filePath = path.join(
            process.cwd(),
            "public",
            "data",
            "opensky-aircraft",
            `${prefix}.json`
        );

        const raw = await readFile(
            filePath,
            "utf8"
        );

        const shard = JSON.parse(raw) as Record<
            string,
            OpenSkyRecord
        >;

        const record = shard[suffix];

        if (!record) {
            return NextResponse.json({
                found: false,
                icao24,
                source: "OpenSky",
            });
        }

        const yearBuilt =
            yearFromDate(record.built);

        return NextResponse.json({
            found: true,
            icao24,
            source: "OpenSky",
            ...record,
            yearBuilt,
            ageYears:
                yearBuilt != null
                    ? Math.max(
                        0,
                        new Date().getFullYear() - yearBuilt
                    )
                    : null,
        });
    } catch (error) {
        const code =
            error &&
            typeof error === "object" &&
            "code" in error
                ? String(error.code)
                : "";

        if (code === "ENOENT") {
            return NextResponse.json({
                found: false,
                icao24,
                source: "OpenSky",
                reason:
                    "OpenSky metadata not synced",
            });
        }

        console.error(
            "OpenSky airframe lookup error:",
            error
        );

        return NextResponse.json(
            {
                found: false,
                icao24,
                error:
                    "OpenSky airframe lookup failed",
            },
            {
                status: 500,
            }
        );
    }
}
