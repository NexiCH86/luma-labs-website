import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const formData = await request.formData();
    const username = formData.get("username");
    const password = formData.get("password");

    const controlUsername = process.env.CONTROL_CENTER_USERNAME;
    const controlPassword = process.env.CONTROL_CENTER_PASSWORD;

    if (!controlUsername || !controlPassword) {
        return NextResponse.json(
            { error: "CONTROL_CENTER_USERNAME oder CONTROL_CENTER_PASSWORD ist nicht konfiguriert." },
            { status: 500 }
        );
    }

    if (username !== controlUsername || password !== controlPassword) {
        return NextResponse.redirect(new URL("/control-center/login?error=1", request.url), 303);
    }

    const response = NextResponse.redirect(new URL("/control-center", request.url), 303);
    response.cookies.set("luma_control_center_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
    });

    return response;
}
