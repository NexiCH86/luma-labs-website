"use client";

import { useMemo, useState } from "react";
import { propagate } from "satellite.js";
import { EARTH_RADIUS_KM, orbitMetrics, type SatEntry, type Vec3 } from "./orbit";

/*
 * Erde (NASA Blue Marble) mit der Umlaufbahn des ausgewaehlten
 * Satelliten, von schraeg oben, langsam drehend. Teile der Bahn
 * hinter der Erde werden ausgeblendet bzw. abgeschwaecht.
 */

type Projected = { x: number; y: number; z: number; hidden: boolean };

const EARTH_IMAGE = "https://commons.wikimedia.org/wiki/Special:Redirect/file/Blue%20Marble%202021.png";

function project(vec: Vec3, now: Date, maxRadius: number): Projected {
    const yaw = (now.getTime() / 90000) % (Math.PI * 2);
    const pitch = (-18 * Math.PI) / 180;
    const x1 = vec.x * Math.cos(yaw) - vec.y * Math.sin(yaw);
    const y1 = vec.x * Math.sin(yaw) + vec.y * Math.cos(yaw);
    const y2 = y1 * Math.cos(pitch) - vec.z * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + vec.z * Math.cos(pitch);
    const scale = 122 / maxRadius;
    const x = 180 + x1 * scale;
    const y = 133 - y2 * scale;
    const hidden = z2 < 0 && Math.hypot(x - 180, y - 133) < EARTH_RADIUS_KM * scale;
    return { x, y, z: z2, hidden };
}

function segment(points: Projected[], front: boolean) {
    let d = "";
    let drawing = false;
    for (const point of points) {
        const visible = (front ? point.z >= 0 : point.z < 0) && !point.hidden;
        if (!visible) {
            drawing = false;
            continue;
        }
        d += `${drawing ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
        drawing = true;
    }
    return d.trim();
}

function orbitGeometry(entry: SatEntry, now: Date) {
    const period = orbitMetrics(entry.record)?.periodMin;
    if (!period) return null;
    const raw: Vec3[] = [];
    const span = period * 60_000;
    for (let i = 0; i <= 180; i++) {
        const result = propagate(entry.satrec, new Date(now.getTime() - span / 2 + span * (i / 180)));
        if (result && typeof result.position === "object" && result.position) raw.push(result.position as Vec3);
    }
    if (!raw.length) return null;
    const maxRadius = Math.max(EARTH_RADIUS_KM * 1.18, ...raw.map((p) => Math.hypot(p.x, p.y, p.z)));
    const points = raw.map((p) => project(p, now, maxRadius));
    const mid = Math.floor(points.length / 2);
    return { rear: segment(points, false), front: segment(points, true), current: points[mid] ?? null };
}

export default function OrbitGlobe({ entry, now }: { entry: SatEntry; now: Date }) {
    const [imageFailed, setImageFailed] = useState(false);
    /* Alle 2 s neu berechnen reicht fuer die langsame Drehung. */
    const tick = Math.floor(now.getTime() / 2000);
    const orbit = useMemo(() => orbitGeometry(entry, new Date(tick * 2000)), [entry, tick]);

    return (
        <svg className="sat-globe" viewBox="0 0 360 275" role="img" aria-label={`Earth with the orbit of ${entry.name}`}>
            <defs>
                <clipPath id="sat-globe-clip"><circle cx="180" cy="133" r="70" /></clipPath>
                <radialGradient id="sat-globe-fallback" cx="34%" cy="28%" r="72%">
                    <stop offset="0%" stopColor="#247f9d" />
                    <stop offset="58%" stopColor="#0a3d62" />
                    <stop offset="100%" stopColor="#020914" />
                </radialGradient>
                <linearGradient id="sat-globe-night" x1="0%" y1="0%" x2="100%" y2="20%">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
                    <stop offset="55%" stopColor="rgba(0,0,0,0.12)" />
                    <stop offset="78%" stopColor="rgba(0,0,0,0.58)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.92)" />
                </linearGradient>
                <radialGradient id="sat-globe-atmo" cx="38%" cy="36%" r="68%">
                    <stop offset="76%" stopColor="rgba(70,180,255,0)" />
                    <stop offset="91%" stopColor="rgba(70,180,255,0.12)" />
                    <stop offset="100%" stopColor="rgba(115,220,255,0.55)" />
                </radialGradient>
            </defs>

            <g className="sat-globe-stars" aria-hidden="true">
                <circle cx="28" cy="30" r="0.7" /><circle cx="55" cy="86" r="0.5" /><circle cx="98" cy="27" r="0.45" /><circle cx="294" cy="31" r="0.65" />
                <circle cx="331" cy="82" r="0.5" /><circle cx="318" cy="214" r="0.65" /><circle cx="45" cy="221" r="0.55" /><circle cx="338" cy="153" r="0.45" />
            </g>

            {orbit?.rear && <path d={orbit.rear} className="sat-globe-orbit-rear" />}

            <circle cx="180" cy="133" r="76" className="sat-globe-atmo-ring" />
            <circle cx="180" cy="133" r="73" fill="url(#sat-globe-atmo)" />
            <circle cx="180" cy="133" r="70" fill="url(#sat-globe-fallback)" />
            {!imageFailed && (
                <image
                    href={EARTH_IMAGE}
                    x="110"
                    y="63"
                    width="140"
                    height="140"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#sat-globe-clip)"
                    onError={() => setImageFailed(true)}
                />
            )}
            <g clipPath="url(#sat-globe-clip)">
                <circle cx="180" cy="133" r="70" fill="url(#sat-globe-night)" />
                <ellipse cx="158" cy="104" rx="23" ry="15" fill="rgba(255,255,255,0.10)" />
            </g>
            <circle cx="180" cy="133" r="70" className="sat-globe-edge" />
            <ellipse cx="180" cy="133" rx="70" ry="19" className="sat-globe-grid" />
            <ellipse cx="180" cy="133" rx="70" ry="40" className="sat-globe-grid" />
            <ellipse cx="180" cy="133" rx="27" ry="70" className="sat-globe-grid" />
            <ellipse cx="180" cy="133" rx="50" ry="70" className="sat-globe-grid" />

            {orbit?.front && <path d={orbit.front} className="sat-globe-orbit-front" />}
            {orbit?.current && !orbit.current.hidden && (
                <g>
                    <circle cx={orbit.current.x} cy={orbit.current.y} r="8" className="sat-globe-sat-glow" />
                    <circle cx={orbit.current.x} cy={orbit.current.y} r="3.1" className="sat-globe-sat-dot" />
                    <text x={orbit.current.x + 8} y={orbit.current.y - 7} className="sat-globe-sat-label">{entry.name}</text>
                </g>
            )}
        </svg>
    );
}
