"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Vec3 = { x: number; y: number; z: number };
type SatRec = unknown;
type SatelliteJs = {
    json2satrec: (record: Record<string, unknown>) => SatRec;
    propagate: (satrec: SatRec, date: Date) => { position: Vec3; velocity: Vec3 } | null;
    gstime: (date: Date) => number;
    eciToEcf: (position: Vec3, gmst: number) => Vec3;
    ecfToLookAngles: (observer: { longitude: number; latitude: number; height: number }, positionEcf: Vec3) => { azimuth: number; elevation: number; rangeSat: number };
    radiansLat: (degrees: number) => number;
    radiansLong: (degrees: number) => number;
};

type WatchItem = { norad: number; name: string; groupKey: string; groupLabel: string };
type Observer = { latitude: number; longitude: number; altitudeKm: number; label?: string };
type Pass = { rise: Date; peak: Date; set: Date; peakElevation: number; rangeKm: number };
type PassRow = WatchItem & { pass: Pass | null; error?: string };
type Point = { x: number; y: number };

const WATCH_KEY = "luma-radar-sat-watchlist";
const LOCATION_KEY = "luma-radar-sat-manual-location";
const PANEL_KEY = "luma-radar-sat-final-center-position";
const ALERT_KEY = "luma-radar-sat-browser-alerts";
const RAD = 180 / Math.PI;

function satelliteJs() {
    return (window as unknown as { satellite?: SatelliteJs }).satellite ?? null;
}

function readWatchlist(): WatchItem[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]") as WatchItem[];
        return Array.isArray(parsed) ? parsed.filter((item) => Number.isFinite(item.norad) && item.groupKey) : [];
    } catch { return []; }
}

function readObserver(): Observer | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(LOCATION_KEY) ?? "null") as { latitude?: number; longitude?: number; altitudeM?: number; label?: string } | null;
        if (!parsed || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
        return { latitude: Number(parsed.latitude), longitude: Number(parsed.longitude), altitudeKm: Math.max(0, Number(parsed.altitudeM ?? 0) / 1000), label: parsed.label };
    } catch { return null; }
}

function look(lib: SatelliteJs, satrec: SatRec, observer: Observer, date: Date) {
    const propagated = lib.propagate(satrec, date);
    if (!propagated) return null;
    const ecf = lib.eciToEcf(propagated.position, lib.gstime(date));
    const angles = lib.ecfToLookAngles({ longitude: lib.radiansLong(observer.longitude), latitude: lib.radiansLat(observer.latitude), height: observer.altitudeKm }, ecf);
    return { elevation: angles.elevation * RAD, rangeKm: angles.rangeSat };
}

function nextPass(lib: SatelliteJs, satrec: SatRec, observer: Observer): Pass | null {
    const start = Date.now();
    const end = start + 48 * 60 * 60_000;
    const step = 120_000;
    let previous = look(lib, satrec, observer, new Date(start));
    let rise: Date | null = previous && previous.elevation >= 0 ? new Date(start) : null;
    let peak: Date | null = rise;
    let peakElevation = previous?.elevation ?? -90;
    let peakRange = previous?.rangeKm ?? 0;

    for (let time = start + step; time <= end; time += step) {
        const date = new Date(time);
        const current = look(lib, satrec, observer, date);
        if (!current) continue;
        const prevElevation = previous?.elevation ?? -90;
        if (!rise && prevElevation < 0 && current.elevation >= 0) {
            rise = date; peak = date; peakElevation = current.elevation; peakRange = current.rangeKm;
        }
        if (rise && current.elevation > peakElevation) {
            peak = date; peakElevation = current.elevation; peakRange = current.rangeKm;
        }
        if (rise && prevElevation >= 0 && current.elevation < 0) {
            return { rise, peak: peak ?? rise, set: date, peakElevation, rangeKm: peakRange };
        }
        previous = current;
    }
    return null;
}

function formatTime(date: Date) {
    return date.toLocaleString("de-CH", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(date: Date) {
    return Math.round((date.getTime() - Date.now()) / 60_000);
}

function selectInRadar(item: WatchItem) {
    const labelMap: Record<string, string> = { STATIONS: "Stations", "GPS-OPS": "GPS", "GLO-OPS": "GLONASS", GALILEO: "Galileo", BEIDOU: "BeiDou", STARLINK: "Starlink", WEATHER: "Weather", RESOURCE: "Earth", NOAA: "NOAA", SCIENCE: "Science", AMATEUR: "Amateur", GEO: "GEO" };
    const label = labelMap[item.groupKey] ?? item.groupLabel;
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".sat2-filter")).find((node) => node.querySelector("b")?.textContent?.trim() === label);
    const wait = button && !button.classList.contains("is-on") ? 1200 : 40;
    if (button && !button.classList.contains("is-on")) button.click();
    window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(".radar-search input");
        const search = document.querySelector<HTMLButtonElement>(".radar-search button");
        if (!input || !search) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, String(item.norad));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        search.click();
    }, wait);
}

export default function SatFinalCenter() {
    const ref = useRef<HTMLElement | null>(null);
    const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
    const notified = useRef(new Set<number>());
    const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
    const [observer, setObserver] = useState<Observer | null>(null);
    const [rows, setRows] = useState<PassRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(true);
    const [position, setPosition] = useState<Point | null>(null);
    const [alerts, setAlerts] = useState(false);
    const [health, setHealth] = useState({ celestrak: "CHECKING", map: "CHECKING", orbit: "CHECKING", location: "MISSING" });

    useEffect(() => {
        const sync = () => { setWatchlist(readWatchlist()); setObserver(readObserver()); };
        sync();
        setAlerts(localStorage.getItem(ALERT_KEY) === "1");
        try { const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? "null") as Point | null; if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) setPosition(saved); } catch { /* ignore */ }
        window.addEventListener("luma-sat-watchlist-change", sync);
        const timer = window.setInterval(sync, 5000);
        return () => { window.removeEventListener("luma-sat-watchlist-change", sync); window.clearInterval(timer); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function check() {
            let celestrak = "ONLINE";
            try { const response = await fetch("/api/radar/satellites?groups=STATIONS", { cache: "no-store" }); if (!response.ok) celestrak = "DEGRADED"; } catch { celestrak = "OFFLINE"; }
            if (cancelled) return;
            setHealth({ celestrak, map: document.querySelector(".leaflet-container") ? "ONLINE" : "WAITING", orbit: satelliteJs() ? "ONLINE" : "WAITING", location: readObserver() ? "ACTIVE" : "MISSING" });
        }
        check();
        const timer = window.setInterval(check, 30000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (!observer || !watchlist.length) { setRows([]); return; }
        const lib = satelliteJs();
        if (!lib) return;
        setLoading(true);
        async function run() {
            const result: PassRow[] = [];
            for (const item of watchlist.slice(0, 24)) {
                try {
                    const response = await fetch(`/api/radar/satellites?groups=${encodeURIComponent(item.groupKey)}`, { cache: "no-store" });
                    const data = await response.json() as { satellites?: Array<Record<string, unknown>> };
                    const record = data.satellites?.find((sat) => Number(sat.NORAD_CAT_ID) === item.norad);
                    if (!record) { result.push({ ...item, pass: null, error: "DATA UNAVAILABLE" }); continue; }
                    result.push({ ...item, pass: nextPass(lib, lib.json2satrec(record), observer) });
                } catch { result.push({ ...item, pass: null, error: "OFFLINE" }); }
            }
            if (!cancelled) {
                result.sort((a, b) => (a.pass?.rise.getTime() ?? Infinity) - (b.pass?.rise.getTime() ?? Infinity));
                setRows(result); setLoading(false);
            }
        }
        run();
        const timer = window.setInterval(run, 10 * 60_000);
        return () => { cancelled = true; window.clearInterval(timer); };
    }, [observer, watchlist]);

    useEffect(() => {
        if (!alerts || typeof Notification === "undefined" || Notification.permission !== "granted") return;
        for (const row of rows) {
            if (!row.pass || row.pass.peakElevation < 10 || notified.current.has(row.norad)) continue;
            const minutes = minutesUntil(row.pass.rise);
            if (minutes >= 0 && minutes <= 15) {
                new Notification(`LuMa RADAR · ${row.name}`, { body: `Überflug in ca. ${minutes} Min. · Peak ${row.pass.peakElevation.toFixed(0)}°` });
                notified.current.add(row.norad);
            }
        }
    }, [alerts, rows]);

    useEffect(() => {
        let z = 5400;
        const selector = ".sat2-panel,.sat4-tracked-panel,.sat3-panel,.satv1-panel,.sat-final-center";
        const bringFront = (event: PointerEvent) => {
            const panel = (event.target as HTMLElement).closest<HTMLElement>(selector);
            if (panel) panel.style.zIndex = String(++z);
        };
        document.addEventListener("pointerdown", bringFront, true);
        return () => document.removeEventListener("pointerdown", bringFront, true);
    }, []);

    async function toggleAlerts() {
        if (!alerts) {
            if (typeof Notification === "undefined") return;
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return;
            localStorage.setItem(ALERT_KEY, "1"); setAlerts(true);
        } else { localStorage.removeItem(ALERT_KEY); setAlerts(false); }
    }

    const visibleSoon = useMemo(() => rows.filter((row) => row.pass && row.pass.peakElevation >= 10 && minutesUntil(row.pass.rise) <= 120 && minutesUntil(row.pass.rise) >= 0).length, [rows]);

    function down(event: React.PointerEvent) {
        if ((event.target as HTMLElement).closest("button")) return;
        const rect = ref.current?.getBoundingClientRect(); if (!rect) return;
        drag.current = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function move(event: React.PointerEvent) {
        const state = drag.current; const panel = ref.current; if (!state || state.id !== event.pointerId || !panel) return;
        const rect = panel.getBoundingClientRect();
        setPosition({ x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, event.clientX - state.dx)), y: Math.max(70, Math.min(window.innerHeight - rect.height - 8, event.clientY - state.dy)) });
    }
    function up(event: React.PointerEvent) { if (!drag.current || drag.current.id !== event.pointerId) return; drag.current = null; if (position) localStorage.setItem(PANEL_KEY, JSON.stringify(position)); }

    if (!open) return <button className="sat-final-reopen" onClick={() => setOpen(true)}>PASS CENTER · {visibleSoon}</button>;
    const style = position ? ({ left: position.x, top: position.y, right: "auto" } as React.CSSProperties) : undefined;

    return <section ref={ref} className="sat-final-center" style={style}>
        <div className="sat-final-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => { setPosition(null); localStorage.removeItem(PANEL_KEY); }}>
            <div><small>SAT v1 FINAL</small><strong>PASS / ALERT CENTER</strong></div><span>{loading ? "CALCULATING" : "READY"}</span><button onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="sat-final-health">
            <div><small>CELESTRAK</small><b>{health.celestrak}</b></div><div><small>MAP</small><b>{health.map}</b></div><div><small>ORBIT</small><b>{health.orbit}</b></div><div><small>LOCATION</small><b>{health.location}</b></div>
        </div>
        <div className="sat-final-summary">
            <div><small>WATCHED</small><b>{watchlist.length}</b></div><div><small>NEXT 2H ≥10°</small><b>{visibleSoon}</b></div>
            <button className={alerts ? "is-on" : ""} onClick={toggleAlerts}>{alerts ? "ALERTS ON" : "ENABLE ALERTS"}</button>
        </div>
        {!observer && <p className="sat-final-message">Set MY LOCATION first. The stored place is used for all watchlist pass calculations.</p>}
        {observer && !watchlist.length && <p className="sat-final-message">Add satellites to ★ WATCHLIST to build your personal pass schedule.</p>}
        <div className="sat-final-passes">
            {rows.slice(0, 12).map((row) => <button key={row.norad} onClick={() => selectInRadar(row)}>
                <span><strong>{row.name}</strong><small>{row.groupLabel} · NORAD {row.norad}</small></span>
                {row.pass ? <><em>{formatTime(row.pass.rise)}</em><b>{row.pass.peakElevation.toFixed(0)}°</b><small>{Math.max(0, minutesUntil(row.pass.rise))} min</small></> : <em>{row.error ?? "NO 48H PASS"}</em>}
            </button>)}
        </div>
        <footer>Browser alerts fire while LuMa RADAR is open · pass geometry refreshed every 10 min · max 24 watched objects calculated.</footer>
    </section>;
}
