"use client";

import { useEffect, useMemo, useState } from "react";

type FocusDetail = { code?: string; name?: string };
type RunwayRecord = { id?: string | null; leIdent?: string | null; leHeading?: number | null; heIdent?: string | null; heHeading?: number | null };
type AirportLookup = { found?: boolean; icao?: string | null; runways?: RunwayRecord[] };
type WeatherInfo = { found: boolean; icao?: string; source?: string; raw?: string | null; observedAt?: string | number | null; temperatureC?: number | null; dewpointC?: number | null; windDirectionDeg?: number | null; windSpeedKt?: number | null; windGustKt?: number | null; visibilitySm?: number | null; altimeterHpa?: number | null; flightCategory?: string | null; weather?: string | null };
type RunwayWind = { ident: string; heading: number; headwind: number; crosswind: number };

export default function AirportWeather() {
    const [airport, setAirport] = useState<FocusDetail | null>(null);
    const [icao, setIcao] = useState<string | null>(null);
    const [weather, setWeather] = useState<WeatherInfo | null>(null);
    const [runways, setRunways] = useState<RunwayRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const onFocus = (event: Event) => {
            const detail = (event as CustomEvent<FocusDetail>).detail;
            if (!detail?.code) return;
            setAirport(detail);
            void resolveAndLoad(detail.code);
        };
        window.addEventListener("luma:airport-focus", onFocus);
        return () => window.removeEventListener("luma:airport-focus", onFocus);
    }, []);

    async function resolveAndLoad(code: string) {
        setLoading(true); setError(""); setWeather(null); setRunways([]);
        try {
            let airportIcao = code.trim().toUpperCase();
            const airportResponse = await fetch(`/api/radar/airport?code=${encodeURIComponent(airportIcao)}`, { cache: "no-store" });
            const airportData = (await airportResponse.json()) as AirportLookup;
            if (airportData.found) setRunways(Array.isArray(airportData.runways) ? airportData.runways : []);
            if (airportIcao.length === 3) airportIcao = airportData.icao?.trim().toUpperCase() ?? "";
            if (!/^[A-Z0-9]{4}$/.test(airportIcao)) { setIcao(null); setError("No ICAO weather station available for this airport."); return; }
            setIcao(airportIcao);
            const response = await fetch(`/api/radar/weather?icao=${encodeURIComponent(airportIcao)}`, { cache: "no-store" });
            const data = (await response.json()) as WeatherInfo & { error?: string };
            if (!response.ok) { setError(data.error ?? "METAR lookup failed."); return; }
            if (!data.found) { setError("No current METAR available for this airport."); return; }
            setWeather(data);
        } catch { setError("METAR lookup failed."); } finally { setLoading(false); }
    }

    const runwayWind = useMemo(() => calculateRunwayWind(runways, weather), [runways, weather]);
    if (!airport) return null;

    return (
        <div style={{ position: "fixed", right: 18, top: 138, zIndex: 1494, fontFamily: "inherit" }}>
            <section style={panelStyle}>
                <div style={headerStyle}>
                    <div><small style={eyebrowStyle}>AIRPORT WEATHER</small><strong style={titleStyle}>{icao ?? airport.code ?? "AIRPORT"} · METAR</strong><div style={subTitleStyle}>{airport.name ?? "Focused airport"}</div></div>
                    <button type="button" onClick={() => setAirport(null)} style={closeStyle} aria-label="Airport Weather schließen">×</button>
                </div>
                <div style={{ padding: 12 }}>
                    {loading && <div style={stateStyle}>Loading current METAR…</div>}
                    {error && !loading && <div style={errorStyle}>{error}</div>}
                    {weather && !loading && <>
                        <div style={categoryRowStyle}><FlightCategory category={weather.flightCategory} /><span style={observedStyle}>{formatObserved(weather.observedAt)}</span></div>
                        <div style={gridStyle}>
                            <WeatherValue label="WIND" value={formatWind(weather)} /><WeatherValue label="VISIBILITY" value={weather.visibilitySm != null ? `${weather.visibilitySm} SM` : "---"} />
                            <WeatherValue label="TEMP" value={weather.temperatureC != null ? `${weather.temperatureC} °C` : "---"} /><WeatherValue label="DEWPOINT" value={weather.dewpointC != null ? `${weather.dewpointC} °C` : "---"} />
                            <WeatherValue label="QNH" value={weather.altimeterHpa != null ? `${weather.altimeterHpa} hPa` : "---"} /><WeatherValue label="WEATHER" value={weather.weather || "None reported"} />
                        </div>
                        <RunwayWindIntelligence values={runwayWind} variable={weather.windDirectionDeg == null} />
                        {weather.raw && <div style={rawStyle}><small style={rawLabelStyle}>RAW METAR</small><code style={codeStyle}>{weather.raw}</code></div>}
                        <div style={sourceStyle}>Source: {weather.source ?? "AviationWeather.gov"} · runway recommendation is wind-only and not an official ATC runway assignment</div>
                    </>}
                </div>
            </section>
        </div>
    );
}

function RunwayWindIntelligence({ values, variable }: { values: RunwayWind[]; variable: boolean }) {
    if (variable) return <div style={runwayBoxStyle}><small style={rawLabelStyle}>RUNWAY WIND INTELLIGENCE</small><div style={runwayNoticeStyle}>Variable/calm wind: no reliable wind-only runway recommendation.</div></div>;
    if (!values.length) return null;
    const best = values[0];
    return <div style={runwayBoxStyle}>
        <div style={runwayTitleRowStyle}><div><small style={rawLabelStyle}>RUNWAY WIND INTELLIGENCE</small><strong style={runwayBestStyle}>RWY {best.ident}</strong></div><span style={estimateStyle}>WIND BEST</span></div>
        <div style={windGridStyle}><WindComponent label="HEADWIND" value={best.headwind} /><WindComponent label="CROSSWIND" value={Math.abs(best.crosswind)} /><WindComponent label="TAILWIND" value={Math.max(0, -best.headwind)} /></div>
        {values.slice(1, 4).map((item) => <div key={`${item.ident}-${item.heading}`} style={runwayRowStyle}><span>RWY {item.ident} · {Math.round(item.heading).toString().padStart(3, "0")}°</span><span>{componentLabel(item)}</span></div>)}
        <div style={runwayNoticeStyle}>Meteorological estimate only. ATC, noise abatement, runway availability, procedures and traffic can result in another runway being active.</div>
    </div>;
}

function WindComponent({ label, value }: { label: string; value: number }) { return <div style={windComponentStyle}><small style={valueLabelStyle}>{label}</small><strong style={valueStyle}>{Math.round(Math.abs(value))} kt</strong></div>; }
function calculateRunwayWind(runways: RunwayRecord[], weather: WeatherInfo | null): RunwayWind[] {
    if (!weather || weather.windDirectionDeg == null || weather.windSpeedKt == null || weather.windSpeedKt < 1) return [];
    const directions: RunwayWind[] = [];
    for (const runway of runways) {
        for (const end of [{ ident: runway.leIdent, heading: runway.leHeading }, { ident: runway.heIdent, heading: runway.heHeading }]) {
            if (!end.ident || end.heading == null || !Number.isFinite(end.heading)) continue;
            const angle = ((((weather.windDirectionDeg - end.heading) + 540) % 360) - 180) * Math.PI / 180;
            directions.push({ ident: end.ident, heading: end.heading, headwind: weather.windSpeedKt * Math.cos(angle), crosswind: weather.windSpeedKt * Math.sin(angle) });
        }
    }
    return directions.sort((a, b) => b.headwind - a.headwind || Math.abs(a.crosswind) - Math.abs(b.crosswind));
}
function componentLabel(item: RunwayWind) { const h = Math.round(item.headwind); const x = Math.round(Math.abs(item.crosswind)); return `${h >= 0 ? `H ${h}` : `T ${Math.abs(h)}`} · X ${x} kt`; }
function WeatherValue({ label, value }: { label: string; value: string }) { return <div style={valueBoxStyle}><small style={valueLabelStyle}>{label}</small><strong style={valueStyle}>{value}</strong></div>; }
function FlightCategory({ category }: { category?: string | null }) { const text = category ?? "UNKNOWN"; const color = text === "VFR" ? "#63ffe3" : text === "MVFR" ? "#4ebbff" : text === "IFR" ? "#ff8fd8" : text === "LIFR" ? "#ff7474" : "rgba(255,255,255,0.45)"; return <span style={{ ...categoryStyle, color, borderColor: `${color}55`, background: `${color}10` }}>{text}</span>; }
function formatWind(weather: WeatherInfo) { if (weather.windSpeedKt == null) return "CALM / ---"; const direction = weather.windDirectionDeg == null ? "VRB" : `${Math.round(weather.windDirectionDeg).toString().padStart(3, "0")}°`; const gust = weather.windGustKt != null ? ` G${Math.round(weather.windGustKt)}` : ""; return `${direction} ${Math.round(weather.windSpeedKt)} kt${gust}`; }
function formatObserved(value?: string | number | null) { if (value == null) return "---"; const date = typeof value === "number" ? new Date(value > 10_000_000_000 ? value : value * 1000) : new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }); }

const panelStyle: React.CSSProperties = { width: "min(370px, calc(100vw - 36px))", maxHeight: "min(720px, calc(100vh - 100px))", overflowY: "auto", border: "1px solid rgba(78,187,255,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "13px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(78,187,255,0.72)", fontSize: 8, letterSpacing: "0.15em" };
const titleStyle: React.CSSProperties = { display: "block", color: "rgba(255,255,255,0.94)", fontSize: 14 };
const subTitleStyle: React.CSSProperties = { marginTop: 3, color: "rgba(255,255,255,0.34)", fontSize: 8 };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const categoryRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 };
const categoryStyle: React.CSSProperties = { border: "1px solid", borderRadius: 999, padding: "5px 8px", fontSize: 8, letterSpacing: "0.10em" };
const observedStyle: React.CSSProperties = { color: "rgba(255,255,255,0.32)", fontSize: 8 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 };
const valueBoxStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "8px 9px", background: "rgba(255,255,255,0.025)" };
const valueLabelStyle: React.CSSProperties = { display: "block", marginBottom: 4, color: "rgba(255,255,255,0.30)", fontSize: 7, letterSpacing: "0.12em" };
const valueStyle: React.CSSProperties = { color: "rgba(255,255,255,0.82)", fontSize: 9, fontWeight: 600 };
const runwayBoxStyle: React.CSSProperties = { marginTop: 10, padding: "10px", border: "1px solid rgba(99,255,227,0.13)", borderRadius: 10, background: "rgba(99,255,227,0.025)" };
const runwayTitleRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 };
const runwayBestStyle: React.CSSProperties = { display: "block", color: "#63ffe3", fontSize: 15 };
const estimateStyle: React.CSSProperties = { padding: "4px 6px", borderRadius: 999, border: "1px solid rgba(99,255,227,0.18)", color: "rgba(99,255,227,0.72)", fontSize: 7, letterSpacing: "0.08em" };
const windGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, marginBottom: 7 };
const windComponentStyle: React.CSSProperties = { padding: "7px", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" };
const runwayRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 2px", borderTop: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontSize: 8 };
const runwayNoticeStyle: React.CSSProperties = { marginTop: 7, color: "rgba(255,210,130,0.44)", fontSize: 7, lineHeight: 1.4 };
const rawStyle: React.CSSProperties = { marginTop: 10, padding: "9px 10px", border: "1px solid rgba(78,187,255,0.10)", borderRadius: 9, background: "rgba(78,187,255,0.035)" };
const rawLabelStyle: React.CSSProperties = { display: "block", marginBottom: 5, color: "rgba(78,187,255,0.55)", fontSize: 7, letterSpacing: "0.12em" };
const codeStyle: React.CSSProperties = { display: "block", color: "rgba(255,255,255,0.68)", fontSize: 8, lineHeight: 1.5, whiteSpace: "normal" };
const sourceStyle: React.CSSProperties = { marginTop: 10, color: "rgba(255,255,255,0.22)", fontSize: 7, lineHeight: 1.4 };
const stateStyle: React.CSSProperties = { color: "rgba(255,255,255,0.42)", fontSize: 9 };
const errorStyle: React.CSSProperties = { padding: "9px 10px", borderRadius: 9, background: "rgba(255,100,100,0.06)", border: "1px solid rgba(255,100,100,0.10)", color: "rgba(255,155,155,0.8)", fontSize: 8 };
