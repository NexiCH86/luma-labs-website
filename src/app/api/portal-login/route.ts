import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const formData = await request.formData();

    const username = formData.get("username");
    const password = formData.get("password");

    const portalUsername = process.env.PORTAL_USERNAME;
    const portalPassword = process.env.PORTAL_PASSWORD;

    if (!portalUsername || !portalPassword) {
        return NextResponse.json(
            {
                error:
                    "PORTAL_USERNAME oder PORTAL_PASSWORD ist nicht konfiguriert.",
            },
            { status: 500 }
        );
    }

    const usernameIsValid = username === portalUsername;
    const passwordIsValid = password === portalPassword;

    if (!usernameIsValid || !passwordIsValid) {
        return NextResponse.redirect(
            new URL("/portal/login?error=1", request.url),
            303
        );
    }

    const response = NextResponse.redirect(
        new URL("/portal", request.url),
        303
    );

    response.cookies.set("luma_portal_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
    });

    return response;
}

