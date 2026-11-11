import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readSession } from "@/lib/session";

/*
 * BOG Fusion Nutzenrechner (NEX-272).
 *
 * Das Repo ist oeffentlich, deshalb liegt die Seite selbst nicht hier,
 * sondern privat in Vercel Blob (wie Benchmark und Praesentationen).
 * Ohne Portal-Sitzung geht es zum Login und danach zurueck hierher.
 */

const BLOB_PATH = "portal/fusion-nutzenrechner.html";
const SELF_PATH = "/portal/nutzenrechner";

export async function GET(request: Request) {
    const session = await readSession("portal");

    if (!session) {
        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("next", SELF_PATH);
        return NextResponse.redirect(loginUrl, 303);
    }

    try {
        // Direkt aus dem Speicher lesen: nach einem neuen Upload sofort die neue Fassung.
        const result = await get(BLOB_PATH, { access: "private", useCache: false });

        if (!result || result.statusCode !== 200) {
            return new Response("Der Nutzenrechner ist nicht hinterlegt.", {
                status: 404,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        return new Response(result.stream, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
                "X-Robots-Tag": "noindex, nofollow",
                "Referrer-Policy": "same-origin",
            },
        });
    } catch {
        return new Response("Der Nutzenrechner konnte nicht geladen werden.", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }
}
