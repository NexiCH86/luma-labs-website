import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const response = NextResponse.redirect(new URL("/control-center/login", request.url), 303);
    response.cookies.set("luma_control_center_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
    return response;
}
