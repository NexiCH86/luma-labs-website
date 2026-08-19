"use client";

import { useEffect, useMemo, useState } from "react";

type Aircraft = {
    latitude: number;
    longitude: number;
};

type RadarResponse = {
    aircraft?: Aircraft[];
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

type DensityCell = {
    latitude: number;
    longitude: number;
    count: number;
};

export default function TrafficDensity() {
    const [enabled, setEnabled] = useState(false);
    const [open, setOpen] = useState(false);
    const [cells, setCells] = useState(0);
    const [aircraftCount, setAircraftCount] = useState(0);

    const buttonLabel = useMemo(
        () => enabled ? `◌ DENSITY · ${aircraftCount}` : "◌ DENSITY",
        [enabled, aircraftCount]
    );

    useEffect(() => {
        let active = true;
        let currentMap: any = null;
        let layerGroup: any = null;
        let timer: number | null = null;

        async function setup() {
            const L = await import("leaflet");

            for (let attempt = 0; attempt < 80 && active; attempt++) {
                const map = window.__lumaRadarMap;
                if (map) {
                    currentMap = map;
                    layerGroup = L.layerGroup().addTo(map);
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            async function refresh() {
                if (!active || !currentMap || !layerGroup) return;

                if (!enabled) {
                    layerGroup.clearLayers();
                    setCells(0);
                    return;
                }

                try {
                    const response = await fetch("/api/radar", { cache: "no-store" });
                    if (!response.ok) return;
                    const data = (await response.json()) as RadarResponse;
                    const aircraft = Array.isArray(data.aircraft) ? data.aircraft : [];
                    const bounds = currentMap.getBounds();
                    const zoom = currentMap.getZoom();
                    const visible = aircraft.filter((item) =>
                        Number.isFinite(item.latitude) &&
                        Number.isFinite(item.longitude) &&
                        bounds.contains([item.latitude, item.longitude])
                    );

                    setAircraftCount(visible.length);

                    const density = aggregateDensity(visible, cellSizeForZoom(zoom));
                    setCells(density.length);
                    layerGroup.clearLayers();

                    const maxCount = Math.max(1, ...density.map((cell) => cell.count));

                    for (const cell of density) {
                        const intensity = cell.count / maxCount;
                        const radius = Math.max(12, Math.min(56, 12 + Math.sqrt(cell.count) * 8));
                        const color = densityColor(intensity);

                        const circle = L.circleMarker([cell.latitude, cell.longitude], {
                            radius,
                            stroke: false,
                            fillColor: color,
                            fillOpacity: 0.18 + intensity * 0.42,
                            interactive: true,
                            pane: "overlayPane",
                        });

                        circle.bindTooltip(
                            `${cell.count} aircraft in density cell`,
                            { direction: "top" }
                        );

                        circle.addTo(layerGroup);
                    }
                } catch {
                    // Keep the previous density frame if a live fetch fails.
                }
            }

            await refresh();
            timer = window.setInterval(refresh, 5000);

            const onMapMove = () => void refresh();
            currentMap?.on("moveend", onMapMove);
            currentMap?.on("zoomend", onMapMove);

            return () => {
                if (timer != null) window.clearInterval(timer);
                currentMap?.off("moveend", onMapMove);
                currentMap?.off("zoomend", onMapMove);
            };
        }

        let cleanup: (() => void) | undefined;
        setup().then((fn) => { cleanup = fn; });

        return () => {
            active = false;
            cleanup?.();
            layerGroup?.remove();
        };
    }, [enabled]);

    return (
        <div style={{ position: "fixed", left: 18, bottom: 194, zIndex: 1480, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
                    {buttonLabel}
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>AIR MODE</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>
                                Traffic Density
                            </strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <button type="button" onClick={() => setEnabled((value) => !value)} style={{ ...toggleStyle, opacity: enabled ? 1 : 0.72 }}>
                            {enabled ? "DENSITY MODE ON" : "ENABLE DENSITY MODE"}
                        </button>

                        <div style={statsStyle}>
                            <div><strong>{aircraftCount}</strong><small>VISIBLE AIRCRAFT</small></div>
                            <div><strong>{cells}</strong><small>ACTIVE CELLS</small></div>
                        </div>

                        <p style={hintStyle}>
                            Live aircraft are grouped into map cells. Denser cells become larger and warmer.
                        </p>

                        <div style={legendStyle}>
                            <span><i style={{ background: "#4ebbff" }} /> LOW</span>
                            <span><i style={{ background: "#b88cff" }} /> MEDIUM</span>
                            <span><i style={{ background: "#ff74d4" }} /> HIGH</span>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function aggregateDensity(aircraft: Aircraft[], cellSize: number) {
    const cells = new Map<string, { latSum: number; lonSum: number; count: number }>();

    for (const item of aircraft) {
        const latCell = Math.floor((item.latitude + 90) / cellSize);
        const lonCell = Math.floor((item.longitude + 180) / cellSize);
        const key = `${latCell}:${lonCell}`;
        const bucket = cells.get(key) ?? { latSum: 0, lonSum: 0, count: 0 };
        bucket.latSum += item.latitude;
        bucket.lonSum += item.longitude;
        bucket.count += 1;
        cells.set(key, bucket);
    }

    return [...cells.values()].map((cell): DensityCell => ({
        latitude: cell.latSum / cell.count,
        longitude: cell.lonSum / cell.count,
        count: cell.count,
    }));
}

function cellSizeForZoom(zoom: number) {
    if (zoom <= 5) return 5;
    if (zoom <= 7) return 2;
    if (zoom <= 9) return 0.8;
    if (zoom <= 11) return 0.35;
    return 0.16;
}

function densityColor(intensity: number) {
    if (intensity < 0.34) return "#4ebbff";
    if (intensity < 0.67) return "#b88cff";
    return "#ff74d4";
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(255,116,212,0.24)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.90)", color: "rgba(255,150,222,0.94)", boxShadow: "0 10px 34px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const panelStyle: React.CSSProperties = { width: "min(330px, calc(100vw - 36px))", border: "1px solid rgba(255,116,212,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(255,116,212,0.70)", fontSize: 9, letterSpacing: "0.16em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const toggleStyle: React.CSSProperties = { width: "100%", border: "1px solid rgba(255,116,212,0.24)", borderRadius: 10, padding: "10px 12px", background: "rgba(255,116,212,0.08)", color: "rgba(255,160,225,0.96)", cursor: "pointer", fontSize: 9, letterSpacing: "0.10em" };
const statsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 };
const hintStyle: React.CSSProperties = { margin: "12px 0 0", color: "rgba(255,255,255,0.36)", fontSize: 8, lineHeight: 1.5 };
const legendStyle: React.CSSProperties = { display: "flex", gap: 12, marginTop: 12, color: "rgba(255,255,255,0.42)", fontSize: 8 };
