import { getControlRedis } from "@/lib/control-center";
import type { SessionArea } from "@/lib/session";

/*
 * Sperre nach zu vielen Fehlversuchen: 10 falsche Logins je IP und
 * Bereich in 15 Minuten. Zaehlt im Control-Center-Redis, damit alle
 * Vercel-Instanzen dieselbe Zahl sehen. Ohne Redis zaehlt jede Instanz
 * fuer sich.
 */
const MAX_FAILURES = 10;
const WINDOW_SECONDS = 15 * 60;

const memory = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function key(area: SessionArea, ip: string) {
  return `auth:fail:${area}:${ip}`;
}

function memoryCount(k: string) {
  const entry = memory.get(k);
  if (!entry || entry.resetAt <= Date.now()) {
    memory.delete(k);
    return 0;
  }
  return entry.count;
}

export async function isLoginBlocked(area: SessionArea, ip: string) {
  const k = key(area, ip);
  const redis = getControlRedis();
  if (redis) {
    try {
      return ((await redis.get<number>(k)) ?? 0) >= MAX_FAILURES;
    } catch (error) {
      console.error("Login throttle read failed:", error);
    }
  }
  return memoryCount(k) >= MAX_FAILURES;
}

export async function recordLoginFailure(area: SessionArea, ip: string) {
  const k = key(area, ip);
  const redis = getControlRedis();
  if (redis) {
    try {
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, WINDOW_SECONDS);
      return;
    } catch (error) {
      console.error("Login throttle write failed:", error);
    }
  }
  const entry = memory.get(k);
  if (!entry || entry.resetAt <= Date.now()) {
    memory.set(k, { count: 1, resetAt: Date.now() + WINDOW_SECONDS * 1000 });
  } else {
    entry.count += 1;
  }
}

export async function clearLoginFailures(area: SessionArea, ip: string) {
  const k = key(area, ip);
  memory.delete(k);
  const redis = getControlRedis();
  if (!redis) return;
  try {
    await redis.del(k);
  } catch (error) {
    console.error("Login throttle reset failed:", error);
  }
}
