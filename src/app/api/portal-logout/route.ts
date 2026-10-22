import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
    const response = NextResponse.redirect(
        new URL("/portal/login", request.url),
        303
    );

    response.cookies.set(sessionCookieName("portal"), "", sessionCookieOptions(0));

    return response;
}
