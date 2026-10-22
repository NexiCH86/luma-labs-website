import { NextResponse } from "next/server";
import { clearLoginFailures, clientIp, isLoginBlocked, recordLoginFailure } from "@/lib/login-throttle";
import {
    SESSION_MAX_AGE_SECONDS,
    checkCredentials,
    createSessionToken,
    getSafeNextPath,
    hasCredentials,
    sessionCookieName,
    sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
    const formData = await request.formData();
    const nextPath = getSafeNextPath(formData.get("next"));

    if (!hasCredentials("portal")) {
        return NextResponse.json(
            {
                error:
                    "PORTAL_USERNAME oder PORTAL_PASSWORD ist nicht konfiguriert.",
            },
            { status: 500 }
        );
    }

    const ip = clientIp(request);
    const blocked = await isLoginBlocked("portal", ip);

    if (blocked || !checkCredentials("portal", formData.get("username"), formData.get("password"))) {
        if (!blocked) await recordLoginFailure("portal", ip);

        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("error", blocked ? "locked" : "1");
        loginUrl.searchParams.set("next", nextPath);

        return NextResponse.redirect(loginUrl, 303);
    }

    await clearLoginFailures("portal", ip);
    const response = NextResponse.redirect(
        new URL(nextPath, request.url),
        303
    );

    response.cookies.set(
        sessionCookieName("portal"),
        createSessionToken("portal")!,
        sessionCookieOptions(SESSION_MAX_AGE_SECONDS)
    );

    return response;
}
