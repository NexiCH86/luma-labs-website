import { NextRequest, NextResponse } from "next/server";

/*
 * Kurzbeschreibung und Bild zu einem Himmelsobjekt aus Wikipedia
 * (REST-API "page/summary"). Der Client schickt mehrere Titel-
 * Kandidaten, getrennt durch "|"; der erste passende Artikel gewinnt
 * (Begriffsklaerungen werden uebersprungen).
 */

type WikipediaSummary = {
    type?: string;
    title?: string;
    extract?: string;
    thumbnail?: { source?: string; width?: number; height?: number };
    content_urls?: { desktop?: { page?: string } };
};

const MAX_CANDIDATES = 4;

export async function GET(request: NextRequest) {
    const candidates = (request.nextUrl.searchParams.get("titles") ?? "")
        .split("|")
        .map((title) => title.trim())
        .filter((title) => title.length > 0 && title.length <= 120)
        .slice(0, MAX_CANDIDATES);

    if (candidates.length === 0) {
        return NextResponse.json({ ok: false, error: "Missing titles" }, { status: 400 });
    }

    try {
        for (const title of candidates) {
            const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`, {
                next: { revalidate: 604800 },
                headers: {
                    Accept: "application/json",
                    "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch; contact: luis.moran@mail.ch)",
                },
            });

            if (response.status === 404) continue;
            if (!response.ok) throw new Error(`Wikipedia returned ${response.status}`);

            const data = (await response.json()) as WikipediaSummary;
            if (data.type === "disambiguation" || !data.extract) continue;

            return NextResponse.json(
                {
                    ok: true,
                    title: data.title ?? title,
                    extract: data.extract,
                    image: data.thumbnail?.source ?? null,
                    url: data.content_urls?.desktop?.page ?? null,
                    attribution: "Wikipedia (CC BY-SA 4.0)",
                },
                { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } }
            );
        }

        return NextResponse.json(
            { ok: false, error: "No article found" },
            { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } }
        );
    } catch (error) {
        console.error("STARS sky-info error:", error);
        return NextResponse.json(
            { ok: false, error: error instanceof Error ? error.message : "Sky info unavailable" },
            { status: 502 }
        );
    }
}
