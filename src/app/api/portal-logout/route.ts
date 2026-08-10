import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const response = NextResponse.redirect(
        new URL("/portal/login", request.url),
        303
    );

    response.cookies.set("luma_portal_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return response;
}