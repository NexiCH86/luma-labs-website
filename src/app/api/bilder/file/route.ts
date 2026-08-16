import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        return NextResponse.json(
            { error: "Nicht autorisiert." },
            { status: 401 }
        );
    }

    const url = new URL(request.url);
    const pathname = url.searchParams.get("path");

    if (!pathname || !pathname.startsWith("bilder/")) {
        return NextResponse.json(
            { error: "Ungültiger Bildpfad." },
            { status: 400 }
        );
    }

    try {
        const result = await get(pathname, {
            access: "private",
        });

        if (!result || result.statusCode !== 200) {
            return NextResponse.json(
                { error: "Bild nicht gefunden." },
                { status: 404 }
            );
        }

        return new Response(result.stream, {
            headers: {
                "Content-Type":
                    result.blob.contentType ?? "application/octet-stream",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Bild konnte nicht geladen werden." },
            { status: 500 }
        );
    }
}