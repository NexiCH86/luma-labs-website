"use client";

import { useEffect, useState } from "react";

type RadarStatus = {
    count?: number;
    updated?: number | null;
    receivedAt?: number | null;
    source?: string;
    status?: string;
};

export default function AirModeStatus() {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<RadarStatus | null>(null);

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                const response = await fetch("/api/radar", { cache: "no-store" });
                if (!response.ok) return;
                const data = (await response.json()) as RadarStatus;
                if (active) setStatus(data);
            } catch {
                // Keep the last known state.
            }
        }

        void load();
        const timer = window.setInterval(load, 10000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    const live = status?.status === "live";

    return (
        <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 1488, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={badgeStyle}>
                    <span style={{ ...dotStyle, background: live ? "#63ffe3" : "rgba(255,190,80,0.85)" }} />
                    AIR v1.0
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>LUMA RADAR</small>
                            <strong style={titleStyle}>AIR v1.0</strong>
                            <div style={subtitleStyle}>Worldwide aviation intelligence mode</div>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle} aria-label="Close AIR status">×</button>
                    </div>

                    <div style={{ padding: 12 }}>
                        <div style={statusRowStyle}>
                            <div>
                                <small style={labelStyle}>LIVE RADAR</small>
                                <strong style={{ ...statusValueStyle, color: live ? "#63ffe3" : "rgba(255,190,80,0.9)" }}>{live ? "ONLINE" : "WAITING"}</strong>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <small style={labelStyle}>TRACKED</small>
                                <strong style={statusValueStyle}>{status?.count ?? 0}</strong>
                            </div>
                        </div>

                        <div style={sectionStyle}>
                            <small style={sectionLabelStyle}>DATA SOURCES</small>
                            <SourceRow name="Live aircraft" detail="LuMa Collector → Upstash Redis" />
                            <SourceRow name="Aircraft metadata" detail="OpenSky aircraft database" />
                            <SourceRow name="Airports / runways" detail="OurAirports" />
                            <SourceRow name="METAR / TAF" detail="AviationWeather.gov" />
                            <SourceRow name="Country borders" detail="Natural Earth" />
                            <SourceRow name="FIR boundaries" detail="Reference GeoJSON dataset" />
                        </div>

                        <div style={sectionStyle}>
                            <small style={sectionLabelStyle}>AIR v1.0 CAPABILITIES</small>
                            <div style={capabilityGridStyle}>
                                {[
                                    "LIVE AIRCRAFT",
                                    "AIRCRAFT INTEL",
                                    "AIRPORTS",
                                    "RUNWAYS",
                                    "METAR / TAF",
                                    "TRAILS",
                                    "DENSITY",
                                    "AIRSPACE",
                                    "FILTERS",
                                    "SQUAWK ALERTS",
                                ].map((item) => <span key={item} style={chipStyle}>{item}</span>)}
                            </div>
                        </div>

                        <div style={noticeStyle}>
                            LuMa RADAR is an informational and situational-awareness project. Data can be delayed, incomplete or inaccurate and must not be used for navigation, flight planning, ATC decisions or safety-critical operations.
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function SourceRow({ name, detail }: { name: string; detail: string }) {
    return (
        <div style={sourceRowStyle}>
            <span style={sourceNameStyle}>{name}</span>
            <span style={sourceDetailStyle}>{detail}</span>
        </div>
    );
}

const badgeStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(99,255,227,0.18)", borderRadius: 999, padding: "8px 11px", background: "rgba(5,17,20,0.88)", color: "rgba(255,255,255,0.72)", boxShadow: "0 10px 30px rgba(0,0,0,0.26)", backdropFilter: "blur(12px)", cursor: "pointer", fontSize: 8, letterSpacing: "0.12em" };
const dotStyle: React.CSSProperties = { width: 6, height: 6, borderRadius: 999, boxShadow: "0 0 10px currentColor" };
const panelStyle: React.CSSProperties = { width: "min(360px, calc(100vw - 36px))", maxHeight: "min(680px, calc(100vh - 80px))", overflowY: "auto", border: "1px solid rgba(99,255,227,0.20)", borderRadius: 16, background: "rgba(5,17,20,0.97)", boxShadow: "0 22px 60px rgba(0,0,0,0.44)", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(99,255,227,0.64)", fontSize: 8, letterSpacing: "0.16em" };
const titleStyle: React.CSSProperties = { display: "block", color: "rgba(255,255,255,0.95)", fontSize: 16 };
const subtitleStyle: React.CSSProperties = { marginTop: 2, color: "rgba(255,255,255,0.32)", fontSize: 8 };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const statusRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 11px", borderRadius: 10, border: "1px solid rgba(99,255,227,0.08)", background: "rgba(99,255,227,0.025)" };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 3, color: "rgba(255,255,255,0.28)", fontSize: 7, letterSpacing: "0.12em" };
const statusValueStyle: React.CSSProperties = { display: "block", color: "rgba(255,255,255,0.86)", fontSize: 11 };
const sectionStyle: React.CSSProperties = { marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" };
const sectionLabelStyle: React.CSSProperties = { display: "block", marginBottom: 7, color: "rgba(99,255,227,0.52)", fontSize: 7, letterSpacing: "0.13em" };
const sourceRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.035)" };
const sourceNameStyle: React.CSSProperties = { color: "rgba(255,255,255,0.70)", fontSize: 8 };
const sourceDetailStyle: React.CSSProperties = { maxWidth: "58%", textAlign: "right", color: "rgba(255,255,255,0.32)", fontSize: 8 };
const capabilityGridStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };
const chipStyle: React.CSSProperties = { border: "1px solid rgba(99,255,227,0.10)", borderRadius: 999, padding: "4px 6px", background: "rgba(99,255,227,0.03)", color: "rgba(99,255,227,0.64)", fontSize: 7, letterSpacing: "0.06em" };
const noticeStyle: React.CSSProperties = { marginTop: 12, padding: "9px 10px", borderRadius: 9, background: "rgba(255,190,80,0.045)", border: "1px solid rgba(255,190,80,0.10)", color: "rgba(255,220,155,0.48)", fontSize: 7, lineHeight: 1.5 };
