import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    SESSION_MAX_AGE_SECONDS,
    checkCredentials,
    createSessionToken,
    getSafeNextPath,
    verifySessionToken,
} from "../session";
import { sanitizeServices } from "../control-center";

const ENV_KEYS = ["CONTROL_CENTER_USERNAME", "CONTROL_CENTER_PASSWORD", "PORTAL_USERNAME", "PORTAL_PASSWORD"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.CONTROL_CENTER_USERNAME = "test-operator";
    process.env.CONTROL_CENTER_PASSWORD = "test-password-cc";
    process.env.PORTAL_USERNAME = "test-portal";
    process.env.PORTAL_PASSWORD = "test-password-portal";
});

afterEach(() => {
    for (const key of ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

describe("session tokens", () => {
    it("rejects the old fixed cookie value", () => {
        expect(verifySessionToken("control-center", "authenticated")).toBeNull();
        expect(verifySessionToken("portal", "authenticated")).toBeNull();
        expect(verifySessionToken("control-center", undefined)).toBeNull();
    });

    it("accepts a fresh token and returns its expiry", () => {
        const now = 1_800_000_000_000;
        const token = createSessionToken("control-center", now)!;
        expect(verifySessionToken("control-center", token, now + 1000)).toEqual({
            expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
        });
    });

    it("rejects expired tokens", () => {
        const now = 1_800_000_000_000;
        const token = createSessionToken("control-center", now)!;
        expect(verifySessionToken("control-center", token, now + SESSION_MAX_AGE_SECONDS * 1000)).toBeNull();
    });

    it("rejects a token with a changed expiry", () => {
        const now = 1_800_000_000_000;
        const [version, expiresAt, signature] = createSessionToken("control-center", now)!.split(".");
        const extended = `${version}.${Number(expiresAt) + 86_400_000}.${signature}`;
        expect(verifySessionToken("control-center", extended, now)).toBeNull();
    });

    it("does not accept a portal token for the Control Center", () => {
        const now = 1_800_000_000_000;
        const token = createSessionToken("portal", now)!;
        expect(verifySessionToken("control-center", token, now)).toBeNull();
        expect(verifySessionToken("portal", token, now)).not.toBeNull();
    });

    it("invalidates sessions when the password changes", () => {
        const now = 1_800_000_000_000;
        const token = createSessionToken("control-center", now)!;
        process.env.CONTROL_CENTER_PASSWORD = "test-password-new";
        expect(verifySessionToken("control-center", token, now)).toBeNull();
    });

    it("creates no token without configured credentials", () => {
        delete process.env.CONTROL_CENTER_PASSWORD;
        expect(createSessionToken("control-center")).toBeNull();
        expect(verifySessionToken("control-center", "v1.9999999999999.abc")).toBeNull();
    });
});

describe("checkCredentials", () => {
    it("checks username and password", () => {
        expect(checkCredentials("control-center", "test-operator", "test-password-cc")).toBe(true);
        expect(checkCredentials("control-center", "test-operator", "wrong")).toBe(false);
        expect(checkCredentials("control-center", "other", "test-password-cc")).toBe(false);
        expect(checkCredentials("control-center", null, null)).toBe(false);
        expect(checkCredentials("portal", "test-operator", "test-password-cc")).toBe(false);
    });
});

describe("getSafeNextPath", () => {
    it("keeps local paths and rejects other hosts", () => {
        expect(getSafeNextPath("/portal/bilder")).toBe("/portal/bilder");
        expect(getSafeNextPath("//evil.example")).toBe("/portal");
        expect(getSafeNextPath("/\\evil.example")).toBe("/portal");
        expect(getSafeNextPath("https://evil.example")).toBe("/portal");
        expect(getSafeNextPath(null)).toBe("/portal");
    });
});

describe("sanitizeServices", () => {
    it("keeps only known services with valid states", () => {
        expect(sanitizeServices({ docker: "online", portainer: "broken", extra: "online", radarCollector: "offline" })).toEqual({
            docker: "online",
            radarCollector: "offline",
        });
        expect(sanitizeServices("online")).toEqual({});
        expect(sanitizeServices(["online"])).toEqual({});
        expect(sanitizeServices(null)).toEqual({});
    });
});
