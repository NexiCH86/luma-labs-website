import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type LayerKey = "countries" | "fir";

const FILES: Record<LayerKey, string> = {
    countries: "countries.geojson",
    fir: "fir.geojson",
};

export async function GET(request: NextRequest) {
    const layer = request.nextUrl.searchParams.get("layer")?.trim().toLowerCase() as LayerKey | undefined;

    if (!layer || !(layer in FILES)) {
        return NextResponse.json(
            { error: "Missing or invalid airspace layer. Use countries or fir." },
            { status: 400 }
        );
    }

    try {
        const filePath = path.join(
            process.cwd(),
            "public",
            "data",
            "airspace",
            FILES[layer]
        );

        const raw = await readFile(filePath, "utf8");
        const geojson = JSON.parse(raw);

        return NextResponse.json(geojson, {
            headers: {
                "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
            },
        });
    } catch (error) {
        const code =
            error && typeof error === "object" && "code" in error
                ? String(error.code)
                : "";

        if (code === "ENOENT") {
            return NextResponse.json(
                {
                    error: "Airspace data not synced. Run npm run radar:sync-airspace.",
                    layer,
                },
                { status: 503 }
            );
        }

        console.error("LuMa airspace lookup failed:", error);
        return NextResponse.json(
            { error: "Airspace lookup failed", layer },
            { status: 500 }
        );
    }
}
