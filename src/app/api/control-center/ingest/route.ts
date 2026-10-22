import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
    DEVICE_IDS,
    LAST_SEEN_TTL_SECONDS,
    SNAPSHOT_TTL_SECONDS,
    getControlRedis,
    lastSeenKey,
    sanitizeServices,
    snapshotKey,
    type DeviceTelemetry,
    type GpuTelemetry,
} from "@/lib/control-center";

type IncomingTelemetry = Omit<DeviceTelemetry, "receivedAt" | "gpu" | "services"> & {
    gpu?: Partial<Record<keyof GpuTelemetry, unknown>> | null;
    services?: unknown;
};

function validNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function optionalNumber(value: unknown) {
    return validNumber(value) ? value : null;
}

function percent(value: number) {
    return Math.max(0, Math.min(100, value));
}

function secretMatches(provided: string, expected: string) {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    /*
     * Die Agents senden heute noch mit RADAR_INGEST_SECRET, ein eigenes
     * CONTROL_INGEST_SECRET ist in Vercel nicht gesetzt. Sobald es gesetzt
     * und auf allen Geraeten verteilt ist, den Rueckfall entfernen.
     */
    const expectedSecret =
        process.env.CONTROL_INGEST_SECRET ?? process.env.RADAR_INGEST_SECRET;

    if (!expectedSecret) {
        return NextResponse.json(
            { error: "CONTROL_INGEST_SECRET is not configured" },
            { status: 500 }
        );
    }

    const providedSecret = request.headers.get("x-control-secret");
    if (!providedSecret || !secretMatches(providedSecret, expectedSecret)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: Partial<IncomingTelemetry>;
    try {
        payload = (await request.json()) as Partial<IncomingTelemetry>;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (
        !payload ||
        typeof payload.device !== "string" ||
        !DEVICE_IDS.has(payload.device) ||
        typeof payload.hostname !== "string" ||
        !validNumber(payload.uptimeSeconds) ||
        !validNumber(payload.cpuPercent) ||
        !validNumber(payload.memoryPercent) ||
        !validNumber(payload.diskPercent)
    ) {
        return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
    }

    const redis = getControlRedis();
    if (!redis) {
        return NextResponse.json({ error: "Control Center store is not configured" }, { status: 500 });
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

    const snapshot: DeviceTelemetry = {
        device: payload.device,
        hostname: payload.hostname.slice(0, 100),
        ip: typeof payload.ip === "string" ? payload.ip.slice(0, 100) : null,
        timestamp: validNumber(payload.timestamp) ? payload.timestamp : now,
        receivedAt: now,
        uptimeSeconds: Math.max(0, payload.uptimeSeconds),
        cpuPercent: percent(payload.cpuPercent),
        memoryPercent: percent(payload.memoryPercent),
        memoryUsedGb: optionalNumber(payload.memoryUsedGb),
        memoryTotalGb: optionalNumber(payload.memoryTotalGb),
        temperatureC: optionalNumber(payload.temperatureC),
        diskPercent: percent(payload.diskPercent),
        diskUsedGb: optionalNumber(payload.diskUsedGb),
        diskTotalGb: optionalNumber(payload.diskTotalGb),
        gpu,
        services: sanitizeServices(payload.services),
    };

    try {
        /* lastseen bleibt laenger stehen, damit das Dashboard "offline seit" zeigen kann. */
        await Promise.all([
            redis.set(snapshotKey(payload.device), snapshot, { ex: SNAPSHOT_TTL_SECONDS }),
            redis.set(lastSeenKey(payload.device), now, { ex: LAST_SEEN_TTL_SECONDS }),
        ]);
    } catch (error) {
        console.error("Control Center ingest error:", error);
        return NextResponse.json({ error: "Control Center ingest failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, device: payload.device, receivedAt: now });
}
