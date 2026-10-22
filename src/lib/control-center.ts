import { Redis } from "@upstash/redis";

/*
 * Gemeinsame Typen und Datenzugriff fuer das Control Center
 * (Dashboard und Ingest-API). Die Agents in scripts/ schicken alle
 * 90 s einen Messwert-Snapshot.
 */

export type ServiceState = "online" | "offline" | "unknown";

export type GpuTelemetry = {
  name?: string | null;
  utilizationPercent?: number | null;
  temperatureC?: number | null;
  memoryUsedMb?: number | null;
  memoryTotalMb?: number | null;
  powerDrawW?: number | null;
  powerLimitW?: number | null;
};

export type DeviceTelemetry = {
  device: string;
  hostname: string;
  ip?: string | null;
  timestamp?: number;
  receivedAt: number;
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

export type DeviceInfo = {
  id: string;
  name: string;
  role: string;
  os: string;
  hardware: string;
  /* Liefert die Dienste des Server-Stacks (Docker, Portainer …). */
  infrastructure?: boolean;
  gpu?: boolean;
};

/*
 * Seit 18.09.2026 ist der Keller-Pi (luma-server-pi5) der 24/7-Knoten
 * mit RADAR-Collector und Wake-on-LAN (NEX-189). Der Buero-Pi
 * (LuisServer, luma-pi5) ist meist offline.
 */
export const DEVICES: DeviceInfo[] = [
  { id: "master-intel", name: "Master-Intel", role: "Primary Workstation", os: "Windows 11 Pro", hardware: "i9-13900K · 128 GB RAM · RTX 4090", gpu: true },
  { id: "master-mac", name: "Master-Mac", role: "Mobile Development", os: "macOS", hardware: "MacBook Pro · M1 Pro · 16 GB RAM" },
  { id: "kali-mac", name: "Kali-Mac", role: "Cyber Lab", os: "Kali Linux", hardware: "MacBook Pro Intel · 32 GB RAM" },
  { id: "server-pi", name: "Server-Pi", role: "24/7 Infrastructure · Keller", os: "Raspberry Pi OS", hardware: "Raspberry Pi 5 · luma-server-pi5", infrastructure: true },
  { id: "luisserver", name: "LuisServer", role: "Büro-Pi · Reserve", os: "Raspberry Pi OS", hardware: "Raspberry Pi 5 · 16 GB RAM", infrastructure: true },
];

export const DEVICE_IDS = new Set(DEVICES.map((device) => device.id));

/* Ohne Messwert seit 4 Minuten gilt ein Geraet als offline. */
export const ONLINE_WINDOW_MS = 240_000;
export const SNAPSHOT_TTL_SECONDS = 360;
export const LAST_SEEN_TTL_SECONDS = 60 * 60 * 24 * 90;

export const SERVICE_KEYS = ["radarCollector", "docker", "portainer", "uptimeKuma", "nginxProxyManager", "fileBrowser"] as const;

export function snapshotKey(device: string) {
  return `control:device:${device}`;
}

export function lastSeenKey(device: string) {
  return `control:lastseen:${device}`;
}

export function getControlRedis() {
  const url = process.env.CONTROL_REDIS_REST_URL;
  const token = process.env.CONTROL_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/* Nur bekannte Dienste mit gueltigem Zustand uebernehmen. */
export function sanitizeServices(value: unknown): Record<string, ServiceState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const services: Record<string, ServiceState> = {};
  for (const key of SERVICE_KEYS) {
    const state = input[key];
    if (state === "online" || state === "offline" || state === "unknown") services[key] = state;
  }
  return services;
}

export type DeviceReading = {
  telemetry: DeviceTelemetry | null;
  lastSeen: number | null;
  online: boolean;
};

export type ControlReadings = {
  /* false, wenn Redis fehlt oder nicht erreichbar war. */
  storeOk: boolean;
  /* Zeitpunkt der Abfrage, Bezug fuer "vor X Minuten". */
  readAt: number;
  devices: Record<string, DeviceReading>;
};

export async function readControlTelemetry(now = Date.now()): Promise<ControlReadings> {
  const empty = Object.fromEntries(DEVICES.map((device) => [device.id, { telemetry: null, lastSeen: null, online: false }]));
  const redis = getControlRedis();
  if (!redis) return { storeOk: false, readAt: now, devices: empty };

  try {
    const keys = DEVICES.flatMap((device) => [snapshotKey(device.id), lastSeenKey(device.id)]);
    const values = await redis.mget<(DeviceTelemetry | number | null)[]>(...keys);
    const devices: Record<string, DeviceReading> = {};
    DEVICES.forEach((device, index) => {
      const telemetry = (values[index * 2] as DeviceTelemetry | null) ?? null;
      const storedLastSeen = values[index * 2 + 1];
      const lastSeen = typeof storedLastSeen === "number" ? storedLastSeen : telemetry?.receivedAt ?? null;
      devices[device.id] = {
        telemetry,
        lastSeen,
        online: telemetry ? now - telemetry.receivedAt < ONLINE_WINDOW_MS : false,
      };
    });
    return { storeOk: true, readAt: now, devices };
  } catch (error) {
    console.error("Control Center telemetry read failed:", error);
    return { storeOk: false, readAt: now, devices: empty };
  }
}
