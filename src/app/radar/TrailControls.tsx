"use client";

import { useEffect, useRef, useState } from "react";

type Aircraft = {
    icao24: string;
    latitude: number;
    longitude: number;
    verticalRate: number | null;
};

type RadarResponse = {
    aircraft?: Aircraft[];
};

type TrailLength = "SHORT" | "MEDIUM" | "LONG" | "FULL";

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

const LENGTH_POINTS: Record<TrailLength, number> = {
    SHORT: 20,
    MEDIUM: 60,
    LONG: 140,
    FULL: 1000,
};

export default function TrailControls() {
    const [open, setOpen] = useState(false);
    const [length, setLength] = useState<TrailLength>("LONG");
    const [phaseColors, setPhaseColors] = useState(true);
    const [showTrails, setShowTrails] = useState(true);
    const settingsRef = useRef({ length: "LONG" as TrailLength, phaseColors: true, showTrails: true });
    const aircraftRef = useRef<Aircraft[]>([]);
    const originalsRef = useRef(new WeakMap<object, [number, number][]>());

    useEffect(() => {
        settingsRef.current = { length, phaseColors, showTrails };
        applyTrails();
    }, [length, phaseColors, showTrails]);

    useEffect(() => {
        let active = true;

        async function loadAircraft() {
            try {
                const response = await fetch("/api/radar", { cache: "no-store" });
                if (!response.ok) return;
                const data = (await response.json()) as RadarResponse;
                if (!active) return;
                aircraftRef.current = Array.isArray(data.aircraft) ? data.aircraft : [];
                applyTrails();
            } catch {}
        }

        loadAircraft();
        const snapshotTimer = window.setInterval(loadAircraft, 5000);
        const repaintTimer = window.setInterval(applyTrails, 1000);

        return () => {
            active = false;
            window.clearInterval(snapshotTimer);
            window.clearInterval(repaintTimer);
            restoreTrails();
        };
    }, []);

    function applyTrails() {
        const map = window.__lumaRadarMap;
        if (!map) return;

        const settings = settingsRef.current;
        const maxPoints = LENGTH_POINTS[settings.length];

        map.eachLayer((layer: any) => {
            if (!isAircraftTrail(layer)) return;

            const current = normalizeLatLngs(layer.getLatLngs?.());
            if (current.length < 2) return;

            const previousFull = originalsRef.current.get(layer);
            if (!previousFull || current.length > previousFull.length) {
                originalsRef.current.set(layer, current);
            }

            const full = originalsRef.current.get(layer) ?? current;
            const visible = settings.length === "FULL" ? full : full.slice(-maxPoints);
            layer.setLatLngs?.(visible);

            if (!settings.showTrails) {
                layer.setStyle?.({ opacity: 0 });
                return;
            }

            const endpoint = visible.at(-1);
            const aircraft = endpoint ? nearestAircraft(aircraftRef.current, endpoint[0], endpoint[1]) : null;
            const selected = isSelectedTrail(layer);
            const baseOpacity = selected ? 0.72 : 0.16;
            const baseWeight = selected ? 2.4 : 1.2;

            if (settings.phaseColors && aircraft) {
                const verticalFpm = (aircraft.verticalRate ?? 0) * 196.85;
                const color = verticalFpm > 300
                    ? "#63ffe3"
                    : verticalFpm < -300
                        ? "#ff8fd8"
                        : "#4ebbff";

                layer.setStyle?.({ color, opacity: baseOpacity, weight: baseWeight });
            } else {
                layer.setStyle?.({
                    color: selected ? "#63ffe3" : "#238bd2",
                    opacity: baseOpacity,
                    weight: baseWeight,
                });
            }
        });
    }

    function restoreTrails() {
        const map = window.__lumaRadarMap;
        if (!map) return;

        map.eachLayer((layer: any) => {
            if (!isAircraftTrail(layer)) return;
            const full = originalsRef.current.get(layer);
            if (full) layer.setLatLngs?.(full);
            layer.setStyle?.({ opacity: isSelectedTrail(layer) ? 0.72 : 0.12 });
        });
    }

    return (
        <div style={{ position: "fixed", left: 18, bottom: 148, zIndex: 1485, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
                    ⌁ TRAILS
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>TRACK DISPLAY</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>Aircraft Trails v2</strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <label style={labelStyle}>TRAIL LENGTH</label>
                        <select value={length} onChange={(event) => setLength(event.target.value as TrailLength)} style={selectStyle}>
                            <option value="SHORT">Short · ~20 positions</option>
                            <option value="MEDIUM">Medium · ~60 positions</option>
                            <option value="LONG">Long · ~140 positions</option>
                            <option value="FULL">Full history</option>
                        </select>

                        <Toggle label="SHOW TRAILS" value={showTrails} onChange={setShowTrails} />
                        <Toggle label="PHASE COLORS" value={phaseColors} onChange={setPhaseColors} />

                        <div style={legendStyle}>
                            <span><b style={{ color: "#63ffe3" }}>●</b> CLIMB</span>
                            <span><b style={{ color: "#4ebbff" }}>●</b> LEVEL</span>
                            <span><b style={{ color: "#ff8fd8" }}>●</b> DESCENT</span>
                        </div>

                        <p style={hintStyle}>Trail length changes only the visible history. Redis track data remains untouched.</p>
                    </div>
                </section>
            )}
        </div>
    );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
    return (
        <button type="button" onClick={() => onChange(!value)} style={toggleStyle}>
            <span>{label}</span>
            <strong style={{ color: value ? "#63ffe3" : "rgba(255,255,255,0.35)" }}>{value ? "ON" : "OFF"}</strong>
        </button>
    );
}

function isAircraftTrail(layer: any) {
    if (!layer?.getLatLngs || !layer?.setLatLngs || !layer?.setStyle) return false;
    const options = layer.options ?? {};
    if (options.dashArray) return false;
    const color = String(options.color ?? "").toLowerCase();
    return color === "#238bd2" || color === "#63ffe3" || color === "#4ebbff" || color === "#ff8fd8";
}

function isSelectedTrail(layer: any) {
    const options = layer.options ?? {};
    return Number(options.weight ?? 0) > 1.5 || String(options.color ?? "").toLowerCase() === "#63ffe3";
}

function normalizeLatLngs(value: any): [number, number][] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lng))
        .map((item) => [Number(item.lat), Number(item.lng)] as [number, number]);
}

function nearestAircraft(aircraft: Aircraft[], latitude: number, longitude: number) {
    let best: Aircraft | null = null;
    let bestScore = 0.03 * 0.03;
    for (const item of aircraft) {
        const dy = item.latitude - latitude;
        const dx = item.longitude - longitude;
        const score = dy * dy + dx * dx;
        if (score < bestScore) {
            bestScore = score;
            best = item;
        }
    }
    return best;
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(78,187,255,0.24)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.90)", color: "rgba(105,202,255,0.94)", boxShadow: "0 10px 34px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const panelStyle: React.CSSProperties = { width: "min(330px, calc(100vw - 36px))", border: "1px solid rgba(78,187,255,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(78,187,255,0.72)", fontSize: 8, letterSpacing: "0.15em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 5, color: "rgba(255,255,255,0.34)", fontSize: 8, letterSpacing: "0.12em" };
const selectStyle: React.CSSProperties = { width: "100%", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 9px", outline: "none", background: "#0a171a", color: "rgba(255,255,255,0.86)", fontSize: 10, marginBottom: 12 };
const toggleStyle: React.CSSProperties = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "9px 10px", background: "rgba(255,255,255,0.025)", color: "rgba(255,255,255,0.58)", cursor: "pointer", fontSize: 8, letterSpacing: "0.1em" };
const legendStyle: React.CSSProperties = { display: "flex", gap: 12, marginTop: 12, paddingTop: 11, borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.42)", fontSize: 8, letterSpacing: "0.08em" };
const hintStyle: React.CSSProperties = { margin: "10px 0 0", color: "rgba(255,255,255,0.28)", fontSize: 8, lineHeight: 1.45 };
