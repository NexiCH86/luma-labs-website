import { NextRequest, NextResponse } from "next/server";

type NominatimResult = {
    place_id?: number;
    display_name?: string;
    lat?: string;
    lon?: string;
    type?: string;
    addresstype?: string;
    address?: Record<string, string>;
};

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2 || query.length > 180) {
        return NextResponse.json(
            { ok: false, results: [], error: "Bitte einen Ort oder eine Adresse eingeben." },
            { status: 400 }
        );
    }

    try {
        const params = new URLSearchParams({
            q: query,
            format: "jsonv2",
            addressdetails: "1",
            limit: "5",
        });

        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            next: { revalidate: 86400 },
            headers: {
                Accept: "application/json",
                "Accept-Language": "de-CH,de;q=0.9,en;q=0.7",
                "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch; contact: luis.moran@mail.ch)",
            },
        });

        if (!response.ok) {
            throw new Error(`Geocoding service returned ${response.status}`);
        }

        const data = (await response.json()) as NominatimResult[];
        const results = data
            .map((item) => ({
                id: item.place_id ?? 0,
                label: item.display_name ?? "Unknown place",
                latitude: Number(item.lat),
                longitude: Number(item.lon),
                type: item.addresstype ?? item.type ?? "place",
                postcode: item.address?.postcode ?? null,
                country: item.address?.country ?? null,
            }))
            .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

        return NextResponse.json(
            { ok: true, query, results, attribution: "© OpenStreetMap contributors" },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
                },
            }
        );
    } catch (error) {
        console.error("SAT geocode error:", error);
        return NextResponse.json(
            {
                ok: false,
                results: [],
                error: error instanceof Error ? error.message : "Ortssuche momentan nicht verfügbar.",
            },
            { status: 502 }
        );
    }
}
