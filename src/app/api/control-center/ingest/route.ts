import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type ServiceState = "online" | "offline" | "unknown";

type GpuTelemetry = {
    name?: string | null;
    utilizationPercent?: number | null;
    temperatureC?: number | null;
    memoryUsedMb?: number | null;
    memoryTotalMb?: number | null;
    powerDrawW?: number | null;
    powerLimitW?: number | null;
};

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
    gpu?: GpuTelemetry | null;
    services?: Record<string, ServiceState>;
};

const allowedDevices = new Set(["luisserver", "master-intel", "master-mac", "kali-mac"]);

function getRedis() {
    const url = process.env.CONTROL_REDIS_REST_URL;
    const token = process.env.CONTROL_REDIS_REST_TOKEN;

    if (!url || !token) {
        throw new Error("CONTROL_REDIS_REST_URL or CONTROL_REDIS_REST_TOKEN is missing");
    }

    return new Redis({ url, token });
}

function validNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function optionalNumber(value: unknown) {
    return validNumber(value) ? value : null;
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
            typeof payload.device !== "string" ||
            !allowedDevices.has(payload.device) ||
            typeof payload.hostname !== "string" ||
            !validNumber(payload.uptimeSeconds) ||
            !validNumber(payload.cpuPercent) ||
            !validNumber(payload.memoryPercent) ||
            !validNumber(payload.diskPercent)
        ) {
            return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
        }

        const now = Date.now();
        const gpu = payload.gpu && typeof payload.gpu === "object"
            ? {
                name: typeof payload.gpu.name === "string" ? payload.gpu.name.slice(0, 120) : null,
                utilizationPercent: optionalNumber(payload.gpu.utilizationPercent),
                temperatureC: optionalNumber(payload.gpu.temperatureC),
                memoryUsedMb: optionalNumber(payload.gpu.memoryUsedMb),
                memoryTotalMb: optionalNumber(payload.gpu.memoryTotalMb),
                powerDrawW: optionalNumber(payload.gpu.powerDrawW),
                powerLimitW: optionalNumber(payload.gpu.powerLimitW),
            }
            : null;

        const snapshot: ControlTelemetry & { receivedAt: number } = {
            device: payload.device,
            hostname: payload.hostname.slice(0, 100),
            ip: typeof payload.ip === "string" ? payload.ip.slice(0, 100) : null,
            timestamp: validNumber(payload.timestamp) ? payload.timestamp : now,
            receivedAt: now,
            uptimeSeconds: payload.uptimeSeconds,
            cpuPercent: Math.max(0, Math.min(100, payload.cpuPercent)),
            memoryPercent: Math.max(0, Math.min(100, payload.memoryPercent)),
            memoryUsedGb: optionalNumber(payload.memoryUsedGb),
            memoryTotalGb: optionalNumber(payload.memoryTotalGb),
            temperatureC: optionalNumber(payload.temperatureC),
            diskPercent: Math.max(0, Math.min(100, payload.diskPercent)),
            diskUsedGb: optionalNumber(payload.diskUsedGb),
            diskTotalGb: optionalNumber(payload.diskTotalGb),
            gpu,
            services: payload.services ?? {},
        };

        const redis = getRedis();
        await redis.set(`control:device:${payload.device}`, snapshot, { ex: 360 });

        return NextResponse.json({ ok: true, device: payload.device, receivedAt: now });
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
