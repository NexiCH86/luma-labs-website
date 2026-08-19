"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Vec3 = { x: number; y: number; z: number };
type SatRec = unknown;
type SatelliteJs = {
    json2satrec: (record: Record<string, unknown>) => SatRec;
    propagate: (satrec: SatRec, date: Date) => { position: Vec3; velocity: Vec3 } | null;
    gstime: (date: Date) => number;
    eciToEcf: (position: Vec3, gmst: number) => Vec3;
    ecfToLookAngles: (
        observer: { longitude: number; latitude: number; height: number },
        positionEcf: Vec3
    ) => { azimuth: number; elevation: number; rangeSat: number };
    radiansLat: (degrees: number) => number;
    radiansLong: (degrees: number) => number;
};

type Selection = { name: string; norad: number; groupLabel: string };
type Observer = { latitude: number; longitude: number; altitudeKm: number };
type RecordData = Record<string, unknown>;
type Point = { x: number; y: number };

type Visibility = {
    label: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "BELOW HORIZON" | "LOCATION REQUIRED";
    score: number;
    reason: string;
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const MU = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;
const PANEL_KEY = "luma-radar-sat-v1-panel-position";
const LOCATION_KEY = "luma-radar-sat-manual-location";

const GROUP_BY_LABEL: Record<string, string> = {
    Stations: "STATIONS",
    "Space Stations": "STATIONS",
    GPS: "GPS-OPS",
    GLONASS: "GLO-OPS",
    Galileo: "GALILEO",
    BeiDou: "BEIDOU",
    Starlink: "STARLINK",
    Weather: "WEATHER",
    Earth: "RESOURCE",
    "Earth Resources": "RESOURCE",
};

function getSatelliteJs() {
    return (window as unknown as { satellite?: SatelliteJs }).satellite ?? null;
}

function waitForSatelliteJs(): Promise<SatelliteJs> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = window.setInterval(() => {
            const satellite = getSatelliteJs();
            if (satellite) {
                window.clearInterval(timer);
                resolve(satellite);
            } else if (Date.now() - started > 10000) {
                window.clearInterval(timer);
                reject(new Error("satellite.js unavailable"));
            }
        }, 120);
    });
}

function selectionFromDom(): Selection | null {
    const header = document.querySelector(".sat2-selected-header");
    if (!header) return null;
    const name = header.querySelector("h2")?.textContent?.trim() ?? "";
    const groupLabel = header.querySelector("span")?.textContent?.trim() ?? "";
    const meta = header.querySelector("p")?.textContent ?? "";
    const match = meta.match(/NORAD\s+(\d+)/i);
    if (!name || !match) return null;
    return { name, norad: Number(match[1]), groupLabel };
}

function readObserver(): Observer | null {
    try {
        const raw = localStorage.getItem(LOCATION_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as { latitude?: number; longitude?: number; altitudeM?: number };
        if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return null;
        return {
            latitude: Number(value.latitude),
            longitude: Number(value.longitude),
            altitudeKm: Math.max(0, Number(value.altitudeM ?? 0) / 1000),
        };
    } catch {
        return null;
    }
}

function numberValue(record: RecordData | null, key: string) {
    const value = record?.[key];
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(record: RecordData | null, key: string) {
    const value = record?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function orbitMetrics(record: RecordData | null) {
    const meanMotion = numberValue(record, "MEAN_MOTION");
    const eccentricity = numberValue(record, "ECCENTRICITY");
    if (meanMotion == null || eccentricity == null || meanMotion <= 0) return null;
    const n = meanMotion * 2 * Math.PI / 86400;
    const semiMajor = Math.cbrt(MU / (n * n));
    return {
        periodMin: 1440 / meanMotion,
        apogeeKm: semiMajor * (1 + eccentricity) - EARTH_RADIUS_KM,
        perigeeKm: semiMajor * (1 - eccentricity) - EARTH_RADIUS_KM,
    };
}

function norm360(value: number) {
    return ((value % 360) + 360) % 360;
}

function normLon(value: number) {
    return norm360(value + 180) - 180;
}

function julianDay(date: Date) {
    return date.getTime() / 86400000 + 2440587.5;
}

function sunState(date: Date) {
    const n = julianDay(date) - 2451545;
    const meanLon = norm360(280.46 + 0.9856474 * n);
    const anomaly = norm360(357.528 + 0.9856003 * n) * DEG;
    const lambda = norm360(meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * DEG;
    const obliquity = (23.439 - 0.0000004 * n) * DEG;
    const ra = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
    return { ra: ra, dec };
}

function isSunlit(position: Vec3, date: Date) {
    const sun = sunState(date);
    const unit = {
        x: Math.cos(sun.dec) * Math.cos(sun.ra),
        y: Math.cos(sun.dec) * Math.sin(sun.ra),
        z: Math.sin(sun.dec),
    };
    const along = position.x * unit.x + position.y * unit.y + position.z * unit.z;
    if (along >= 0) return true;
    const dx = position.x - along * unit.x;
    const dy = position.y - along * unit.y;
    const dz = position.z - along * unit.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) > EARTH_RADIUS_KM;
}

function lookAngles(satellite: SatelliteJs, satrec: SatRec, observer: Observer, date: Date) {
    const propagated = satellite.propagate(satrec, date);
    if (!propagated) return null;
    const ecf = satellite.eciToEcf(propagated.position, satellite.gstime(date));
    const look = satellite.ecfToLookAngles(
        {
            longitude: satellite.radiansLong(observer.longitude),
            latitude: satellite.radiansLat(observer.latitude),
            height: observer.altitudeKm,
        },
        ecf
    );
    return {
        elevation: look.elevation * RAD,
        azimuth: look.azimuth * RAD,
        rangeKm: look.rangeSat,
        sunlit: isSunlit(propagated.position, date),
    };
}

function visibilityRating(look: ReturnType<typeof lookAngles>, groupLabel: string): Visibility {
    if (!look) return { label: "LOCATION REQUIRED", score: 0, reason: "Set MY LOCATION for observer geometry." };
    if (look.elevation <= 0) return { label: "BELOW HORIZON", score: 0, reason: "The satellite is currently below your local horizon." };

    let score = Math.min(60, look.elevation * 1.25);
    if (look.sunlit) score += 22;
    if (look.rangeKm < 1000) score += 18;
    else if (look.rangeKm < 3000) score += 10;
    else if (look.rangeKm < 10000) score += 4;
    if (groupLabel.includes("Station")) score += 8;
    if (groupLabel === "Starlink") score += 3;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const label: Visibility["label"] = score >= 80 ? "EXCELLENT" : score >= 60 ? "GOOD" : score >= 35 ? "FAIR" : "POOR";
    const reason = `${look.sunlit ? "Sunlit" : "Earth shadow"} · ${look.elevation.toFixed(0)}° elevation · ${Math.round(look.rangeKm).toLocaleString("de-CH")} km range. Geometry estimate, not a calibrated magnitude.`;
    return { label, score, reason };
}

function launchYear(objectId: string | null) {
    if (!objectId) return null;
    const match = objectId.match(/^(\d{4})-/);
    return match ? Number(match[1]) : null;
}

function categoryDescription(group: string) {
    if (group.includes("Station")) return "Crewed / orbital station group";
    if (group === "GPS") return "US GPS navigation constellation";
    if (group === "GLONASS") return "GLONASS navigation constellation";
    if (group === "Galileo") return "European Galileo navigation constellation";
    if (group === "BeiDou") return "BeiDou navigation constellation";
    if (group === "Starlink") return "Starlink communications constellation";
    if (group === "Weather") return "Weather observation group";
    if (group.includes("Earth")) return "Earth resources / observation group";
    return "Artificial Earth satellite";
}

function orbitPath(satellite: SatelliteJs | null, satrec: SatRec | null, periodMin: number | null, now: Date) {
    if (!satellite || !satrec || !periodMin) return { path: "", current: null as Point | null };
    const samples: Point[] = [];
    const spanMs = periodMin * 60_000;
    let current: Point | null = null;
    for (let i = 0; i <= 96; i++) {
        const date = new Date(now.getTime() - spanMs / 2 + spanMs * (i / 96));
        const propagated = satellite.propagate(satrec, date);
        if (!propagated) continue;
        const p = propagated.position;
        const scale = 92 / Math.max(EARTH_RADIUS_KM * 1.12, Math.hypot(p.x, p.y, p.z));
        const angle = (now.getTime() / 50000) % (Math.PI * 2);
        const rx = p.x * Math.cos(angle) - p.y * Math.sin(angle);
        const ry = p.x * Math.sin(angle) + p.y * Math.cos(angle);
        const point = { x: 130 + rx * scale, y: 105 - (p.z * 0.72 + ry * 0.28) * scale };
        samples.push(point);
        if (i === 48) current = point;
    }
    const path = samples.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    return { path, current };
}

function enhancePhase3Dragging() {
    const panel = document.querySelector<HTMLElement>(".sat3-panel");
    const handle = panel?.querySelector<HTMLElement>(".sat3-head");
    if (!panel || !handle || panel.dataset.v1Movable === "true") return false;
    panel.dataset.v1Movable = "true";
    panel.classList.add("satv1-phase3-movable");
    handle.classList.add("satv1-phase3-handle");

    const key = "luma-radar-sat-phase3-position";
    try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null") as Point | null;
        if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
            panel.style.left = `${stored.x}px`;
            panel.style.top = `${stored.y}px`;
            panel.style.bottom = "auto";
        }
    } catch {
        localStorage.removeItem(key);
    }

    let dragging = false;
    let dx = 0;
    let dy = 0;
    const move = (event: PointerEvent) => {
        if (!dragging) return;
        const rect = panel.getBoundingClientRect();
        const x = Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - dx));
        const y = Math.max(72, Math.min(window.innerHeight - rect.height - 12, event.clientY - dy));
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
        panel.style.bottom = "auto";
    };
    const up = () => {
        if (!dragging) return;
        dragging = false;
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(key, JSON.stringify({ x: rect.left, y: rect.top }));
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointerdown", (event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        const rect = panel.getBoundingClientRect();
        dragging = true;
        dx = event.clientX - rect.left;
        dy = event.clientY - rect.top;
        event.preventDefault();
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    });
    handle.addEventListener("dblclick", () => {
        localStorage.removeItem(key);
        panel.style.removeProperty("left");
        panel.style.removeProperty("top");
        panel.style.removeProperty("bottom");
    });
    return true;
}

export default function SatV1CompletePanel() {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [record, setRecord] = useState<RecordData | null>(null);
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [observer, setObserver] = useState<Observer | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [position, setPosition] = useState<Point | null>(null);
    const [open, setOpen] = useState(true);
    const [status, setStatus] = useState("SELECT A SATELLITE");

    useEffect(() => {
        setObserver(readObserver());
        try {
            const stored = JSON.parse(localStorage.getItem(PANEL_KEY) ?? "null") as Point | null;
            if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) setPosition(stored);
        } catch {
            localStorage.removeItem(PANEL_KEY);
        }
        const timer = window.setInterval(() => {
            setNow(new Date());
            setObserver(readObserver());
        }, 3000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let stopped = false;
        const run = () => {
            if (stopped) return;
            if (!enhancePhase3Dragging()) requestAnimationFrame(run);
        };
        run();
        return () => { stopped = true; };
    }, []);

    useEffect(() => {
        const read = () => {
            const next = selectionFromDom();
            setSelection((current) => current?.norad === next?.norad && current?.groupLabel === next?.groupLabel ? current : next);
        };
        read();
        const observerMutation = new MutationObserver(read);
        observerMutation.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => observerMutation.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        setRecord(null);
        setSatrec(null);
        if (!selection) {
            setStatus("SELECT A SATELLITE");
            return;
        }
        const group = GROUP_BY_LABEL[selection.groupLabel] ?? "STATIONS";
        setStatus("LOADING DETAILS...");
        Promise.all([
            waitForSatelliteJs(),
            fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`, { cache: "no-store" }).then((r) => r.json()),
        ]).then(([satellite, payload]) => {
            if (cancelled) return;
            const data = payload as { satellites?: RecordData[] };
            const found = data.satellites?.find((item) => Number(item.NORAD_CAT_ID) === selection.norad) ?? null;
            if (!found) throw new Error("Satellite details unavailable");
            setRecord(found);
            setSatrec(satellite.json2satrec(found));
            setStatus("LIVE ORBIT INTELLIGENCE");
        }).catch((error) => {
            if (!cancelled) setStatus(error instanceof Error ? error.message.toUpperCase() : "DETAILS OFFLINE");
        });
        return () => { cancelled = true; };
    }, [selection]);

    const satellite = typeof window === "undefined" ? null : getSatelliteJs();
    const metrics = useMemo(() => orbitMetrics(record), [record]);
    const currentLook = satellite && satrec && observer ? lookAngles(satellite, satrec, observer, now) : null;
    const visibility = visibilityRating(currentLook, selection?.groupLabel ?? "");
    const orbit = useMemo(() => orbitPath(satellite, satrec, metrics?.periodMin ?? null, now), [satellite, satrec, metrics?.periodMin, now]);
    const objectId = stringValue(record, "OBJECT_ID");
    const year = launchYear(objectId);
    const epoch = stringValue(record, "EPOCH");
    const inclination = numberValue(record, "INCLINATION");
    const eccentricity = numberValue(record, "ECCENTRICITY");

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if ((event.target as HTMLElement).closest("button, a")) return;
        const rect = panelRef.current?.getBoundingClientRect();
        if (!rect) return;
        dragRef.current = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        const panel = panelRef.current;
        if (!drag || drag.id !== event.pointerId || !panel) return;
        const rect = panel.getBoundingClientRect();
        setPosition({
            x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - drag.dx)),
            y: Math.max(72, Math.min(window.innerHeight - rect.height - 12, event.clientY - drag.dy)),
        });
    }
    function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
        if (!dragRef.current || dragRef.current.id !== event.pointerId) return;
        dragRef.current = null;
        if (position) localStorage.setItem(PANEL_KEY, JSON.stringify(position));
    }

    if (!open) return <button className="satv1-reopen" onClick={() => setOpen(true)}>ORBIT / DETAILS</button>;
    const style = position ? ({ left: position.x, top: position.y, right: "auto" } as React.CSSProperties) : undefined;

    return (
        <section ref={panelRef} className="satv1-panel" style={style}>
            <div className="satv1-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={() => { setPosition(null); localStorage.removeItem(PANEL_KEY); }}>
                <div><small>SAT v1</small><strong>ORBIT / OBJECT INTELLIGENCE</strong></div>
                <span>{status}</span>
                <button onClick={() => setOpen(false)} aria-label="Close orbit intelligence">×</button>
            </div>

            {!selection ? <div className="satv1-empty">Select a satellite on the map or in SATELLITES TRACKED.</div> : <>
                <div className="satv1-object-title">
                    <div><small>{selection.groupLabel || "SATELLITE"}</small><h3>{selection.name}</h3><p>NORAD {selection.norad}{objectId ? ` · ${objectId}` : ""}</p></div>
                    <div className={`satv1-score satv1-${visibility.label.toLowerCase().replaceAll(" ", "-")}`}><b>{visibility.score}</b><span>{visibility.label}</span></div>
                </div>

                <div className="satv1-orbit-card">
                    <svg viewBox="0 0 260 210" role="img" aria-label="Three-dimensional orbital projection">
                        <defs>
                            <radialGradient id="satv1-earth" cx="35%" cy="30%"><stop offset="0%" stopColor="#1d7680"/><stop offset="65%" stopColor="#0b3345"/><stop offset="100%" stopColor="#04121c"/></radialGradient>
                            <clipPath id="satv1-earth-clip"><circle cx="130" cy="105" r="54"/></clipPath>
                        </defs>
                        <circle cx="130" cy="105" r="55" className="satv1-atmosphere" />
                        <circle cx="130" cy="105" r="54" fill="url(#satv1-earth)" />
                        <g clipPath="url(#satv1-earth-clip)" className="satv1-globe-grid">
                            <ellipse cx="130" cy="105" rx="52" ry="18"/><ellipse cx="130" cy="105" rx="52" ry="36"/><ellipse cx="130" cy="105" rx="18" ry="52"/><ellipse cx="130" cy="105" rx="36" ry="52"/><line x1="76" y1="105" x2="184" y2="105"/>
                        </g>
                        {orbit.path && <path d={orbit.path} className="satv1-orbit-line" />}
                        {orbit.current && <><circle cx={orbit.current.x} cy={orbit.current.y} r="8" className="satv1-sat-glow"/><circle cx={orbit.current.x} cy={orbit.current.y} r="3.5" className="satv1-sat-dot"/></>}
                    </svg>
                    <div className="satv1-orbit-caption"><strong>3D ORBIT PROJECTION</strong><span>{metrics ? `${metrics.periodMin.toFixed(1)} min orbital period` : "Waiting for orbit data"}</span></div>
                </div>

                <div className="satv1-metrics">
                    <div><small>APOGEE</small><b>{metrics ? `${Math.round(metrics.apogeeKm).toLocaleString("de-CH")} km` : "---"}</b></div>
                    <div><small>PERIGEE</small><b>{metrics ? `${Math.round(metrics.perigeeKm).toLocaleString("de-CH")} km` : "---"}</b></div>
                    <div><small>INCLINATION</small><b>{inclination == null ? "---" : `${inclination.toFixed(2)}°`}</b></div>
                    <div><small>ECCENTRICITY</small><b>{eccentricity == null ? "---" : eccentricity.toFixed(5)}</b></div>
                    <div><small>LAUNCH YEAR</small><b>{year ?? "---"}</b></div>
                    <div><small>EPOCH</small><b>{epoch ? new Date(epoch).toLocaleDateString("de-CH") : "---"}</b></div>
                </div>

                <div className="satv1-visibility">
                    <div className="satv1-vis-head"><strong>VISIBILITY ESTIMATE</strong><b>{visibility.label}</b></div>
                    <div className="satv1-meter"><i style={{ width: `${visibility.score}%` }} /></div>
                    <p>{visibility.reason}</p>
                    {currentLook && <div className="satv1-look"><span>Elevation <b>{currentLook.elevation.toFixed(1)}°</b></span><span>Azimuth <b>{norm360(currentLook.azimuth).toFixed(0)}°</b></span><span>Range <b>{Math.round(currentLook.rangeKm).toLocaleString("de-CH")} km</b></span><span>Light <b>{currentLook.sunlit ? "SUNLIT" : "SHADOW"}</b></span></div>}
                </div>

                <div className="satv1-details">
                    <strong>OBJECT DETAILS</strong>
                    <p>{categoryDescription(selection.groupLabel)}</p>
                    <div className="satv1-links">
                        <a href={`https://celestrak.org/NORAD/elements/gp.php?CATNR=${selection.norad}&FORMAT=JSON-PRETTY`} target="_blank" rel="noreferrer">CELESTRAK DATA ↗</a>
                        <a href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(selection.name)}`} target="_blank" rel="noreferrer">WIKIPEDIA SEARCH ↗</a>
                    </div>
                </div>
            </>}
        </section>
    );
}
