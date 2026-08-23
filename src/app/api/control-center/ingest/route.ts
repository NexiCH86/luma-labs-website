import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type ServiceState = "online" | "offline" | "unknown";

type ControlTelemetry = {
    device: string;
    hostname: string;
    ip?: string | null;
    timestamp?: number;
    uptimeSeconds: number;
    cpuPercent: number;
    memoryPercent: number;
    memoryUsedGb?: number | null;
    memoryTotalGb?: number | null;
    temperatureC?: number | null;
    diskPercent: number;
    diskUsedGb?: number | null;
    diskTotalGb?: number | null;
    services?: Record<string, ServiceState>;
};

function getRedis() {
    const url = process.env.RADAR_REDIS_KV_REST_API_URL;
    const token = process.env.RADAR_REDIS_KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error("Control Center Redis environment variables are missing");
    }

    return new Redis({ url, token });
}

function validNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: NextRequest) {
    try {
        const expectedSecret =
            process.env.CONTROL_INGEST_SECRET ?? process.env.RADAR_INGEST_SECRET;

        if (!expectedSecret) {
            return NextResponse.json(
                { error: "CONTROL_INGEST_SECRET is not configured" },
                { status: 500 }
            );
        }

        const providedSecret = request.headers.get("x-control-secret");
        if (!providedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = (await request.json()) as Partial<ControlTelemetry>;

        if (
            payload.device !== "luisserver" ||
            typeof payload.hostname !== "string" ||
            !validNumber(payload.uptimeSeconds) ||
            !validNumber(payload.cpuPercent) ||
            !validNumber(payload.memoryPercent) ||
            !validNumber(payload.diskPercent)
        ) {
            return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
        }

        const now = Date.now();
        const snapshot: ControlTelemetry & { receivedAt: number } = {
            device: "luisserver",
            hostname: payload.hostname.slice(0, 100),
            ip: typeof payload.ip === "string" ? payload.ip.slice(0, 100) : null,
            timestamp: validNumber(payload.timestamp) ? payload.timestamp : now,
            receivedAt: now,
            uptimeSeconds: payload.uptimeSeconds,
            cpuPercent: Math.max(0, Math.min(100, payload.cpuPercent)),
            memoryPercent: Math.max(0, Math.min(100, payload.memoryPercent)),
            memoryUsedGb: validNumber(payload.memoryUsedGb) ? payload.memoryUsedGb : null,
            memoryTotalGb: validNumber(payload.memoryTotalGb) ? payload.memoryTotalGb : null,
            temperatureC: validNumber(payload.temperatureC) ? payload.temperatureC : null,
            diskPercent: Math.max(0, Math.min(100, payload.diskPercent)),
            diskUsedGb: validNumber(payload.diskUsedGb) ? payload.diskUsedGb : null,
            diskTotalGb: validNumber(payload.diskTotalGb) ? payload.diskTotalGb : null,
            services: payload.services ?? {},
        };

        const redis = getRedis();
        await redis.set("control:device:luisserver", snapshot, { ex: 120 });

        return NextResponse.json({ ok: true, receivedAt: now });
    } catch (error) {
        console.error("Control Center ingest error:", error);
        return NextResponse.json(
            {
                error: "Control Center ingest failed",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
