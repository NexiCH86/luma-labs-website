import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
    const response = NextResponse.redirect(new URL("/control-center/login", request.url), 303);
    response.cookies.set(sessionCookieName("control-center"), "", sessionCookieOptions(0));
    return response;
}
