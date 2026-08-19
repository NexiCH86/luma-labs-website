"use client";

import { useEffect, useState } from "react";

type RunwayInfo = {
    id?: string | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    surface?: string | null;
    lighted?: boolean;
    leIdent?: string | null;
    leHeading?: number | null;
    leElevationFt?: number | null;
    leDisplacedThresholdFt?: number | null;
    heIdent?: string | null;
    heHeading?: number | null;
    heElevationFt?: number | null;
    heDisplacedThresholdFt?: number | null;
};

type FrequencyInfo = {
    type?: string | null;
    description?: string | null;
    frequencyMhz: number;
};

type AirportInfo = {
    found: boolean;
    icao?: string | null;
    iata?: string | null;
    name?: string | null;
    latitude?: number;
    longitude?: number;
    elevationFt?: number | null;
    country?: string | null;
    countryIso?: string | null;
    city?: string | null;
    region?: string | null;
    type?: string | null;
    scheduledService?: boolean;
    wikipedia?: string | null;
    website?: string | null;
    source?: string | null;
    runways?: RunwayInfo[];
    frequencies?: FrequencyInfo[];
};

type AirportLayerSelectDetail = { code?: string | null };

export default function AirportExplorer() {
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [airport, setAirport] = useState<AirportInfo | null>(null);

    useEffect(() => {
        const onAirportLayerSelect = (event: Event) => {
            const detail = (event as CustomEvent<AirportLayerSelectDetail>).detail;
            const nextCode = detail?.code?.trim().toUpperCase();
            if (!nextCode) return;
            setOpen(true);
            setCode(nextCode);
            void loadAirport(nextCode);
        };
        window.addEventListener("luma:airport-layer-select", onAirportLayerSelect);
        return () => window.removeEventListener("luma:airport-layer-select", onAirportLayerSelect);
    }, []);

    async function loadAirport(query: string) {
        setError("");
        setAirport(null);
        if (!/^[A-Z0-9]{3,4}$/.test(query)) {
            setError("Enter a 3-letter IATA or 4-letter ICAO code.");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`/api/radar/airport?code=${encodeURIComponent(query)}`, { cache: "no-store" });
            const data: AirportInfo & { error?: string } = await response.json();
            if (!response.ok) { setError(data.error ?? "Airport lookup failed."); return; }
            if (!data.found) { setError("Airport not found."); return; }
            setAirport(data);
        } catch { setError("Airport lookup failed."); }
        finally { setLoading(false); }
    }

    function searchAirport() { void loadAirport(code.trim().toUpperCase()); }
    function focusAirport() {
        if (!airport || airport.latitude == null || airport.longitude == null) return;
        window.dispatchEvent(new CustomEvent("luma:airport-focus", { detail: {
            latitude: airport.latitude, longitude: airport.longitude,
            code: airport.iata ?? airport.icao ?? "AIRPORT", name: airport.name ?? "Airport",
        }}));
    }

    const elevationM = airport?.elevationFt != null ? Math.round(airport.elevationFt * 0.3048) : null;
    const runways = airport?.runways ?? [];
    const frequencies = airport?.frequencies ?? [];

    return (
        <div style={{ position: "fixed", left: 18, bottom: 56, zIndex: 1500, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={buttonStyle}>◉ AIRPORTS</button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div><small style={eyebrowStyle}>WORLDWIDE</small><strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>Airport Intelligence</strong></div>
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close airport explorer" style={iconButtonStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && searchAirport()} placeholder="ZRH / LSZH / JFK / KJFK" maxLength={4} style={inputStyle} />
                            <button type="button" onClick={searchAirport} disabled={loading} style={searchButtonStyle}>{loading ? "..." : "SEARCH"}</button>
                        </div>
                        <p style={hintStyle}>Search worldwide by IATA / ICAO or click an airport marker on the map.</p>
                        {error && <div style={errorStyle}>{error}</div>}

                        {airport && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                    <div>
                                        <strong style={{ display: "block", color: "#63ffe3", fontSize: 26, letterSpacing: "0.04em" }}>{airport.iata ?? airport.icao ?? "---"}</strong>
                                        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, lineHeight: 1.4 }}>{airport.name ?? "Unknown airport"}</span>
                                        <div style={{ marginTop: 5, color: "rgba(255,255,255,0.38)", fontSize: 9 }}>{[airport.icao, formatAirportType(airport.type)].filter(Boolean).join(" · ")}</div>
                                    </div>
                                    <ServiceBadge active={Boolean(airport.scheduledService)} />
                                </div>

                                <div style={gridStyle}>
                                    <AirportValue label="CITY" value={airport.city} />
                                    <AirportValue label="COUNTRY" value={[airport.country, airport.countryIso].filter(Boolean).join(" · ") || null} />
                                    <AirportValue label="REGION" value={airport.region} />
                                    <AirportValue label="AIRPORT TYPE" value={formatAirportType(airport.type)} />
                                    <AirportValue label="ELEVATION" value={airport.elevationFt != null ? `${airport.elevationFt.toLocaleString()} ft · ${elevationM?.toLocaleString()} m` : null} />
                                    <AirportValue label="SCHEDULED" value={airport.scheduledService ? "YES" : "NO"} />
                                    <AirportValue label="LATITUDE" value={airport.latitude != null ? airport.latitude.toFixed(5) : null} />
                                    <AirportValue label="LONGITUDE" value={airport.longitude != null ? airport.longitude.toFixed(5) : null} />
                                    <AirportValue label="DATA SOURCE" value={airport.source ?? "OurAirports"} />
                                </div>

                                {runways.length > 0 && (
                                    <section style={opsSectionStyle}>
                                        <div style={opsHeaderStyle}><div><small style={opsEyebrowStyle}>AIRPORT OPERATIONS</small><strong style={opsTitleStyle}>Runways</strong></div><span style={countBadgeStyle}>{runways.length}</span></div>
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {runways.slice(0, 8).map((runway, index) => <RunwayRow key={runway.id ?? `${runway.leIdent}-${runway.heIdent}-${index}`} runway={runway} />)}
                                        </div>
                                    </section>
                                )}

                                {frequencies.length > 0 && (
                                    <section style={opsSectionStyle}>
                                        <div style={opsHeaderStyle}><div><small style={opsEyebrowStyle}>RADIO</small><strong style={opsTitleStyle}>Frequencies</strong></div><span style={countBadgeStyle}>{frequencies.length}</span></div>
                                        <div style={{ display: "grid", gap: 6 }}>
                                            {prioritizeFrequencies(frequencies).slice(0, 10).map((frequency, index) => <FrequencyRow key={`${frequency.type}-${frequency.frequencyMhz}-${index}`} frequency={frequency} />)}
                                        </div>
                                    </section>
                                )}

                                <div style={{ display: "grid", gridTemplateColumns: airport.website && airport.wikipedia ? "1fr 1fr" : "1fr", gap: 8, marginTop: 16 }}>
                                    {airport.website && <a href={airport.website} target="_blank" rel="noreferrer" style={linkButtonStyle}>OFFICIAL WEBSITE ↗</a>}
                                    {airport.wikipedia && <a href={airport.wikipedia} target="_blank" rel="noreferrer" style={linkButtonStyle}>WIKIPEDIA ↗</a>}
                                </div>
                                {airport.latitude != null && airport.longitude != null && <button type="button" onClick={focusAirport} style={focusButtonStyle}>FOCUS ON MAP →</button>}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

function RunwayRow({ runway }: { runway: RunwayInfo }) {
    const lengthM = runway.lengthFt != null ? Math.round(runway.lengthFt * 0.3048) : null;
    const widthM = runway.widthFt != null ? Math.round(runway.widthFt * 0.3048) : null;
    const designation = [runway.leIdent, runway.heIdent].filter(Boolean).join(" / ") || "RUNWAY";
    return (
        <div style={runwayRowStyle}>
            <div style={{ minWidth: 78 }}><strong style={{ display: "block", color: "#63ffe3", fontSize: 13 }}>{designation}</strong><small style={{ color: "rgba(255,255,255,0.34)", fontSize: 8 }}>{runway.surface ?? "Surface ---"}{runway.lighted ? " · LIGHTED" : ""}</small></div>
            <div style={{ textAlign: "right" }}><strong style={{ display: "block", color: "rgba(255,255,255,0.88)", fontSize: 10 }}>{runway.lengthFt != null ? `${runway.lengthFt.toLocaleString("de-CH")} ft · ${lengthM?.toLocaleString("de-CH")} m` : "Length ---"}</strong><small style={{ color: "rgba(255,255,255,0.34)", fontSize: 8 }}>{runway.widthFt != null ? `Width ${runway.widthFt} ft · ${widthM} m` : ""}</small></div>
        </div>
    );
}

function FrequencyRow({ frequency }: { frequency: FrequencyInfo }) {
    return (
        <div style={frequencyRowStyle}>
            <div><strong style={{ display: "block", color: "rgba(255,255,255,0.82)", fontSize: 9 }}>{frequency.type ?? "RADIO"}</strong><small style={{ color: "rgba(255,255,255,0.34)", fontSize: 8 }}>{frequency.description ?? ""}</small></div>
            <strong style={{ color: "#63ffe3", fontSize: 11, letterSpacing: "0.04em" }}>{frequency.frequencyMhz.toFixed(3)} MHz</strong>
        </div>
    );
}

function prioritizeFrequencies(items: FrequencyInfo[]) {
    const priority = ["ATIS", "TWR", "TOWER", "GND", "GROUND", "APP", "APPROACH", "DEP", "DEPARTURE", "DEL", "CLEARANCE"];
    return [...items].sort((a, b) => {
        const ai = priority.findIndex((key) => (a.type ?? "").toUpperCase().includes(key));
        const bi = priority.findIndex((key) => (b.type ?? "").toUpperCase().includes(key));
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
}

function AirportValue({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return <div><small style={{ display: "block", marginBottom: 4, color: "rgba(255,255,255,0.34)", fontSize: 8, letterSpacing: "0.12em" }}>{label}</small><span style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, lineHeight: 1.35 }}>{value}</span></div>;
}
function ServiceBadge({ active }: { active: boolean }) {
    return <span style={{ flexShrink: 0, border: `1px solid ${active ? "rgba(99,255,227,0.22)" : "rgba(255,255,255,0.08)"}`, borderRadius: 999, padding: "5px 8px", background: active ? "rgba(99,255,227,0.07)" : "rgba(255,255,255,0.03)", color: active ? "rgba(99,255,227,0.86)" : "rgba(255,255,255,0.38)", fontSize: 8, letterSpacing: "0.09em" }}>{active ? "SCHEDULED" : "NO SCHEDULED"}</span>;
}
function formatAirportType(value?: string | null) { if (!value) return null; return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

const panelStyle: React.CSSProperties = { width: "min(430px, calc(100vw - 36px))", maxHeight: "min(760px, calc(100vh - 90px))", overflowY: "auto", border: "1px solid rgba(99,255,227,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(99,255,227,0.68)", fontSize: 9, letterSpacing: "0.16em" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "13px 14px", marginTop: 18 };
const hintStyle: React.CSSProperties = { margin: "8px 0 0", color: "rgba(255,255,255,0.32)", fontSize: 9, lineHeight: 1.45 };
const errorStyle: React.CSSProperties = { marginTop: 12, padding: 10, borderRadius: 10, background: "rgba(255,90,90,0.08)", color: "rgba(255,150,150,0.9)", fontSize: 11 };
const buttonStyle: React.CSSProperties = { border: "1px solid rgba(99,255,227,0.22)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.90)", color: "rgba(99,255,227,0.92)", boxShadow: "0 10px 34px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const iconButtonStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const inputStyle: React.CSSProperties = { minWidth: 0, flex: 1, border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 11px", outline: "none", background: "rgba(255,255,255,0.04)", color: "white", fontSize: 11, textTransform: "uppercase" };
const searchButtonStyle: React.CSSProperties = { border: "1px solid rgba(99,255,227,0.20)", borderRadius: 10, padding: "0 12px", background: "rgba(99,255,227,0.08)", color: "rgba(99,255,227,0.9)", cursor: "pointer", fontSize: 9, letterSpacing: "0.10em" };
const focusButtonStyle: React.CSSProperties = { width: "100%", marginTop: 10, border: "1px solid rgba(99,255,227,0.24)", borderRadius: 10, padding: "10px 12px", background: "rgba(99,255,227,0.10)", color: "rgba(99,255,227,0.96)", cursor: "pointer", fontSize: 9, letterSpacing: "0.12em" };
const linkButtonStyle: React.CSSProperties = { display: "block", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 10px", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.66)", textAlign: "center", textDecoration: "none", fontSize: 8, letterSpacing: "0.09em" };
const opsSectionStyle: React.CSSProperties = { marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" };
const opsHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 };
const opsEyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(99,255,227,0.56)", fontSize: 8, letterSpacing: "0.13em" };
const opsTitleStyle: React.CSSProperties = { color: "rgba(255,255,255,0.9)", fontSize: 12 };
const countBadgeStyle: React.CSSProperties = { border: "1px solid rgba(99,255,227,0.14)", borderRadius: 999, padding: "4px 7px", color: "rgba(99,255,227,0.72)", fontSize: 8 };
const runwayRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 10px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, background: "rgba(255,255,255,0.025)" };
const frequencyRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 9, background: "rgba(255,255,255,0.022)" };
