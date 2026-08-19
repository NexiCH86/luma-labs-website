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
type OrbitPoint = { x: number; y: number; depth: number; insideEarthDisc: boolean };

type OrbitGeometry = {
    rearPath: string;
    frontPath: string;
    current: OrbitPoint | null;
    altitudeKm: number | null;
};

const EARTH_RADIUS_KM = 6378.137;
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
            const satellite = getSatelliteJs();
            if (satellite) {
                window.clearInterval(timer);
                resolve(satellite);
                return;
            }
            if (Date.now() - started > 10000) {
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

function orbitalPeriodMinutes(record: Record<string, unknown> | null) {
    const meanMotion = numberValue(record, "MEAN_MOTION");
    return meanMotion && meanMotion > 0 ? 1440 / meanMotion : null;
}

function rotateForView(point: Vec3, now: Date) {
    const yaw = (now.getTime() / 70000) % (Math.PI * 2);
    const pitch = -23 * Math.PI / 180;

    const x1 = point.x * Math.cos(yaw) - point.y * Math.sin(yaw);
    const y1 = point.x * Math.sin(yaw) + point.y * Math.cos(yaw);
    const z1 = point.z;

    return {
        x: x1,
        y: y1 * Math.cos(pitch) - z1 * Math.sin(pitch),
        z: y1 * Math.sin(pitch) + z1 * Math.cos(pitch),
    };
}

function buildPath(points: OrbitPoint[], mode: "front" | "rear") {
    let result = "";
    let drawing = false;

    for (const point of points) {
        const hiddenByEarth = point.depth < 0 && point.insideEarthDisc;
        const belongs = mode === "rear" ? point.depth < 0 : point.depth >= 0;
        const visible = belongs && !hiddenByEarth;

        if (!visible) {
            drawing = false;
            continue;
        }

        result += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
        drawing = true;
    }

    return result.trim();
}

function calculateOrbit(
    satellite: SatelliteJs | null,
    satrec: SatRec | null,
    periodMinutes: number | null,
    now: Date
): OrbitGeometry {
    if (!satellite || !satrec || !periodMinutes) {
        return { rearPath: "", frontPath: "", current: null, altitudeKm: null };
    }

    const width = 360;
    const height = 270;
    const centerX = width / 2;
    const centerY = 132;
    const earthRadiusPx = 66;
    const periodMs = periodMinutes * 60_000;
    const raw: Array<{ vec: Vec3; current: boolean }> = [];

    for (let index = 0; index <= 180; index++) {
        const fraction = index / 180;
        const date = new Date(now.getTime() - periodMs / 2 + periodMs * fraction);
        const propagated = satellite.propagate(satrec, date);
        if (!propagated) continue;
        raw.push({ vec: propagated.position, current: Math.abs(fraction - 0.5) < 0.004 });
    }

    if (!raw.length) return { rearPath: "", frontPath: "", current: null, altitudeKm: null };

    const maxRadius = Math.max(
        EARTH_RADIUS_KM * 1.18,
        ...raw.map((item) => Math.hypot(item.vec.x, item.vec.y, item.vec.z))
    );
    const scale = 112 / maxRadius;

    const points: OrbitPoint[] = [];
    let current: OrbitPoint | null = null;
    let altitudeKm: number | null = null;

    raw.forEach((item, index) => {
        const rotated = rotateForView(item.vec, now);
        const point = {
            x: centerX + rotated.x * scale,
            y: centerY - rotated.y * scale,
            depth: rotated.z,
            insideEarthDisc: false,
        };
        const radial = Math.hypot(point.x - centerX, point.y - centerY);
        point.insideEarthDisc = radial < earthRadiusPx - 1;
        points.push(point);

        if (item.current || index === Math.floor(raw.length / 2)) {
            current = point;
            altitudeKm = Math.max(0, Math.hypot(item.vec.x, item.vec.y, item.vec.z) - EARTH_RADIUS_KM);
        }
    });

    return {
        rearPath: buildPath(points, "rear"),
        frontPath: buildPath(points, "front"),
        current,
        altitudeKm,
    };
}

export default function SatRealisticOrbitGlobe() {
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [satellite, setSatellite] = useState<SatelliteJs | null>(null);
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [record, setRecord] = useState<Record<string, unknown> | null>(null);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        let stopped = false;
        const findTarget = () => {
            if (stopped) return;
            const card = document.querySelector<HTMLElement>(".satv1-orbit-card");
            if (!card) {
                requestAnimationFrame(findTarget);
                return;
            }
            card.classList.add("sat-realistic-mounted");
            setTarget(card);
        };
        findTarget();
        return () => {
            stopped = true;
            document.querySelector<HTMLElement>(".satv1-orbit-card")?.classList.remove("sat-realistic-mounted");
        };
    }, []);

    useEffect(() => {
        const read = () => {
            const next = selectionFromDom();
            setSelection((current) =>
                current?.norad === next?.norad && current?.groupLabel === next?.groupLabel ? current : next
            );
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1800);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setRecord(null);
        setSatrec(null);
        if (!selection) return;

        const group = GROUP_BY_LABEL[selection.groupLabel] ?? "STATIONS";
        Promise.all([
            waitForSatelliteJs(),
            fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`, { cache: "no-store" }).then((response) => response.json()),
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
                setRecord(null);
                setSatrec(null);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selection]);

    const periodMinutes = useMemo(() => orbitalPeriodMinutes(record), [record]);
    const orbit = useMemo(
        () => calculateOrbit(satellite, satrec, periodMinutes, now),
        [satellite, satrec, periodMinutes, now]
    );

    if (!target) return null;

    return createPortal(
        <div className="sat-realistic-orbit" aria-label="Realistic three-dimensional Earth and satellite orbit projection">
            <svg viewBox="0 0 360 270" role="img" aria-label="Realistic Earth globe with live satellite orbit">
                <defs>
                    <radialGradient id="sat-earth-ocean" cx="31%" cy="25%" r="78%">
                        <stop offset="0%" stopColor="#2e8fb4" />
                        <stop offset="38%" stopColor="#0f557c" />
                        <stop offset="72%" stopColor="#07324e" />
                        <stop offset="100%" stopColor="#020b18" />
                    </radialGradient>
                    <radialGradient id="sat-earth-light" cx="27%" cy="22%" r="74%">
                        <stop offset="0%" stopColor="rgba(255,255,225,0.42)" />
                        <stop offset="45%" stopColor="rgba(92,194,216,0.08)" />
                        <stop offset="78%" stopColor="rgba(0,0,0,0.18)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
                    </radialGradient>
                    <radialGradient id="sat-atmosphere" cx="38%" cy="35%" r="68%">
                        <stop offset="72%" stopColor="rgba(81,197,255,0)" />
                        <stop offset="88%" stopColor="rgba(81,197,255,0.15)" />
                        <stop offset="100%" stopColor="rgba(111,221,255,0.55)" />
                    </radialGradient>
                    <filter id="sat-earth-surface" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves="4" seed="17" result="noise" />
                        <feColorMatrix in="noise" type="matrix" values="1.8 0 0 0 -0.55  0 1.2 0 0 -0.18  0 0 0.45 0 0.08  0 0 0 1 0" result="terrain" />
                        <feBlend in="SourceGraphic" in2="terrain" mode="soft-light" />
                    </filter>
                    <filter id="sat-clouds" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.032 0.065" numOctaves="3" seed="8" result="cloudNoise" />
                        <feColorMatrix in="cloudNoise" type="matrix" values="1 0 0 0 .35  0 1 0 0 .42  0 0 1 0 .48  0 0 0 1.4 -.55" />
                    </filter>
                    <filter id="sat-soft-glow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <clipPath id="sat-earth-disc"><circle cx="180" cy="132" r="66" /></clipPath>
                </defs>

                <g className="sat-realistic-stars" aria-hidden="true">
                    <circle cx="28" cy="30" r="0.8"/><circle cx="61" cy="76" r="0.55"/><circle cx="315" cy="35" r="0.75"/><circle cx="334" cy="91" r="0.5"/><circle cx="291" cy="227" r="0.7"/><circle cx="46" cy="218" r="0.65"/><circle cx="104" cy="24" r="0.45"/><circle cx="244" cy="25" r="0.45"/><circle cx="18" cy="143" r="0.5"/><circle cx="345" cy="161" r="0.55"/>
                </g>

                {orbit.rearPath && <path d={orbit.rearPath} className="sat-realistic-orbit-rear" />}

                <circle cx="180" cy="132" r="72" className="sat-realistic-atmo-outer" />
                <circle cx="180" cy="132" r="68" fill="url(#sat-atmosphere)" />
                <circle cx="180" cy="132" r="66" fill="url(#sat-earth-ocean)" filter="url(#sat-earth-surface)" />

                <g clipPath="url(#sat-earth-disc)">
                    <ellipse cx="168" cy="128" rx="72" ry="66" fill="rgba(55,115,58,0.24)" filter="url(#sat-earth-surface)" />
                    <rect x="111" y="66" width="138" height="132" fill="rgba(255,255,255,0.20)" filter="url(#sat-clouds)" opacity="0.64" />
                    <ellipse cx="180" cy="132" rx="66" ry="17" className="sat-realistic-grid" />
                    <ellipse cx="180" cy="132" rx="66" ry="37" className="sat-realistic-grid" />
                    <ellipse cx="180" cy="132" rx="24" ry="66" className="sat-realistic-grid" />
                    <ellipse cx="180" cy="132" rx="46" ry="66" className="sat-realistic-grid" />
                    <circle cx="180" cy="132" r="66" fill="url(#sat-earth-light)" />
                    <ellipse cx="151" cy="105" rx="26" ry="18" fill="rgba(255,255,255,0.08)" />
                </g>

                <circle cx="180" cy="132" r="66" className="sat-realistic-earth-edge" />

                {orbit.frontPath && <path d={orbit.frontPath} className="sat-realistic-orbit-front" />}

                {orbit.current && (
                    <g className={orbit.current.depth >= 0 ? "sat-realistic-current is-front" : "sat-realistic-current is-rear"}>
                        <circle cx={orbit.current.x} cy={orbit.current.y} r="10" className="sat-realistic-sat-halo" />
                        <circle cx={orbit.current.x} cy={orbit.current.y} r="3.4" className="sat-realistic-sat-dot" />
                        <line x1={orbit.current.x + 4} y1={orbit.current.y - 4} x2={orbit.current.x + 16} y2={orbit.current.y - 15} className="sat-realistic-callout-line" />
                        <text x={orbit.current.x + 19} y={orbit.current.y - 17} className="sat-realistic-callout-text">{selection?.name?.slice(0, 18) ?? "SAT"}</text>
                    </g>
                )}
            </svg>

            <div className="sat-realistic-caption">
                <div><strong>LIVE 3D ORBIT</strong><span>Earth-centred projection · animated view</span></div>
                <div><small>ALTITUDE</small><b>{orbit.altitudeKm == null ? "---" : `${Math.round(orbit.altitudeKm).toLocaleString("de-CH")} km`}</b></div>
            </div>
        </div>,
        target
    );
}
