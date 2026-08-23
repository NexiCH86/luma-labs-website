import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    Activity,
    AppWindow,
    Cpu,
    Database,
    Gauge,
    Globe2,
    HardDrive,
    Laptop,
    LockKeyhole,
    LogOut,
    MemoryStick,
    Network,
    Radio,
    Server,
    ShieldCheck,
    TerminalSquare,
    Thermometer,
    TimerReset,
    Wifi,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Status = "online" | "offline" | "standby" | "planned";
type ServiceState = "online" | "offline" | "unknown";

type LuisServerTelemetry = {
    device: "luisserver";
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
    services?: Record<string, ServiceState>;
};

type Device = {
    name: string;
    role: string;
    os: string;
    detail: string;
    status: Status;
    icon: typeof Laptop;
};

const baseDevices: Device[] = [
    {
        name: "Master-Intel",
        role: "Primary Workstation",
        os: "Windows 11 Pro",
        detail: "i9-13900K · 128 GB RAM · RTX 4090",
        status: "standby",
        icon: Cpu,
    },
    {
        name: "Master-Mac",
        role: "Mobile Development",
        os: "macOS",
        detail: "MacBook Pro · M1 Pro · 16 GB RAM",
        status: "standby",
        icon: Laptop,
    },
    {
        name: "Kali-Mac",
        role: "Cyber Lab",
        os: "Kali Linux",
        detail: "MacBook Pro Intel · 32 GB RAM",
        status: "standby",
        icon: TerminalSquare,
    },
];

const services = [
    { name: "LuMa RADAR", description: "AIR tracking platform", icon: Radio },
    { name: "Collector", description: "OpenSky ingest service", icon: Activity },
    { name: "lumalabs.ch", description: "Next.js · Vercel", icon: Globe2 },
    { name: "Control API", description: "Device telemetry layer", icon: Network },
];

const infrastructure = [
    { name: "Docker", key: "docker", icon: Database },
    { name: "Portainer", key: "portainer", icon: AppWindow },
    { name: "Uptime Kuma", key: "uptimeKuma", icon: Gauge },
    { name: "Nginx Proxy Manager", key: "nginxProxyManager", icon: Network },
    { name: "File Browser", key: "fileBrowser", icon: HardDrive },
];

function getRedis() {
    const url = process.env.RADAR_REDIS_KV_REST_API_URL;
    const token = process.env.RADAR_REDIS_KV_REST_API_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
}

async function getLuisServerTelemetry() {
    try {
        const redis = getRedis();
        if (!redis) return null;
        return await redis.get<LuisServerTelemetry>("control:device:luisserver");
    } catch (error) {
        console.error("Control Center telemetry read failed:", error);
        return null;
    }
}

function StatusPill({ status }: { status: Status }) {
    const styles: Record<Status, string> = {
        online: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
        offline: "border-red-400/20 bg-red-400/5 text-red-300",
        standby: "border-amber-300/20 bg-amber-300/5 text-amber-200",
        planned: "border-cyan-300/20 bg-cyan-300/5 text-cyan-200",
    };

    const labels: Record<Status, string> = {
        online: "ONLINE",
        offline: "OFFLINE",
        standby: "TELEMETRY PENDING",
        planned: "INTEGRATION NEXT",
    };

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

function ServiceStateLabel({ state }: { state: ServiceState }) {
    const styles = {
        online: "text-emerald-300",
        offline: "text-red-300",
        unknown: "text-white/25",
    };
    const labels = { online: "ONLINE", offline: "OFFLINE", unknown: "UNKNOWN" };
    return <span className={`text-[10px] font-medium tracking-[0.14em] ${styles[state]}`}>{labels[state]}</span>;
}

function formatUptime(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function MetricCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: string;
    detail?: string;
    icon: typeof Cpu;
}) {
    return (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">{label}</span>
                <Icon className="h-4 w-4 text-cyan-200/45" />
            </div>
            <p className="mt-3 text-2xl font-medium tracking-tight">{value}</p>
            {detail && <p className="mt-1 text-[11px] text-white/25">{detail}</p>}
        </div>
    );
}

export default async function ControlCenterPage() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        redirect("/portal/login?next=/control-center");
    }

    const telemetry = await getLuisServerTelemetry();
    const isLuisServerOnline = telemetry ? Date.now() - telemetry.receivedAt < 90_000 : false;
    const luisServerStatus: Status = isLuisServerOnline ? "online" : "offline";

    const devices: Device[] = [
        ...baseDevices,
        {
            name: "LuisServer",
            role: "24/7 Infrastructure",
            os: "Raspberry Pi OS",
            detail: telemetry
                ? `${telemetry.hostname}${telemetry.ip ? ` · ${telemetry.ip}` : ""}`
                : "Raspberry Pi 5 · 16 GB RAM",
            status: luisServerStatus,
            icon: Server,
        },
    ];

    return (
        <main className="min-h-screen bg-[#061113] text-white">
            <div className="border-b border-white/5 bg-[#081719]/90">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-7 sm:flex-row sm:items-center">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300/60">
                            <ShieldCheck className="h-4 w-4" />
                            LuMa Labs · Secure Operations
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Control Center</h1>
                        <p className="mt-2 text-sm text-white/40">Infrastructure · Systems · Services</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-2 text-xs text-cyan-100/80">
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Protected Session
                        </div>
                        <form action="/api/portal-logout" method="POST">
                            <button type="submit" className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:border-white/20 hover:text-white">
                                <LogOut className="h-3.5 w-3.5" />
                                Logout
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-6 py-8">
                <section className="mb-8 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5 md:col-span-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/60">System Overview</p>
                        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                            <div>
                                <h2 className="text-2xl font-medium tracking-tight">LuMa Operations Network</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                                    {isLuisServerOnline
                                        ? "LuisServer liefert Live-Telemetrie an das Control Center. Die übrigen LuMa Systeme werden als Nächstes angebunden."
                                        : "Control Center aktiv. LuisServer wartet auf den ersten Telemetrie-Heartbeat."}
                                </p>
                            </div>
                            <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-medium tracking-[0.14em] text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                CONTROL CENTER ONLINE
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/35">Security</p>
                        <div className="mt-5 flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/5">
                                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                            </div>
                            <div>
                                <p className="font-medium">Authenticated</p>
                                <p className="mt-1 text-xs text-white/35">HTTP-only session cookie</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mb-10">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Devices</p>
                            <h2 className="mt-2 text-xl font-medium">LuMa Systems</h2>
                        </div>
                        <p className="text-xs text-white/25">4 registered devices</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {devices.map((device) => {
                            const Icon = device.icon;
                            return (
                                <article key={device.name} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-cyan-300/20 hover:bg-white/[0.035]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04]">
                                            <Icon className="h-4.5 w-4.5 text-cyan-200" />
                                        </div>
                                        <StatusPill status={device.status} />
                                    </div>
                                    <h3 className="mt-5 font-medium">{device.name}</h3>
                                    <p className="mt-1 text-xs text-cyan-200/45">{device.role}</p>
                                    <div className="mt-5 border-t border-white/5 pt-4">
                                        <p className="text-xs text-white/55">{device.os}</p>
                                        <p className="mt-1.5 text-[11px] leading-5 text-white/25">{device.detail}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="mb-10">
                    <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Live Telemetry</p>
                            <h2 className="mt-2 text-xl font-medium">LuisServer</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/30">
                            <span className={`h-2 w-2 rounded-full ${isLuisServerOnline ? "bg-emerald-300" : "bg-red-300"}`} />
                            {isLuisServerOnline ? "Live" : "No heartbeat"}
                        </div>
                    </div>

                    {telemetry ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <MetricCard label="CPU" value={`${telemetry.cpuPercent.toFixed(1)}%`} icon={Cpu} />
                            <MetricCard
                                label="Memory"
                                value={`${telemetry.memoryPercent.toFixed(1)}%`}
                                detail={telemetry.memoryUsedGb != null && telemetry.memoryTotalGb != null ? `${telemetry.memoryUsedGb.toFixed(1)} / ${telemetry.memoryTotalGb.toFixed(1)} GB` : undefined}
                                icon={MemoryStick}
                            />
                            <MetricCard
                                label="Temperature"
                                value={telemetry.temperatureC != null ? `${telemetry.temperatureC.toFixed(1)} °C` : "—"}
                                icon={Thermometer}
                            />
                            <MetricCard
                                label="Disk"
                                value={`${telemetry.diskPercent.toFixed(1)}%`}
                                detail={telemetry.diskUsedGb != null && telemetry.diskTotalGb != null ? `${telemetry.diskUsedGb.toFixed(1)} / ${telemetry.diskTotalGb.toFixed(1)} GB` : undefined}
                                icon={HardDrive}
                            />
                            <MetricCard label="Uptime" value={formatUptime(telemetry.uptimeSeconds)} icon={TimerReset} />
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-8 text-sm text-white/35">
                            Noch keine LuisServer-Telemetrie empfangen. Sobald der Agent auf dem Raspberry Pi läuft, erscheinen CPU, RAM, Temperatur, Speicher und Uptime automatisch hier.
                        </div>
                    )}
                </section>

                <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
                    <section>
                        <div className="mb-4">
                            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Services</p>
                            <h2 className="mt-2 text-xl font-medium">LuMa Services</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {services.map((service) => {
                                const Icon = service.icon;
                                const collectorState = service.name === "Collector" ? telemetry?.services?.radarCollector : undefined;
                                return (
                                    <div key={service.name} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.035]">
                                            <Icon className="h-4 w-4 text-cyan-200/70" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{service.name}</p>
                                            <p className="mt-1 text-xs text-white/30">{service.description}</p>
                                        </div>
                                        {collectorState ? (
                                            <div className="ml-auto"><ServiceStateLabel state={collectorState} /></div>
                                        ) : (
                                            <Wifi className="ml-auto h-3.5 w-3.5 text-white/15" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section>
                        <div className="mb-4">
                            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Infrastructure</p>
                            <h2 className="mt-2 text-xl font-medium">LuisServer Stack</h2>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
                            {infrastructure.map((item, index) => {
                                const Icon = item.icon;
                                const state = telemetry?.services?.[item.key] ?? "unknown";
                                return (
                                    <div key={item.name} className={`flex items-center gap-3 px-4 py-3.5 ${index !== infrastructure.length - 1 ? "border-b border-white/5" : ""}`}>
                                        <Icon className="h-4 w-4 text-cyan-200/55" />
                                        <span className="text-sm text-white/65">{item.name}</span>
                                        <div className="ml-auto"><ServiceStateLabel state={state} /></div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
