import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Signierte Sitzungen fuer Control Center und Portal.
 *
 * Frueher stand im Cookie nur der feste Text "authenticated". Wer das
 * Cookie selbst setzte, war ohne Passwort drin. Jetzt enthaelt es
 * Ablaufzeit und HMAC-Signatur. Der Schluessel wird aus Benutzername
 * und Passwort des Bereichs abgeleitet: Ohne Passwort laesst sich keine
 * Sitzung faelschen, und ein neues Passwort meldet alle Sitzungen ab.
 */

export type SessionArea = "control-center" | "portal";

const AREAS: Record<SessionArea, { cookie: string; usernameEnv: string; passwordEnv: string }> = {
  "control-center": {
    cookie: "luma_control_center_session",
    usernameEnv: "CONTROL_CENTER_USERNAME",
    passwordEnv: "CONTROL_CENTER_PASSWORD",
  },
  portal: {
    cookie: "luma_portal_session",
    usernameEnv: "PORTAL_USERNAME",
    passwordEnv: "PORTAL_PASSWORD",
  },
};

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const TOKEN_VERSION = "v1";

function credentials(area: SessionArea) {
  const username = process.env[AREAS[area].usernameEnv];
  const password = process.env[AREAS[area].passwordEnv];
  if (!username || !password) return null;
  return { username, password };
}

export function hasCredentials(area: SessionArea) {
  return credentials(area) !== null;
}

function sign(area: SessionArea, payload: string) {
  const creds = credentials(area);
  if (!creds) return null;
  const key = createHash("sha256")
    .update(`luma-session\0${area}\0${creds.username}\0${creds.password}`)
    .digest();
  return createHmac("sha256", key).update(`${area}.${payload}`).digest("base64url");
}

/* Vergleich mit fester Laufzeit, auch bei unterschiedlicher Laenge. */
function safeEqual(a: string, b: string) {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function checkCredentials(area: SessionArea, username: unknown, password: unknown) {
  const creds = credentials(area);
  if (!creds || typeof username !== "string" || typeof password !== "string") return false;
  const usernameOk = safeEqual(username, creds.username);
  const passwordOk = safeEqual(password, creds.password);
  return usernameOk && passwordOk;
}

export function createSessionToken(area: SessionArea, now = Date.now()) {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${TOKEN_VERSION}.${expiresAt}`;
  const signature = sign(area, payload);
  return signature ? `${payload}.${signature}` : null;
}

export function verifySessionToken(area: SessionArea, token: string | undefined, now = Date.now()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;

  const expected = sign(area, `${parts[0]}.${parts[1]}`);
  if (!expected || !safeEqual(parts[2], expected)) return null;

  return { expiresAt };
}

export function sessionCookieName(area: SessionArea) {
  return AREAS[area].cookie;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/* Ziel nach dem Portal-Login: nur Pfade auf dieser Seite, "//" und "/\" waeren fremde Hosts. */
export function getSafeNextPath(value: unknown) {
  if (typeof value !== "string") return "/portal";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/portal";
  return value;
}

/* Fuer Seiten und Route Handler: gueltige Sitzung oder null. */
export async function readSession(area: SessionArea) {
  const cookieStore = await cookies();
  return verifySessionToken(area, cookieStore.get(AREAS[area].cookie)?.value);
}
