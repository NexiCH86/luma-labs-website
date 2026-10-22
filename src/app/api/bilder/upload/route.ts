import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
    handleUpload,
    type HandleUploadBody,
} from "@vercel/blob/client";
import { sessionCookieName, verifySessionToken } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
    const cookieStore = await cookies();
    const session = verifySessionToken("portal", cookieStore.get(sessionCookieName("portal"))?.value);

    if (!session) {
        return NextResponse.json(
            { error: "Nicht autorisiert." },
            { status: 401 }
        );
    }

    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,

            onBeforeGenerateToken: async (pathname) => {
                if (!pathname.startsWith("bilder/")) {
                    throw new Error("Ungültiger Upload-Pfad.");
                }

                const allowedExtensions = [
                    ".jpg",
                    ".jpeg",
                    ".png",
                    ".webp",
                    ".gif",
                    ".avif",
                    ".svg",
                ];

                const lowerPath = pathname.toLowerCase();

                if (
                    !allowedExtensions.some((extension) =>
                        lowerPath.endsWith(extension)
                    )
                ) {
                    throw new Error("Dateityp nicht erlaubt.");
                }

                return {
                    allowedContentTypes: [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/gif",
                        "image/avif",
                        "image/svg+xml",
                    ],
                    addRandomSuffix: false,
                    allowOverwrite: true,
                };
            },

            onUploadCompleted: async ({ blob }) => {
                console.log("Bild hochgeladen:", blob.pathname);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error("Bild-Upload fehlgeschlagen:", error);

        return NextResponse.json(
            { error: "Upload konnte nicht durchgeführt werden." },
            { status: 400 }
        );
    }
}