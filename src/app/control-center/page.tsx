import { redirect } from "next/navigation";
import { LumaSignet } from "@/components/brand/LumaSignet";
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
  Zap,
} from "lucide-react";
import { DEVICES, readControlTelemetry, type DeviceInfo, type DeviceReading, type ServiceState } from "@/lib/control-center";
import { hasRadarStore, readSnapshot } from "@/lib/radar-store";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type Status = "online" | "offline" | "never";

const DEVICE_ICONS: Record<string, typeof Laptop> = {
  "master-intel": Cpu,
  "master-mac": Laptop,
  "kali-mac": TerminalSquare,
  "server-pi": Server,
  luisserver: Server,
};

const infrastructure = [
  { name: "Docker", key: "docker", icon: Database },
  { name: "Portainer", key: "portainer", icon: AppWindow },
  { name: "Uptime Kuma", key: "uptimeKuma", icon: Gauge },
  { name: "Nginx Proxy Manager", key: "nginxProxyManager", icon: Network },
  { name: "File Browser", key: "fileBrowser", icon: HardDrive },
];

/* Wie /api/radar/health: Collector gilt als online, wenn der Snapshot juenger als 3 Minuten ist. */
const RADAR_MAX_AGE_MS = 3 * 60 * 1000;

async function readRadarState(): Promise<ServiceState> {
  if (!hasRadarStore()) return "unknown";
  try {
    const snapshot = await readSnapshot();
    return snapshot && Date.now() - snapshot.receivedAt < RADAR_MAX_AGE_MS && snapshot.count > 0 ? "online" : "offline";
  } catch (error) {
    console.error("Control Center radar check failed:", error);
    return "unknown";
  }
}

function deviceStatus(reading: DeviceReading): Status {
  if (reading.online) return "online";
  return reading.lastSeen ? "offline" : "never";
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAgo(timestamp: number, now: number) {
  const minutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tagen`;
}

function formatClock(timestamp: number) {
  return new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    online: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    offline: "border-red-400/20 bg-red-400/5 text-red-300",
    never: "border-amber-300/20 bg-amber-300/5 text-amber-200",
  };
  const labels: Record<Status, string> = {
    online: "ONLINE",
    offline: "OFFLINE",
    never: "KEIN AGENT",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] ${styles[status]}`}>{labels[status]}</span>;
}

function ServiceStateLabel({ state }: { state: ServiceState }) {
  const styles = { online: "text-emerald-300", offline: "text-red-300", unknown: "text-white/25" };
  return <span className={`text-[10px] font-medium tracking-[0.14em] ${styles[state]}`}>{state.toUpperCase()}</span>;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: typeof Cpu }) {
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

function TelemetrySection({ device, reading, now }: { device: DeviceInfo; reading: DeviceReading; now: number }) {
  const telemetry = reading.telemetry;
  const gpu = telemetry?.gpu;
  const status = deviceStatus(reading);
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Live Telemetry</p>
          <h2 className="mt-2 text-xl font-medium">{device.name}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span className={`h-2 w-2 rounded-full ${status === "online" ? "bg-emerald-300" : "bg-red-300"}`} />
          {status === "online" ? "Live" : reading.lastSeen ? `Letzter Messwert ${formatAgo(reading.lastSeen, now)}` : "Kein Heartbeat"}
        </div>
      </div>

      {telemetry ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="CPU" value={`${telemetry.cpuPercent.toFixed(1)}%`} icon={Cpu} />
            <MetricCard label="Memory" value={`${telemetry.memoryPercent.toFixed(1)}%`} detail={telemetry.memoryUsedGb != null && telemetry.memoryTotalGb != null ? `${telemetry.memoryUsedGb.toFixed(1)} / ${telemetry.memoryTotalGb.toFixed(1)} GB` : undefined} icon={MemoryStick} />
            <MetricCard label="Temperature" value={telemetry.temperatureC != null ? `${telemetry.temperatureC.toFixed(1)} °C` : "—"} icon={Thermometer} />
            <MetricCard label="Disk" value={`${telemetry.diskPercent.toFixed(1)}%`} detail={telemetry.diskUsedGb != null && telemetry.diskTotalGb != null ? `${telemetry.diskUsedGb.toFixed(1)} / ${telemetry.diskTotalGb.toFixed(1)} GB` : undefined} icon={HardDrive} />
            <MetricCard label="Uptime" value={formatUptime(telemetry.uptimeSeconds)} icon={TimerReset} />
          </div>

          {device.gpu && gpu && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="GPU Load" value={gpu.utilizationPercent != null ? `${gpu.utilizationPercent.toFixed(1)}%` : "—"} detail={gpu.name ?? undefined} icon={Gauge} />
              <MetricCard label="GPU Temp" value={gpu.temperatureC != null ? `${gpu.temperatureC.toFixed(1)} °C` : "—"} icon={Thermometer} />
              <MetricCard label="VRAM" value={gpu.memoryUsedMb != null && gpu.memoryTotalMb != null ? `${(gpu.memoryUsedMb / 1024).toFixed(1)} GB` : "—"} detail={gpu.memoryTotalMb != null ? `${(gpu.memoryTotalMb / 1024).toFixed(1)} GB total` : undefined} icon={MemoryStick} />
              <MetricCard label="GPU Power" value={gpu.powerDrawW != null ? `${gpu.powerDrawW.toFixed(0)} W` : "—"} detail={gpu.powerLimitW != null ? `${gpu.powerLimitW.toFixed(0)} W limit` : undefined} icon={Zap} />
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-8 text-sm text-white/35">
          {reading.lastSeen
            ? `Offline. Letzter Messwert ${formatAgo(reading.lastSeen, now)}.`
            : "Noch keine Telemetrie empfangen. Agent auf dem Gerät einrichten (scripts/control-center-agent*)."}
        </div>
      )}
    </section>
  );
}

export default async function ControlCenterPage() {
  const session = await readSession("control-center");
  if (!session) redirect("/control-center/login");

  const [readings, radarState] = await Promise.all([readControlTelemetry(), readRadarState()]);
  const now = readings.readAt;

  const onlineCount = DEVICES.filter((device) => readings.devices[device.id].online).length;
  const overall =
    !readings.storeOk
      ? { label: "TELEMETRIE-SPEICHER NICHT ERREICHBAR", style: "border-red-400/20 bg-red-400/5 text-red-300", dot: "bg-red-300" }
      : onlineCount === DEVICES.length
        ? { label: "ALLE SYSTEME ONLINE", style: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300", dot: "bg-emerald-300" }
        : onlineCount > 0
          ? { label: `${DEVICES.length - onlineCount} SYSTEM${DEVICES.length - onlineCount === 1 ? "" : "E"} OFFLINE`, style: "border-amber-300/20 bg-amber-300/5 text-amber-200", dot: "bg-amber-200" }
          : { label: "KEINE LIVE-TELEMETRIE", style: "border-red-400/20 bg-red-400/5 text-red-300", dot: "bg-red-300" };

  /* Server-Stack vom ersten Infrastruktur-Geraet, das gerade liefert (Keller-Pi vor Buero-Pi). */
  const stackDevice = DEVICES.find((device) => device.infrastructure && readings.devices[device.id].online);
  const stackServices = stackDevice ? readings.devices[stackDevice.id].telemetry?.services : undefined;

  const controlApiState: ServiceState = !readings.storeOk ? "offline" : onlineCount > 0 ? "online" : "unknown";
  const services: { name: string; description: string; icon: typeof Radio; state: ServiceState }[] = [
    { name: "LuMa RADAR", description: "AIR tracking platform", icon: Radio, state: radarState },
    { name: "RADAR Collector", description: "OpenSky ingest · Server-Pi", icon: Activity, state: radarState },
    { name: "lumalabs.ch", description: "Next.js · Vercel", icon: Globe2, state: "online" },
    { name: "Control API", description: "Device telemetry layer", icon: Network, state: controlApiState },
  ];

  return (
    <main className="min-h-screen bg-[#061113] text-white">
      <div className="border-b border-white/5 bg-[#081719]/90">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-7 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <LumaSignet className="h-12 w-12 shrink-0" gradientId="lumaSignetCc" />
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-300/60">
                <ShieldCheck className="h-4 w-4" /> LuMa Labs · Secure Operations
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Control Center</h1>
              <p className="mt-2 text-sm text-white/40">Infrastructure · Systems · Services</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/radar" className="rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:border-white/20 hover:text-white">RADAR</a>
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] px-4 py-2 text-xs text-cyan-100/80"><LockKeyhole className="h-3.5 w-3.5" />Private Session</div>
            <form action="/api/control-center-logout" method="POST"><button type="submit" className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-white/50 transition hover:border-white/20 hover:text-white"><LogOut className="h-3.5 w-3.5" />Logout</button></form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5 md:col-span-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/60">System Overview</p>
            <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><h2 className="text-2xl font-medium tracking-tight">LuMa Operations Network</h2><p className="mt-2 text-sm text-white/40">{onlineCount} von {DEVICES.length} registrierten Systemen liefern aktuell Live-Telemetrie.</p></div>
              <div className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-medium tracking-[0.14em] ${overall.style}`}><span className={`h-1.5 w-1.5 rounded-full ${overall.dot}`} />{overall.label}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/35">Security</p>
            <div className="mt-5 flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/5"><ShieldCheck className="h-5 w-5 text-emerald-300" /></div><div><p className="font-medium">Signierte Sitzung</p><p className="mt-1 text-xs text-white/35">Gültig bis {formatClock(session.expiresAt)} Uhr</p></div></div>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Devices</p><h2 className="mt-2 text-xl font-medium">LuMa Systems</h2></div><p className="text-xs text-white/25">{DEVICES.length} registered devices</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {DEVICES.map((device) => {
              const Icon = DEVICE_ICONS[device.id] ?? Server;
              const reading = readings.devices[device.id];
              const telemetry = reading.telemetry;
              const detail = telemetry ? `${telemetry.hostname}${telemetry.ip ? ` · ${telemetry.ip}` : ""}` : device.hardware;
              return (
                <article key={device.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                  <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04]"><Icon className="h-4.5 w-4.5 text-cyan-200" /></div><StatusPill status={deviceStatus(reading)} /></div>
                  <h3 className="mt-5 font-medium">{device.name}</h3><p className="mt-1 text-xs text-cyan-200/45">{device.role}</p>
                  <div className="mt-5 border-t border-white/5 pt-4">
                    <p className="text-xs text-white/55">{device.os}</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-white/25">{detail}</p>
                    {!reading.online && reading.lastSeen && <p className="mt-1 text-[11px] leading-5 text-red-300/60">Zuletzt gesehen {formatAgo(reading.lastSeen, now)}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {DEVICES.map((device) => <TelemetrySection key={device.id} device={device} reading={readings.devices[device.id]} now={now} />)}

        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <section>
            <div className="mb-4"><p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Services</p><h2 className="mt-2 text-xl font-medium">LuMa Services</h2></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service) => {
                const Icon = service.icon;
                return <div key={service.name} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.035]"><Icon className="h-4 w-4 text-cyan-200/70" /></div><div><p className="text-sm font-medium">{service.name}</p><p className="mt-1 text-xs text-white/30">{service.description}</p></div><div className="ml-auto"><ServiceStateLabel state={service.state} /></div></div>;
              })}
            </div>
          </section>

          <section>
            <div className="mb-4"><p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-300/50">Infrastructure</p><h2 className="mt-2 text-xl font-medium">Server Stack</h2><p className="mt-1 text-xs text-white/30">{stackDevice ? `Gemeldet von ${stackDevice.name}` : "Kein Server-Pi liefert gerade Daten"}</p></div>
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
              {infrastructure.map((item, index) => { const Icon = item.icon; const state = stackServices?.[item.key] ?? "unknown"; return <div key={item.name} className={`flex items-center gap-3 px-4 py-3.5 ${index !== infrastructure.length - 1 ? "border-b border-white/5" : ""}`}><Icon className="h-4 w-4 text-cyan-200/55" /><span className="text-sm text-white/65">{item.name}</span><div className="ml-auto"><ServiceStateLabel state={state} /></div></div>; })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
