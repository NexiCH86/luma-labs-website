import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        return NextResponse.json(
            { error: "Nicht autorisiert." },
            { status: 401 }
        );
    }

    try {
        const result = await list({
            prefix: "bilder/",
        });

        const images = result.blobs
            .filter((blob) =>
                /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(blob.pathname)
            )
            .map((blob) => ({
                pathname: blob.pathname,
                name: blob.pathname.split("/").pop() ?? blob.pathname,
                folder:
                    blob.pathname
                        .replace(/^bilder\//, "")
                        .split("/")
                        .slice(0, -1)
                        .join("/") || "Ohne Ordner",
                size: blob.size,
                uploadedAt: blob.uploadedAt,
            }));

        return NextResponse.json({ images });
    } catch (error) {
        console.error("Bilder konnten nicht geladen werden:", error);

        return NextResponse.json(
            { error: "Bilder konnten nicht geladen werden." },
            { status: 500 }
        );
    }
}