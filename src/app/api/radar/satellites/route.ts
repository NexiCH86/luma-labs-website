import { NextResponse } from "next/server";

type CelesTrakRecord = {
    OBJECT_NAME?: string;
    OBJECT_ID?: string;
    EPOCH?: string;
    MEAN_MOTION?: number;
    ECCENTRICITY?: number;
    INCLINATION?: number;
    RA_OF_ASC_NODE?: number;
    ARG_OF_PERICENTER?: number;
    MEAN_ANOMALY?: number;
    EPHEMERIS_TYPE?: number;
    CLASSIFICATION_TYPE?: string;
    NORAD_CAT_ID?: number;
    ELEMENT_SET_NO?: number;
    REV_AT_EPOCH?: number;
    BSTAR?: number;
    MEAN_MOTION_DOT?: number;
    MEAN_MOTION_DDOT?: number;
};

type SatelliteRecord = CelesTrakRecord & {
    category: "station" | "navigation";
};

const SOURCES = [
    { group: "STATIONS", category: "station" as const },
    { group: "GPS-OPS", category: "navigation" as const },
];

async function loadGroup(
    group: string,
    category: SatelliteRecord["category"]
): Promise<SatelliteRecord[]> {
    const url =
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=JSON`;

    const response = await fetch(url, {
        next: { revalidate: 7200 },
        headers: {
            Accept: "application/json",
            "User-Agent": "LuMa-RADAR/1.0 (lumalabs.ch)",
        },
    });

    if (!response.ok) {
        throw new Error(
            `CelesTrak ${group} returned ${response.status}`
        );
    }

    const data = (await response.json()) as CelesTrakRecord[];

    return data
        .filter(
            (record) =>
                record.NORAD_CAT_ID != null &&
                record.OBJECT_NAME &&
                record.EPOCH &&
                record.MEAN_MOTION != null &&
                record.ECCENTRICITY != null &&
                record.INCLINATION != null &&
                record.RA_OF_ASC_NODE != null &&
                record.ARG_OF_PERICENTER != null &&
                record.MEAN_ANOMALY != null
        )
        .map((record) => ({
            ...record,
            category,
        }));
}

export async function GET() {
    try {
        const groups = await Promise.all(
            SOURCES.map((source) =>
                loadGroup(source.group, source.category)
            )
        );

        const byNorad = new Map<number, SatelliteRecord>();

        for (const record of groups.flat()) {
            if (record.NORAD_CAT_ID == null) {
                continue;
            }

            byNorad.set(record.NORAD_CAT_ID, record);
        }

        const satellites = Array.from(byNorad.values()).sort(
            (a, b) =>
                (a.OBJECT_NAME ?? "").localeCompare(
                    b.OBJECT_NAME ?? ""
                )
        );

        return NextResponse.json(
            {
                ok: true,
                source: "CelesTrak GP / OMM",
                groups: SOURCES.map((source) => source.group),
                cacheSeconds: 7200,
                generatedAt: new Date().toISOString(),
                count: satellites.length,
                satellites,
            },
            {
                headers: {
                    "Cache-Control":
                        "public, s-maxage=7200, stale-while-revalidate=86400",
                },
            }
        );
    } catch (error) {
        console.error("SAT data error:", error);

        return NextResponse.json(
            {
                ok: false,
                source: "CelesTrak GP / OMM",
                generatedAt: new Date().toISOString(),
                count: 0,
                satellites: [],
                error:
                    error instanceof Error
                        ? error.message
                        : "Satellite data unavailable",
            },
            { status: 502 }
        );
    }
}
