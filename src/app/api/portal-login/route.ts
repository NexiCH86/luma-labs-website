import { NextResponse } from "next/server";

function getSafeNextPath(value: FormDataEntryValue | null) {
    if (typeof value !== "string") return "/portal";
    if (!value.startsWith("/") || value.startsWith("//")) return "/portal";
    return value;
}

export async function POST(request: Request) {
    const formData = await request.formData();

    const username = formData.get("username");
    const password = formData.get("password");
    const nextPath = getSafeNextPath(formData.get("next"));

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
        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("error", "1");
        loginUrl.searchParams.set("next", nextPath);

        return NextResponse.redirect(loginUrl, 303);
    }

    const response = NextResponse.redirect(
        new URL(nextPath, request.url),
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
