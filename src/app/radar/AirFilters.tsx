"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Aircraft = {
    icao24: string;
    callsign: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    onGround: boolean;
    verticalRate: number | null;
};

type RadarResponse = { aircraft?: Aircraft[] };
type StatusFilter = "ALL" | "AIRBORNE" | "GROUND";
type PhaseFilter = "ALL" | "CLIMB" | "CRUISE" | "DESCENT" | "APPROACH" | "GROUND";
type AltitudeFilter = "ALL" | "LOW" | "MID" | "HIGH" | "VERY_HIGH";
type CategoryFilter = "ALL" | "PASSENGER" | "CARGO" | "HELICOPTER" | "MILITARY" | "PRIVATE";

type AirportFilter = { code: string; name: string; latitude: number; longitude: number };
type AirportLookup = "IDLE" | "LOADING" | "FOUND" | "NOT_FOUND";

type FilterState = {
    airline: string;
    status: StatusFilter;
    phase: PhaseFilter;
    altitude: AltitudeFilter;
    category: CategoryFilter;
    airport: AirportFilter | null;
    radiusKm: number;
};

type AirframeMeta = {
    categoryDescription?: string | null;
    operator?: string | null;
    owner?: string | null;
    model?: string | null;
    icaoAircraftType?: string | null;
};

declare global { interface Window { __lumaRadarMap?: any; } }

const DEFAULT_FILTERS: FilterState = { airline: "", status: "ALL", phase: "ALL", altitude: "ALL", category: "ALL", airport: null, radiusKm: 25 };
const metaCache = new Map<string, AirframeMeta | null>();

export default function AirFilters() {
    const [open, setOpen] = useState(false);
    const [airline, setAirline] = useState("");
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const [phase, setPhase] = useState<PhaseFilter>("ALL");
    const [altitude, setAltitude] = useState<AltitudeFilter>("ALL");
    const [category, setCategory] = useState<CategoryFilter>("ALL");
    const [airportCode, setAirportCode] = useState("");
    const [airport, setAirport] = useState<AirportFilter | null>(null);
    const [airportLookup, setAirportLookup] = useState<AirportLookup>("IDLE");
    const [radiusKm, setRadiusKm] = useState(25);
    const [visibleCount, setVisibleCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const aircraftRef = useRef<Aircraft[]>([]);
    const filtersRef = useRef<FilterState>(DEFAULT_FILTERS);
    const airportTimer = useRef<number | null>(null);
    const airportLookupId = useRef(0);

    const filtersActive = useMemo(() => airline.trim() !== "" || status !== "ALL" || phase !== "ALL" || altitude !== "ALL" || category !== "ALL" || airport !== null, [airline, status, phase, altitude, category, airport]);

    useEffect(() => {
        filtersRef.current = { airline, status, phase, altitude, category, airport, radiusKm };
        if (category !== "ALL") void warmCategoryMetadata(aircraftRef.current).then(applyFilters);
        applyFilters();
    }, [airline, status, phase, altitude, category, airport, radiusKm]);

    function changeAirportCode(value: string) {
        const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
        setAirportCode(code);
        if (airportTimer.current) window.clearTimeout(airportTimer.current);
        const lookup = ++airportLookupId.current;
        if (code.length < 3) { setAirport(null); setAirportLookup("IDLE"); return; }
        setAirportLookup("LOADING");
        airportTimer.current = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/radar/airport?code=${encodeURIComponent(code)}`);
                const data = response.ok ? await response.json() : null;
                if (lookup !== airportLookupId.current) return;
                if (data?.found && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
                    setAirport({ code: data.icao ?? data.ident ?? code, name: data.name ?? code, latitude: data.latitude, longitude: data.longitude });
                    setAirportLookup("FOUND");
                } else { setAirport(null); setAirportLookup("NOT_FOUND"); }
            } catch { if (lookup === airportLookupId.current) { setAirport(null); setAirportLookup("NOT_FOUND"); } }
        }, 450);
    }

    useEffect(() => {
        let active = true;
        async function load() {
            try {
                const response = await fetch("/api/radar", { cache: "no-store" });
                if (!response.ok) return;
                const data = (await response.json()) as RadarResponse;
                if (!active) return;
                aircraftRef.current = Array.isArray(data.aircraft) ? data.aircraft : [];
                setTotalCount(aircraftRef.current.length);
                if (filtersRef.current.category !== "ALL") await warmCategoryMetadata(aircraftRef.current);
                applyFilters();
            } catch {}
        }
        load();
        const timer = window.setInterval(load, 5000);
        const repaint = window.setInterval(applyFilters, 1200);
        return () => { active = false; window.clearInterval(timer); window.clearInterval(repaint); showAllMarkers(); };
    }, []);

    useEffect(() => {
        const footer = document.querySelector(".radar-footer");
        if (!footer) return;
        const spans = footer.querySelectorAll("span");
        if (spans[0]) spans[0].textContent = "LuMa Labs · Worldwide Airspace";
        if (spans[1]) spans[1].textContent = "GLOBAL AIR · AIRPORTS · LIVE TRACKING";
    }, []);

    function applyFilters() {
        const map = window.__lumaRadarMap;
        if (!map) return;
        // Inklusive weltweiter Flugzeuge aus /api/radar/area (NEX-8).
        const snapshot = [...aircraftRef.current, ...(window.__lumaRadarAreaAircraft ?? [])];
        const current = filtersRef.current;
        const activeFilters = current.airline.trim() !== "" || current.status !== "ALL" || current.phase !== "ALL" || current.altitude !== "ALL" || current.category !== "ALL" || current.airport !== null;
        let shown = 0;

        map.eachLayer((layer: any) => {
            const element = layer?.getElement?.() as HTMLElement | undefined;
            if (!element?.classList?.contains("plane-icon-wrapper")) return;
            const latLng = layer?.getLatLng?.();
            if (!latLng) return;
            const aircraft = nearestAircraft(snapshot, latLng.lat, latLng.lng);
            if (!aircraft) { element.style.display = activeFilters ? "none" : ""; return; }
            const visible = matchesAircraft(aircraft, current);
            element.style.display = visible ? "" : "none";
            if (visible) shown++;
        });
        setVisibleCount(shown);
    }

    function resetFilters() {
        filtersRef.current = DEFAULT_FILTERS;
        setAirline(""); setStatus("ALL"); setPhase("ALL"); setAltitude("ALL"); setCategory("ALL"); changeAirportCode(""); setRadiusKm(25);
        window.setTimeout(applyFilters, 0);
    }

    return (
        <div style={{ position: "fixed", left: 18, bottom: 102, zIndex: 1490, fontFamily: "inherit" }}>
            {!open ? <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>◇ FILTERS{filtersActive ? ` · ${visibleCount}` : ""}</button> : (
                <section style={panelStyle}>
                    <div style={headerStyle}><div><small style={eyebrowStyle}>AIR MODE</small><strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>Live Air Filters</strong></div><button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button></div>
                    <div style={{ padding: 14 }}>
                        <div style={counterStyle}><span>VISIBLE</span><strong>{filtersActive ? visibleCount : totalCount}</strong><small>of {totalCount} tracked</small></div>
                        <label style={labelStyle}>AIRLINE / CALLSIGN PREFIX</label>
                        <input value={airline} onChange={(event) => setAirline(event.target.value.toUpperCase())} placeholder="SWR / SWISS / DLH / UAE..." style={inputStyle} />
                        <div style={gridStyle}>
                            <div style={{ minWidth: 0 }}><label style={labelStyle}>AIRPORT (ICAO / IATA)</label><input value={airportCode} onChange={(event) => changeAirportCode(event.target.value)} placeholder="LSZH / ZRH" style={inputStyle} /></div>
                            <FilterSelect label="RADIUS" value={String(radiusKm)} onChange={(value) => setRadiusKm(Number(value))} options={[["10","10 km"],["25","25 km"],["50","50 km"],["100","100 km"]]} />
                        </div>
                        {airportLookup !== "IDLE" && <p style={categoryHintStyle}>{airportLookup === "LOADING" ? "Searching airport…" : airportLookup === "FOUND" && airport ? `${airport.code} · ${airport.name} · within ${radiusKm} km` : "Airport not found."}</p>}
                        <div style={gridStyle}>
                            <FilterSelect label="STATUS" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[["ALL","All"],["AIRBORNE","Airborne"],["GROUND","Ground"]]} />
                            <FilterSelect label="PHASE" value={phase} onChange={(value) => setPhase(value as PhaseFilter)} options={[["ALL","All phases"],["CLIMB","Climb"],["CRUISE","Cruise"],["DESCENT","Descent"],["APPROACH","Approach"],["GROUND","Ground"]]} />
                        </div>
                        <div style={gridStyle}>
                            <FilterSelect label="ALTITUDE" value={altitude} onChange={(value) => setAltitude(value as AltitudeFilter)} options={[["ALL","All altitudes"],["LOW","Below 10,000 ft"],["MID","10,000 – 20,000 ft"],["HIGH","20,000 – 30,000 ft"],["VERY_HIGH","30,000 ft+"]]} />
                            <FilterSelect label="AIRCRAFT CATEGORY" value={category} onChange={(value) => setCategory(value as CategoryFilter)} options={[["ALL","All aircraft"],["PASSENGER","Passenger"],["CARGO","Cargo"],["HELICOPTER","Helicopter"],["MILITARY","Military"],["PRIVATE","Private / Business"]]} />
                        </div>
                        {category !== "ALL" && <p style={categoryHintStyle}>Category uses local OpenSky aircraft metadata. Unknown aircraft are hidden.</p>}
                        <button type="button" onClick={resetFilters} disabled={!filtersActive} style={{ ...resetStyle, opacity: filtersActive ? 1 : 0.35 }}>RESET FILTERS</button>
                    </div>
                </section>
            )}
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string,string][] }) {
    return <div style={{ minWidth: 0 }}><label style={labelStyle}>{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>{options.map(([key,text]) => <option key={key} value={key}>{text}</option>)}</select></div>;
}

async function warmCategoryMetadata(aircraft: Aircraft[]) {
    const missing = aircraft.filter((item) => item.icao24 && !metaCache.has(item.icao24.toLowerCase())).slice(0, 80);
    await Promise.allSettled(missing.map(async (item) => {
        const key = item.icao24.toLowerCase();
        try {
            const response = await fetch(`/api/radar/airframe?icao24=${encodeURIComponent(key)}`, { cache: "force-cache" });
            if (!response.ok) { metaCache.set(key, null); return; }
            const data = await response.json();
            metaCache.set(key, data.found ? data as AirframeMeta : null);
        } catch { metaCache.set(key, null); }
    }));
}

function nearestAircraft(aircraft: Aircraft[], latitude: number, longitude: number) {
    let best: Aircraft | null = null; let bestScore = 0.02 * 0.02;
    for (const item of aircraft) { const dy = item.latitude - latitude; const dx = item.longitude - longitude; const score = dy * dy + dx * dx; if (score < bestScore) { bestScore = score; best = item; } }
    return best;
}

function matchesAircraft(aircraft: Aircraft, filters: FilterState) {
    const callsign = aircraft.callsign?.trim().toUpperCase() ?? "";
    const airlineQuery = filters.airline.trim().toUpperCase();
    if (airlineQuery && !callsign.includes(airlineQuery) && !airlineName(callsign).toUpperCase().includes(airlineQuery)) return false;
    if (filters.status === "GROUND" && !aircraft.onGround) return false;
    if (filters.status === "AIRBORNE" && aircraft.onGround) return false;
    const altitudeFt = aircraft.altitude == null ? null : aircraft.altitude * 3.28084;
    if (!matchesAltitude(altitudeFt, filters.altitude)) return false;
    if (filters.phase !== "ALL" && flightPhase(aircraft) !== filters.phase) return false;
    if (filters.category !== "ALL" && !matchesCategory(aircraft, filters.category)) return false;
    if (filters.airport && distanceKm(aircraft.latitude, aircraft.longitude, filters.airport.latitude, filters.airport.longitude) > filters.radiusKm) return false;
    return true;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesCategory(aircraft: Aircraft, category: CategoryFilter) {
    if (category === "ALL") return true;
    const meta = metaCache.get(aircraft.icao24.toLowerCase());
    if (!meta) return false;
    const text = [meta.categoryDescription, meta.operator, meta.owner, meta.model, meta.icaoAircraftType].filter(Boolean).join(" ").toUpperCase();
    const callsign = aircraft.callsign?.toUpperCase() ?? "";
    if (category === "HELICOPTER") return /^[HGT]/.test(meta.icaoAircraftType ?? "") || /HELICOPTER|ROTORCRAFT|ROTOR|HELI/.test(text);
    if (category === "MILITARY") return /MILITARY|AIR FORCE|ARMY|NAVY|GOVERNMENT/.test(text);
    if (category === "CARGO") return /CARGO|FREIGHT|EXPRESS|FEDEX|UPS|DHL/.test(`${text} ${callsign}`);
    if (category === "PRIVATE") return /PRIVATE|BUSINESS|CORPORATE|EXECUTIVE|JET/.test(text) && !/AIRLINES|AIRWAYS|CARGO/.test(text);
    return /AIRLINE|AIRLINES|AIRWAYS|PASSENGER/.test(text) || /^(SWR|DLH|EJU|EZS|RYR|AFR|BAW|KLM|UAE|QTR|THY|AUA|BEL|ITY|VLG|WZZ|SAS|TAP|IBE)/.test(callsign);
}

function matchesAltitude(feet: number | null, filter: AltitudeFilter) { if (filter === "ALL") return true; if (feet == null) return false; if (filter === "LOW") return feet < 10000; if (filter === "MID") return feet >= 10000 && feet < 20000; if (filter === "HIGH") return feet >= 20000 && feet < 30000; return feet >= 30000; }
function flightPhase(aircraft: Aircraft): Exclude<PhaseFilter,"ALL"> { if (aircraft.onGround) return "GROUND"; const altitudeFt = (aircraft.altitude ?? 0) * 3.28084; const verticalFpm = (aircraft.verticalRate ?? 0) * 196.85; if (altitudeFt < 6000 && verticalFpm < -250) return "APPROACH"; if (verticalFpm > 300) return "CLIMB"; if (verticalFpm < -300) return "DESCENT"; return "CRUISE"; }
function airlineName(callsign: string) { const prefix = callsign.slice(0,3); const map: Record<string,string> = { SWR:"SWISS",DLH:"Lufthansa",EJU:"easyJet Europe",EZS:"easyJet Switzerland",RYR:"Ryanair",AFR:"Air France",BAW:"British Airways",KLM:"KLM",UAE:"Emirates",QTR:"Qatar Airways",THY:"Turkish Airlines",AUA:"Austrian Airlines",BEL:"Brussels Airlines",ITY:"ITA Airways",VLG:"Vueling",WZZ:"Wizz Air",SAS:"SAS",TAP:"TAP Air Portugal",IBE:"Iberia" }; return map[prefix] ?? prefix; }
function showAllMarkers() { document.querySelectorAll<HTMLElement>(".plane-icon-wrapper").forEach((element) => { element.style.display = ""; }); }

const triggerStyle: React.CSSProperties = { border:"1px solid rgba(184,140,255,0.24)",borderRadius:999,padding:"10px 14px",background:"rgba(5,17,20,0.90)",color:"rgba(202,177,255,0.94)",boxShadow:"0 10px 34px rgba(0,0,0,0.28)",cursor:"pointer",fontSize:10,letterSpacing:"0.12em" };
const panelStyle: React.CSSProperties = { width:"min(380px, calc(100vw - 36px))",border:"1px solid rgba(184,140,255,0.22)",borderRadius:16,background:"rgba(5,17,20,0.96)",boxShadow:"0 22px 60px rgba(0,0,0,0.42)",overflow:"hidden",backdropFilter:"blur(14px)" };
const headerStyle: React.CSSProperties = { display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"14px 14px 10px",borderBottom:"1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display:"block",color:"rgba(184,140,255,0.72)",fontSize:9,letterSpacing:"0.16em" };
const closeStyle: React.CSSProperties = { width:30,height:30,border:"1px solid rgba(255,255,255,0.08)",borderRadius:999,background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:18 };
const counterStyle: React.CSSProperties = { display:"grid",gridTemplateColumns:"auto auto 1fr",alignItems:"baseline",gap:8,marginBottom:16,padding:"10px 11px",borderRadius:10,background:"rgba(184,140,255,0.06)",color:"rgba(255,255,255,0.48)",fontSize:8,letterSpacing:"0.1em" };
const labelStyle: React.CSSProperties = { display:"block",marginBottom:5,color:"rgba(255,255,255,0.34)",fontSize:8,letterSpacing:"0.12em" };
const inputStyle: React.CSSProperties = { width:"100%",boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"9px 10px",outline:"none",background:"rgba(255,255,255,0.04)",color:"white",fontSize:10,textTransform:"uppercase",marginBottom:13 };
const selectStyle: React.CSSProperties = { width:"100%",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"9px 9px",outline:"none",background:"#0a171a",color:"rgba(255,255,255,0.86)",fontSize:10,marginBottom:13 };
const gridStyle: React.CSSProperties = { display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 };
const categoryHintStyle: React.CSSProperties = { margin:"-2px 0 11px",color:"rgba(255,255,255,0.30)",fontSize:8,lineHeight:1.45 };
const resetStyle: React.CSSProperties = { width:"100%",marginTop:2,border:"1px solid rgba(184,140,255,0.20)",borderRadius:10,padding:"9px 10px",background:"rgba(184,140,255,0.07)",color:"rgba(202,177,255,0.9)",cursor:"pointer",fontSize:8,letterSpacing:"0.11em" };
