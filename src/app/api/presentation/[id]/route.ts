import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

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

    const filePath = path.join(
        process.cwd(),
        "private",
        "presentations",
        fileName
    );

    try {
        const file = await readFile(filePath);

        return new Response(file, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "private, no-store",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Datei konnte nicht geladen werden." },
            { status: 500 }
        );
    }
}