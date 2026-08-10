import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { get } from "@vercel/blob";

const presentationFiles: Record<string, string> = {
    "1": "Präsentation 1.png",
    "2": "Präsentation 2.png",
    "3": "Präsentation 3.png",
    "4": "Präsentation 4.png",
};

export async function GET(
    request: Request,
    context: {
        params: Promise<{ id: string }>;
    }
) {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        return NextResponse.json(
            { error: "Nicht autorisiert." },
            { status: 401 }
        );
    }

    const { id } = await context.params;
    const fileName = presentationFiles[id];

    if (!fileName) {
        return NextResponse.json(
            { error: "Präsentation nicht gefunden." },
            { status: 404 }
        );
    }

    try {
        const result = await get(fileName, {
            access: "private",
        });

        if (!result || result.statusCode !== 200) {
            return NextResponse.json(
                { error: "Präsentation nicht gefunden." },
                { status: 404 }
            );
        }

        return new Response(result.stream, {
            headers: {
                "Content-Type": result.blob.contentType ?? "image/png",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Datei konnte nicht geladen werden." },
            { status: 500 }
        );
    }
}
