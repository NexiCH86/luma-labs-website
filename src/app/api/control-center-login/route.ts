import { NextResponse } from "next/server";
import { clearLoginFailures, clientIp, isLoginBlocked, recordLoginFailure } from "@/lib/login-throttle";
import {
    SESSION_MAX_AGE_SECONDS,
    checkCredentials,
    createSessionToken,
    hasCredentials,
    sessionCookieName,
    sessionCookieOptions,
} from "@/lib/session";

export async function POST(request: Request) {
    if (!hasCredentials("control-center")) {
        return NextResponse.json(
            { error: "CONTROL_CENTER_USERNAME oder CONTROL_CENTER_PASSWORD ist nicht konfiguriert." },
            { status: 500 }
        );
    }

    const ip = clientIp(request);
    if (await isLoginBlocked("control-center", ip)) {
        return NextResponse.redirect(new URL("/control-center/login?error=locked", request.url), 303);
    }

    const formData = await request.formData();
    if (!checkCredentials("control-center", formData.get("username"), formData.get("password"))) {
        await recordLoginFailure("control-center", ip);
        return NextResponse.redirect(new URL("/control-center/login?error=1", request.url), 303);
    }

    await clearLoginFailures("control-center", ip);
    const response = NextResponse.redirect(new URL("/control-center", request.url), 303);
    response.cookies.set(
        sessionCookieName("control-center"),
        createSessionToken("control-center")!,
        sessionCookieOptions(SESSION_MAX_AGE_SECONDS)
    );

    return response;
}
