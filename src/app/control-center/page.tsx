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
    Network,
    Radio,
    Server,
    ShieldCheck,
    TerminalSquare,
    Wifi,
} from "lucide-react";

type Status = "online" | "standby" | "planned";

type Device = {
    name: string;
    role: string;
    os: string;
    detail: string;
    status: Status;
    icon: typeof Laptop;
};

const devices: Device[] = [
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
    {
        name: "LuisServer",
        role: "24/7 Infrastructure",
        os: "Raspberry Pi OS",
        detail: "Raspberry Pi 5 · 16 GB RAM",
        status: "planned",
        icon: Server,
    },
];

const services = [
    { name: "LuMa RADAR", description: "AIR tracking platform", icon: Radio },
    { name: "Collector", description: "OpenSky ingest service", icon: Activity },
    { name: "lumalabs.ch", description: "Next.js · Vercel", icon: Globe2 },
    { name: "Control API", description: "Device telemetry layer", icon: Network },
];

const infrastructure = [
    { name: "Docker", icon: Database },
    { name: "Portainer", icon: AppWindow },
    { name: "Uptime Kuma", icon: Gauge },
    { name: "Nginx Proxy Manager", icon: Network },
    { name: "File Browser", icon: HardDrive },
];

function StatusPill({ status }: { status: Status }) {
    const styles = {
        online: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
        standby: "border-amber-300/20 bg-amber-300/5 text-amber-200",
        planned: "border-cyan-300/20 bg-cyan-300/5 text-cyan-200",
    };

    const labels = {
        online: "ONLINE",
        standby: "TELEMETRY PENDING",
        planned: "INTEGRATION NEXT",
    };

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

export default async function ControlCenterPage() {
    const cookieStore = await cookies();
    const session = cookieStore.get("luma_portal_session");

    if (session?.value !== "authenticated") {
        redirect("/portal/login?next=/control-center");
    }

    return (
        <main className="min-h-screen bg-[#061113] text-white">
            <div className="border-b border-white/5 bg-[#081719]/90">
                <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-7 sm:flex-row sm:items-center">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300/60">
                            <ShieldCheck className="h-4 w-4" />
                            LuMa Labs · Secure Operations
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            Control Center
                        </h1>
                        <p className="mt-2 text-sm text-white/40">
                            Infrastructure · Systems · Services
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-2 text-xs text-cyan-100/80">
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Protected Session
                        </div>
                        <form action="/api/portal-logout" method="POST">
                            <button
                                type="submit"
                                className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:border-white/20 hover:text-white"
                            >
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
                        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/60">
                            System Overview
                        </p>
                        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                            <div>
                                <h2 className="text-2xl font-medium tracking-tight">
                                    LuMa Operations Network
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
                                    Die geschützte Steuerzentrale ist aktiv. Live-Telemetrie wird als nächster Schritt an den LuisServer und die übrigen Systeme angebunden.
                                </p>
                            </div>
                            <div className="flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] font-medium tracking-[0.14em] text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                CONTROL CENTER ONLINE
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/35">
                            Security
                        </p>
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

                <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
                    <section>
                        <div className="mb-4">
                            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Services</p>
                            <h2 className="mt-2 text-xl font-medium">LuMa Services</h2>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {services.map((service) => {
                                const Icon = service.icon;
                                return (
                                    <div key={service.name} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.035]">
                                            <Icon className="h-4 w-4 text-cyan-200/70" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">{service.name}</p>
                                            <p className="mt-1 text-xs text-white/30">{service.description}</p>
                                        </div>
                                        <Wifi className="ml-auto h-3.5 w-3.5 text-white/15" />
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
                                return (
                                    <div key={item.name} className={`flex items-center gap-3 px-4 py-3.5 ${index !== infrastructure.length - 1 ? "border-b border-white/5" : ""}`}>
                                        <Icon className="h-4 w-4 text-cyan-200/55" />
                                        <span className="text-sm text-white/65">{item.name}</span>
                                        <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-white/20">Awaiting telemetry</span>
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
