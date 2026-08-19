"use client";

import { useEffect, useMemo, useState } from "react";

type Aircraft = {
    icao24: string;
    callsign: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    squawk: string | null;
};

type RadarResponse = {
    aircraft?: Aircraft[];
};

type Alert = Aircraft & {
    code: "7500" | "7600" | "7700";
    label: string;
    severity: "critical" | "warning";
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

const SQUAWK_INFO: Record<string, { label: string; severity: "critical" | "warning" }> = {
    "7500": { label: "UNLAWFUL INTERFERENCE", severity: "critical" },
    "7600": { label: "RADIO FAILURE", severity: "warning" },
    "7700": { label: "GENERAL EMERGENCY", severity: "critical" },
};

export default function SquawkAlerts() {
    const [open, setOpen] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const criticalCount = useMemo(
        () => alerts.filter((alert) => alert.severity === "critical").length,
        [alerts]
    );

    useEffect(() => {
        let active = true;
        let layerGroup: any = null;
        let currentMap: any = null;

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

            async function load() {
                try {
                    const response = await fetch("/api/radar", { cache: "no-store" });
                    if (!response.ok) return;
                    const data = (await response.json()) as RadarResponse;
                    if (!active) return;

                    const nextAlerts = (Array.isArray(data.aircraft) ? data.aircraft : [])
                        .map((aircraft) => {
                            const code = aircraft.squawk?.trim();
                            const info = code ? SQUAWK_INFO[code] : null;
                            if (!info || !code) return null;
                            return {
                                ...aircraft,
                                code: code as Alert["code"],
                                label: info.label,
                                severity: info.severity,
                            } satisfies Alert;
                        })
                        .filter((value): value is Alert => Boolean(value));

                    setAlerts(nextAlerts);

                    if (!layerGroup || !currentMap) return;
                    layerGroup.clearLayers();

                    for (const alert of nextAlerts) {
                        const icon = L.divIcon({
                            className: "luma-squawk-alert-wrapper",
                            html: `
                                <div class="luma-squawk-alert ${alert.severity}">
                                    <span class="pulse"></span>
                                    <strong>${escapeHtml(alert.code)}</strong>
                                </div>
                            `,
                            iconSize: [54, 34],
                            iconAnchor: [27, 17],
                        });

                        const marker = L.marker([alert.latitude, alert.longitude], {
                            icon,
                            interactive: true,
                            keyboard: false,
                            zIndexOffset: 2200,
                        });

                        marker.bindTooltip(
                            `${alert.callsign?.trim() || alert.icao24.toUpperCase()} · ${alert.code} · ${alert.label}`,
                            { direction: "top", offset: [0, -10] }
                        );

                        marker.on("click", () => {
                            currentMap.flyTo([alert.latitude, alert.longitude], Math.max(currentMap.getZoom(), 10), {
                                duration: 1.1,
                            });
                        });

                        marker.addTo(layerGroup);
                    }
                } catch {
                    // RadarClient owns the primary retry loop; alerts keep their last good state.
                }
            }

            await load();
            const timer = window.setInterval(load, 5000);

            return () => window.clearInterval(timer);
        }

        let cleanupTimer: (() => void) | undefined;
        setup().then((cleanup) => {
            cleanupTimer = cleanup;
        });

        return () => {
            active = false;
            cleanupTimer?.();
            layerGroup?.remove();
        };
    }, []);

    return (
        <div style={{ position: "fixed", right: 284, top: 76, zIndex: 1510, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={{ ...triggerStyle, opacity: alerts.length ? 1 : 0.62 }}>
                    ⚠ ALERTS{alerts.length ? ` · ${alerts.length}` : ""}
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>SQUAWK INTELLIGENCE</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>Live Alerts</strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <div style={summaryStyle}>
                            <span>ACTIVE</span>
                            <strong>{alerts.length}</strong>
                            <small>{criticalCount} critical</small>
                        </div>

                        {alerts.length === 0 ? (
                            <div style={emptyStyle}>
                                No emergency squawks detected in the current live snapshot.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                                {alerts.map((alert) => (
                                    <AlertRow key={`${alert.icao24}-${alert.code}`} alert={alert} />
                                ))}
                            </div>
                        )}

                        <div style={legendStyle}>
                            <div><strong>7500</strong><span>Unlawful interference</span></div>
                            <div><strong>7600</strong><span>Radio failure</span></div>
                            <div><strong>7700</strong><span>General emergency</span></div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function AlertRow({ alert }: { alert: Alert }) {
    const altitudeFt = alert.altitude == null ? null : Math.round(alert.altitude * 3.28084);

    return (
        <div style={{ ...rowStyle, borderColor: alert.severity === "critical" ? "rgba(255,92,92,0.28)" : "rgba(255,190,80,0.24)" }}>
            <div>
                <strong style={{ color: alert.severity === "critical" ? "rgba(255,120,120,0.98)" : "rgba(255,205,115,0.98)", fontSize: 18 }}>
                    {alert.code}
                </strong>
                <small style={{ display: "block", marginTop: 2, color: "rgba(255,255,255,0.48)", fontSize: 8, letterSpacing: "0.08em" }}>
                    {alert.label}
                </small>
            </div>
            <div style={{ textAlign: "right" }}>
                <strong style={{ display: "block", color: "rgba(255,255,255,0.88)", fontSize: 10 }}>
                    {alert.callsign?.trim() || alert.icao24.toUpperCase()}
                </strong>
                <small style={{ color: "rgba(255,255,255,0.38)", fontSize: 8 }}>
                    {altitudeFt != null ? `${altitudeFt.toLocaleString("de-CH")} ft` : "Altitude ---"}
                </small>
            </div>
        </div>
    );
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(255,105,105,0.26)", borderRadius: 999, padding: "9px 13px", background: "rgba(21,8,10,0.92)", color: "rgba(255,140,140,0.96)", boxShadow: "0 10px 34px rgba(0,0,0,0.30)", cursor: "pointer", fontSize: 9, letterSpacing: "0.11em" };
const panelStyle: React.CSSProperties = { width: "min(340px, calc(100vw - 36px))", border: "1px solid rgba(255,105,105,0.22)", borderRadius: 16, background: "rgba(17,7,9,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.44)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(255,120,120,0.72)", fontSize: 8, letterSpacing: "0.15em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const summaryStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto auto 1fr", alignItems: "baseline", gap: 8, marginBottom: 12, padding: "10px 11px", borderRadius: 10, background: "rgba(255,95,95,0.06)", color: "rgba(255,255,255,0.46)", fontSize: 8, letterSpacing: "0.1em" };
const emptyStyle: React.CSSProperties = { padding: "14px 12px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "rgba(255,255,255,0.42)", fontSize: 9, lineHeight: 1.55 };
const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 11px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.025)" };
const legendStyle: React.CSSProperties = { display: "grid", gap: 6, marginTop: 13, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.36)", fontSize: 8 };
