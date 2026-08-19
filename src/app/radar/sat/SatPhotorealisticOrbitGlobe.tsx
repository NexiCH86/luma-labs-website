"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Vec3 = { x: number; y: number; z: number };
type SatRec = unknown;
type SatelliteJs = {
    json2satrec: (record: Record<string, unknown>) => SatRec;
    propagate: (satrec: SatRec, date: Date) => { position: Vec3; velocity: Vec3 } | null;
};
type Selection = { name: string; norad: number; groupLabel: string };
type Projected = { x: number; y: number; z: number; hidden: boolean };

const EARTH_RADIUS_KM = 6378.137;
const EARTH_IMAGE = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Blue%20Marble%202021.png";
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

function getSatelliteJs() {
    return (window as unknown as { satellite?: SatelliteJs }).satellite ?? null;
}

function waitForSatelliteJs(): Promise<SatelliteJs> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = window.setInterval(() => {
            const sat = getSatelliteJs();
            if (sat) {
                window.clearInterval(timer);
                resolve(sat);
            } else if (Date.now() - started > 10000) {
                window.clearInterval(timer);
                reject(new Error("satellite.js unavailable"));
            }
        }, 120);
    });
}

function numberValue(record: Record<string, unknown> | null, key: string) {
    const value = record?.[key];
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function periodMinutes(record: Record<string, unknown> | null) {
    const meanMotion = numberValue(record, "MEAN_MOTION");
    return meanMotion && meanMotion > 0 ? 1440 / meanMotion : null;
}

function project(vec: Vec3, now: Date, maxRadius: number): Projected {
    const yaw = (now.getTime() / 90000) % (Math.PI * 2);
    const pitch = -18 * Math.PI / 180;
    const x1 = vec.x * Math.cos(yaw) - vec.y * Math.sin(yaw);
    const y1 = vec.x * Math.sin(yaw) + vec.y * Math.cos(yaw);
    const z1 = vec.z;
    const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);
    const scale = 122 / maxRadius;
    const x = 180 + x1 * scale;
    const y = 133 - y2 * scale;
    const earthRadiusPx = EARTH_RADIUS_KM * scale;
    const hidden = z2 < 0 && Math.hypot(x - 180, y - 133) < earthRadiusPx;
    return { x, y, z: z2, hidden };
}

function buildSegment(points: Projected[], front: boolean) {
    let d = "";
    let drawing = false;
    for (const point of points) {
        const belongs = front ? point.z >= 0 : point.z < 0;
        const visible = belongs && !point.hidden;
        if (!visible) {
            drawing = false;
            continue;
        }
        d += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
        drawing = true;
    }
    return d.trim();
}

function orbitGeometry(satellite: SatelliteJs | null, satrec: SatRec | null, period: number | null, now: Date) {
    if (!satellite || !satrec || !period) return { rear: "", front: "", current: null as Projected | null, altitudeKm: null as number | null };

    const raw: Vec3[] = [];
    const span = period * 60_000;
    for (let i = 0; i <= 180; i++) {
        const date = new Date(now.getTime() - span / 2 + span * (i / 180));
        const propagated = satellite.propagate(satrec, date);
        if (propagated) raw.push(propagated.position);
    }
    if (!raw.length) return { rear: "", front: "", current: null, altitudeKm: null };

    const maxRadius = Math.max(EARTH_RADIUS_KM * 1.18, ...raw.map((p) => Math.hypot(p.x, p.y, p.z)));
    const points = raw.map((p) => project(p, now, maxRadius));
    const mid = Math.floor(points.length / 2);
    const currentVec = raw[mid];
    return {
        rear: buildSegment(points, false),
        front: buildSegment(points, true),
        current: points[mid] ?? null,
        altitudeKm: currentVec ? Math.max(0, Math.hypot(currentVec.x, currentVec.y, currentVec.z) - EARTH_RADIUS_KM) : null,
    };
}

export default function SatPhotorealisticOrbitGlobe() {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [satellite, setSatellite] = useState<SatelliteJs | null>(null);
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [record, setRecord] = useState<Record<string, unknown> | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        let stopped = false;
        const find = () => {
            if (stopped) return;
            const card = document.querySelector<HTMLElement>(".satv1-orbit-card");
            if (!card) return requestAnimationFrame(find);
            card.classList.add("sat-photo-mounted");
            setTarget(card);
        };
        find();
        return () => {
            stopped = true;
            document.querySelector<HTMLElement>(".satv1-orbit-card")?.classList.remove("sat-photo-mounted");
        };
    }, []);

    useEffect(() => {
        const read = () => {
            const next = selectionFromDom();
            setSelection((current) => current?.norad === next?.norad && current?.groupLabel === next?.groupLabel ? current : next);
        };
        read();
        const mutation = new MutationObserver(read);
        mutation.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => mutation.disconnect();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1800);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setSatrec(null);
        setRecord(null);
        if (!selection) return;
        const group = GROUP_BY_LABEL[selection.groupLabel] ?? "STATIONS";
        Promise.all([
            waitForSatelliteJs(),
            fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`, { cache: "no-store" }).then((r) => r.json()),
        ]).then(([library, payload]) => {
            if (cancelled) return;
            const data = payload as { satellites?: Array<Record<string, unknown>> };
            const found = data.satellites?.find((item) => Number(item.NORAD_CAT_ID) === selection.norad) ?? null;
            if (!found) return;
            setSatellite(library);
            setRecord(found);
            setSatrec(library.json2satrec(found));
        }).catch(() => {
            if (!cancelled) {
                setSatellite(null);
                setSatrec(null);
                setRecord(null);
            }
        });
        return () => { cancelled = true; };
    }, [selection]);

    const period = useMemo(() => periodMinutes(record), [record]);
    const orbit = useMemo(() => orbitGeometry(satellite, satrec, period, now), [satellite, satrec, period, now]);
    if (!target) return null;

    return createPortal(
        <div className="sat-photo-orbit">
            <svg viewBox="0 0 360 275" role="img" aria-label="Earth with live satellite orbit">
                <defs>
                    <clipPath id="sat-photo-earth-clip"><circle cx="180" cy="133" r="70" /></clipPath>
                    <radialGradient id="sat-photo-fallback" cx="34%" cy="28%" r="72%">
                        <stop offset="0%" stopColor="#247f9d" />
                        <stop offset="58%" stopColor="#0a3d62" />
                        <stop offset="100%" stopColor="#020914" />
                    </radialGradient>
                    <linearGradient id="sat-photo-night" x1="0%" y1="0%" x2="100%" y2="20%">
                        <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
                        <stop offset="55%" stopColor="rgba(0,0,0,0.12)" />
                        <stop offset="78%" stopColor="rgba(0,0,0,0.58)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.92)" />
                    </linearGradient>
                    <radialGradient id="sat-photo-atmo" cx="38%" cy="36%" r="68%">
                        <stop offset="76%" stopColor="rgba(70,180,255,0)" />
                        <stop offset="91%" stopColor="rgba(70,180,255,0.12)" />
                        <stop offset="100%" stopColor="rgba(115,220,255,0.55)" />
                    </radialGradient>
                    <filter id="sat-photo-glow" x="-120%" y="-120%" width="340%" height="340%">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>

                <g className="sat-photo-stars" aria-hidden="true">
                    <circle cx="28" cy="30" r="0.7"/><circle cx="55" cy="86" r="0.5"/><circle cx="98" cy="27" r="0.45"/><circle cx="294" cy="31" r="0.65"/><circle cx="331" cy="82" r="0.5"/><circle cx="318" cy="214" r="0.65"/><circle cx="45" cy="221" r="0.55"/><circle cx="338" cy="153" r="0.45"/>
                </g>

                {orbit.rear && <path d={orbit.rear} className="sat-photo-orbit-rear" />}

                <circle cx="180" cy="133" r="76" className="sat-photo-atmo-ring" />
                <circle cx="180" cy="133" r="73" fill="url(#sat-photo-atmo)" />
                <circle cx="180" cy="133" r="70" fill="url(#sat-photo-fallback)" />

                {!imageFailed && (
                    <image
                        href={EARTH_IMAGE}
                        x="110"
                        y="63"
                        width="140"
                        height="140"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#sat-photo-earth-clip)"
                        onError={() => setImageFailed(true)}
                    />
                )}

                <g clipPath="url(#sat-photo-earth-clip)">
                    <circle cx="180" cy="133" r="70" fill="url(#sat-photo-night)" />
                    <ellipse cx="158" cy="104" rx="23" ry="15" fill="rgba(255,255,255,0.10)" />
                    <ellipse cx="170" cy="117" rx="53" ry="67" className="sat-photo-limb-shade" />
                </g>

                <circle cx="180" cy="133" r="70" className="sat-photo-earth-edge" />
                <ellipse cx="180" cy="133" rx="70" ry="19" className="sat-photo-grid" />
                <ellipse cx="180" cy="133" rx="70" ry="40" className="sat-photo-grid" />
                <ellipse cx="180" cy="133" rx="27" ry="70" className="sat-photo-grid" />
                <ellipse cx="180" cy="133" rx="50" ry="70" className="sat-photo-grid" />

                {orbit.front && <path d={orbit.front} className="sat-photo-orbit-front" />}
                {orbit.current && !orbit.current.hidden && (
                    <g>
                        <circle cx={orbit.current.x} cy={orbit.current.y} r="8" className="sat-photo-sat-glow" />
                        <circle cx={orbit.current.x} cy={orbit.current.y} r="3.1" className="sat-photo-sat-dot" />
                        <text x={orbit.current.x + 8} y={orbit.current.y - 7} className="sat-photo-sat-label">{selection?.name ?? "SAT"}</text>
                    </g>
                )}
            </svg>
            <div className="sat-photo-caption">
                <div><strong>LIVE EARTH ORBIT</strong><span>NASA Blue Marble · live orbital geometry</span></div>
                <div><small>ALTITUDE</small><b>{orbit.altitudeKm == null ? "---" : `${Math.round(orbit.altitudeKm).toLocaleString("de-CH")} km`}</b></div>
            </div>
        </div>,
        target
    );
}
