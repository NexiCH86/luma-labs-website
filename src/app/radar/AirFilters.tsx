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

type RadarResponse = {
    aircraft?: Aircraft[];
};

type StatusFilter = "ALL" | "AIRBORNE" | "GROUND";
type PhaseFilter = "ALL" | "CLIMB" | "CRUISE" | "DESCENT" | "APPROACH" | "GROUND";
type AltitudeFilter = "ALL" | "LOW" | "MID" | "HIGH" | "VERY_HIGH";

type FilterState = {
    airline: string;
    status: StatusFilter;
    phase: PhaseFilter;
    altitude: AltitudeFilter;
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

const DEFAULT_FILTERS: FilterState = {
    airline: "",
    status: "ALL",
    phase: "ALL",
    altitude: "ALL",
};

export default function AirFilters() {
    const [open, setOpen] = useState(false);
    const [airline, setAirline] = useState("");
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const [phase, setPhase] = useState<PhaseFilter>("ALL");
    const [altitude, setAltitude] = useState<AltitudeFilter>("ALL");
    const [visibleCount, setVisibleCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const aircraftRef = useRef<Aircraft[]>([]);
    const filtersRef = useRef<FilterState>(DEFAULT_FILTERS);

    const filtersActive = useMemo(
        () => airline.trim() !== "" || status !== "ALL" || phase !== "ALL" || altitude !== "ALL",
        [airline, status, phase, altitude]
    );

    useEffect(() => {
        filtersRef.current = {
            airline,
            status,
            phase,
            altitude,
        };

        applyFilters();
    }, [airline, status, phase, altitude]);

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
                applyFilters();
            } catch {
                // RadarClient retries independently; filters keep their latest snapshot.
            }
        }

        load();
        const timer = window.setInterval(load, 5000);
        const repaint = window.setInterval(applyFilters, 1200);

        return () => {
            active = false;
            window.clearInterval(timer);
            window.clearInterval(repaint);
            showAllMarkers();
        };
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

        const snapshot = aircraftRef.current;
        const currentFilters = filtersRef.current;
        const activeFilters =
            currentFilters.airline.trim() !== "" ||
            currentFilters.status !== "ALL" ||
            currentFilters.phase !== "ALL" ||
            currentFilters.altitude !== "ALL";

        let shown = 0;

        map.eachLayer((layer: any) => {
            const element = layer?.getElement?.() as HTMLElement | undefined;
            if (!element?.classList?.contains("plane-icon-wrapper")) return;

            const latLng = layer?.getLatLng?.();
            if (!latLng) return;

            const aircraft = nearestAircraft(snapshot, latLng.lat, latLng.lng);

            if (!aircraft) {
                element.style.display = activeFilters ? "none" : "";
                return;
            }

            const visible = matchesAircraft(aircraft, currentFilters);
            element.style.display = visible ? "" : "none";

            if (visible) shown++;
        });

        setVisibleCount(shown);
    }

    function resetFilters() {
        filtersRef.current = DEFAULT_FILTERS;
        setAirline("");
        setStatus("ALL");
        setPhase("ALL");
        setAltitude("ALL");
        window.setTimeout(applyFilters, 0);
    }

    return (
        <div style={{ position: "fixed", left: 18, bottom: 102, zIndex: 1490, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
                    ◇ FILTERS{filtersActive ? ` · ${visibleCount}` : ""}
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>AIR MODE</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>Live Air Filters</strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <div style={counterStyle}>
                            <span>VISIBLE</span>
                            <strong>{filtersActive ? visibleCount : totalCount}</strong>
                            <small>of {totalCount} tracked</small>
                        </div>

                        <label style={labelStyle}>AIRLINE / CALLSIGN PREFIX</label>
                        <input
                            value={airline}
                            onChange={(event) => setAirline(event.target.value.toUpperCase())}
                            placeholder="SWR / SWISS / DLH / UAE..."
                            style={inputStyle}
                        />

                        <div style={gridStyle}>
                            <FilterSelect label="STATUS" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[
                                ["ALL", "All"], ["AIRBORNE", "Airborne"], ["GROUND", "Ground"]
                            ]} />
                            <FilterSelect label="PHASE" value={phase} onChange={(value) => setPhase(value as PhaseFilter)} options={[
                                ["ALL", "All phases"], ["CLIMB", "Climb"], ["CRUISE", "Cruise"], ["DESCENT", "Descent"], ["APPROACH", "Approach"], ["GROUND", "Ground"]
                            ]} />
                        </div>

                        <FilterSelect label="ALTITUDE" value={altitude} onChange={(value) => setAltitude(value as AltitudeFilter)} options={[
                            ["ALL", "All altitudes"], ["LOW", "Below 10,000 ft"], ["MID", "10,000 – 20,000 ft"], ["HIGH", "20,000 – 30,000 ft"], ["VERY_HIGH", "30,000 ft+"]
                        ]} />

                        <button type="button" onClick={resetFilters} disabled={!filtersActive} style={{ ...resetStyle, opacity: filtersActive ? 1 : 0.35 }}>
                            RESET FILTERS
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: [string, string][];
}) {
    return (
        <div style={{ minWidth: 0 }}>
            <label style={labelStyle}>{label}</label>
            <select value={value} onChange={(event) => onChange(event.target.value)} style={selectStyle}>
                {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </select>
        </div>
    );
}

function nearestAircraft(aircraft: Aircraft[], latitude: number, longitude: number) {
    let best: Aircraft | null = null;
    let bestScore = 0.02 * 0.02;

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

function matchesAircraft(aircraft: Aircraft, filters: FilterState) {
    const callsign = aircraft.callsign?.trim().toUpperCase() ?? "";
    const airlineQuery = filters.airline.trim().toUpperCase();

    if (
        airlineQuery &&
        !callsign.includes(airlineQuery) &&
        !airlineName(callsign).toUpperCase().includes(airlineQuery)
    ) {
        return false;
    }

    if (filters.status === "GROUND" && !aircraft.onGround) return false;
    if (filters.status === "AIRBORNE" && aircraft.onGround) return false;

    const altitudeFt = aircraft.altitude == null ? null : aircraft.altitude * 3.28084;
    if (!matchesAltitude(altitudeFt, filters.altitude)) return false;

    if (filters.phase !== "ALL" && flightPhase(aircraft) !== filters.phase) return false;

    return true;
}

function matchesAltitude(feet: number | null, filter: AltitudeFilter) {
    if (filter === "ALL") return true;
    if (feet == null) return false;
    if (filter === "LOW") return feet < 10000;
    if (filter === "MID") return feet >= 10000 && feet < 20000;
    if (filter === "HIGH") return feet >= 20000 && feet < 30000;
    return feet >= 30000;
}

function flightPhase(aircraft: Aircraft): Exclude<PhaseFilter, "ALL"> {
    if (aircraft.onGround) return "GROUND";

    const altitudeFt = (aircraft.altitude ?? 0) * 3.28084;
    const verticalFpm = (aircraft.verticalRate ?? 0) * 196.85;

    if (altitudeFt < 6000 && verticalFpm < -250) return "APPROACH";
    if (verticalFpm > 300) return "CLIMB";
    if (verticalFpm < -300) return "DESCENT";
    return "CRUISE";
}

function airlineName(callsign: string) {
    const prefix = callsign.slice(0, 3);
    const map: Record<string, string> = {
        SWR: "SWISS", DLH: "Lufthansa", EJU: "easyJet Europe", EZS: "easyJet Switzerland",
        RYR: "Ryanair", AFR: "Air France", BAW: "British Airways", KLM: "KLM",
        UAE: "Emirates", QTR: "Qatar Airways", THY: "Turkish Airlines", AUA: "Austrian Airlines",
        BEL: "Brussels Airlines", ITY: "ITA Airways", VLG: "Vueling", WZZ: "Wizz Air",
        SAS: "SAS", TAP: "TAP Air Portugal", IBE: "Iberia",
    };
    return map[prefix] ?? prefix;
}

function showAllMarkers() {
    document.querySelectorAll<HTMLElement>(".plane-icon-wrapper").forEach((element) => {
        element.style.display = "";
    });
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(184,140,255,0.24)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.90)", color: "rgba(202,177,255,0.94)", boxShadow: "0 10px 34px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const panelStyle: React.CSSProperties = { width: "min(350px, calc(100vw - 36px))", border: "1px solid rgba(184,140,255,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(184,140,255,0.72)", fontSize: 9, letterSpacing: "0.16em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const counterStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto auto 1fr", alignItems: "baseline", gap: 8, marginBottom: 16, padding: "10px 11px", borderRadius: 10, background: "rgba(184,140,255,0.06)", color: "rgba(255,255,255,0.48)", fontSize: 8, letterSpacing: "0.1em" };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 5, color: "rgba(255,255,255,0.34)", fontSize: 8, letterSpacing: "0.12em" };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 10px", outline: "none", background: "rgba(255,255,255,0.04)", color: "white", fontSize: 10, textTransform: "uppercase", marginBottom: 13 };
const selectStyle: React.CSSProperties = { width: "100%", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 9px", outline: "none", background: "#0a171a", color: "rgba(255,255,255,0.86)", fontSize: 10, marginBottom: 13 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const resetStyle: React.CSSProperties = { width: "100%", marginTop: 2, border: "1px solid rgba(184,140,255,0.20)", borderRadius: 10, padding: "9px 10px", background: "rgba(184,140,255,0.07)", color: "rgba(202,177,255,0.9)", cursor: "pointer", fontSize: 8, letterSpacing: "0.11em" };
