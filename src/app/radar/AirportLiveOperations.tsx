"use client";

import { useEffect, useMemo, useState } from "react";

type Aircraft = {
    icao24: string;
    callsign: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    verticalRate: number | null;
};

type RadarResponse = { aircraft?: Aircraft[] };

type FocusDetail = {
    latitude?: number;
    longitude?: number;
    code?: string;
    name?: string;
};

type Operation = Aircraft & {
    distanceKm: number;
    bearingToAirport: number;
    relativeHeading: number;
};

export default function AirportLiveOperations() {
    const [airport, setAirport] = useState<FocusDetail | null>(null);
    const [aircraft, setAircraft] = useState<Aircraft[]>([]);
    const [updated, setUpdated] = useState<string>("");

    useEffect(() => {
        const onFocus = (event: Event) => {
            const detail = (event as CustomEvent<FocusDetail>).detail;
            if (detail?.latitude == null || detail?.longitude == null) return;
            setAirport(detail);
        };

        window.addEventListener("luma:airport-focus", onFocus);
        return () => window.removeEventListener("luma:airport-focus", onFocus);
    }, []);

    useEffect(() => {
        let active = true;

        async function load() {
            try {
                const response = await fetch("/api/radar", { cache: "no-store" });
                if (!response.ok) return;
                const data = (await response.json()) as RadarResponse;
                if (!active) return;
                setAircraft(Array.isArray(data.aircraft) ? data.aircraft : []);
                setUpdated(new Date().toLocaleTimeString("de-CH"));
            } catch {
                // Keep last good live snapshot.
            }
        }

        void load();
        const timer = window.setInterval(load, 5000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

    const operations = useMemo(() => {
        if (!airport || airport.latitude == null || airport.longitude == null) {
            return { arrivals: [] as Operation[], departures: [] as Operation[] };
        }

        const arrivals: Operation[] = [];
        const departures: Operation[] = [];

        for (const item of aircraft) {
            if (item.onGround) continue;

            const distance = distanceKm(
                item.latitude,
                item.longitude,
                airport.latitude,
                airport.longitude
            );

            if (distance > 120) continue;

            const bearing = bearingDegrees(
                item.latitude,
                item.longitude,
                airport.latitude,
                airport.longitude
            );
            const relative = item.heading == null ? 180 : headingDifference(item.heading, bearing);
            const altitudeFt = item.altitude == null ? null : item.altitude * 3.28084;
            const verticalFpm = (item.verticalRate ?? 0) * 196.85;

            const operation: Operation = {
                ...item,
                distanceKm: distance,
                bearingToAirport: bearing,
                relativeHeading: relative,
            };

            const arrivalLike =
                distance <= 100 &&
                relative <= 65 &&
                (verticalFpm < -150 || (altitudeFt != null && altitudeFt < 12000));

            const departureLike =
                distance <= 90 &&
                relative >= 115 &&
                (verticalFpm > 150 || (altitudeFt != null && altitudeFt < 15000));

            if (arrivalLike) arrivals.push(operation);
            else if (departureLike) departures.push(operation);
        }

        arrivals.sort((a, b) => a.distanceKm - b.distanceKm);
        departures.sort((a, b) => a.distanceKm - b.distanceKm);

        return {
            arrivals: arrivals.slice(0, 12),
            departures: departures.slice(0, 12),
        };
    }, [airport, aircraft]);

    if (!airport) return null;

    const total = operations.arrivals.length + operations.departures.length;

    return (
        <div style={{ position: "fixed", right: 18, bottom: 56, zIndex: 1496, fontFamily: "inherit" }}>
            <section style={panelStyle}>
                <div style={headerStyle}>
                    <div>
                        <small style={eyebrowStyle}>AIRPORT OPERATIONS</small>
                        <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>
                            {airport.code ?? "AIRPORT"} · Live Movements
                        </strong>
                        <div style={{ marginTop: 3, color: "rgba(255,255,255,0.34)", fontSize: 8 }}>
                            {airport.name ?? "Focused airport"} · {updated || "---"}
                        </div>
                    </div>
                    <span style={countStyle}>{total}</span>
                </div>

                <div style={{ padding: 12 }}>
                    <OperationSection title="ARRIVALS" items={operations.arrivals} arrival />
                    <div style={{ height: 10 }} />
                    <OperationSection title="DEPARTURES" items={operations.departures} />
                    <div style={noticeStyle}>
                        Live classification is estimated from LuMa radar position, heading, altitude and vertical rate. It is not an official airport movement list.
                    </div>
                </div>
            </section>
        </div>
    );
}

function OperationSection({ title, items, arrival = false }: { title: string; items: Operation[]; arrival?: boolean }) {
    return (
        <div>
            <div style={sectionHeaderStyle}>
                <span>{arrival ? "↘" : "↗"} {title}</span>
                <strong>{items.length}</strong>
            </div>
            {items.length === 0 ? (
                <div style={emptyStyle}>No matching live aircraft in the current radar snapshot.</div>
            ) : (
                <div style={{ display: "grid", gap: 5 }}>
                    {items.map((item) => (
                        <OperationRow key={`${title}-${item.icao24}`} item={item} arrival={arrival} />
                    ))}
                </div>
            )}
        </div>
    );
}

function OperationRow({ item, arrival }: { item: Operation; arrival: boolean }) {
    const altitudeFt = item.altitude == null ? null : Math.round(item.altitude * 3.28084);
    const verticalFpm = Math.round((item.verticalRate ?? 0) * 196.85);
    const speedKt = item.velocity == null ? null : Math.round(item.velocity * 1.94384);

    return (
        <div style={rowStyle}>
            <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: arrival ? "#63ffe3" : "#b88cff", fontSize: 10 }}>
                    {item.callsign?.trim() || item.icao24.toUpperCase()}
                </strong>
                <small style={{ color: "rgba(255,255,255,0.34)", fontSize: 8 }}>
                    {item.distanceKm.toFixed(1)} km · {speedKt != null ? `${speedKt} kt` : "--- kt"}
                </small>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                <strong style={{ display: "block", color: "rgba(255,255,255,0.78)", fontSize: 9 }}>
                    {altitudeFt != null ? `${altitudeFt.toLocaleString("de-CH")} ft` : "--- ft"}
                </strong>
                <small style={{ color: verticalFpm > 150 ? "rgba(99,255,227,0.66)" : verticalFpm < -150 ? "rgba(255,116,212,0.72)" : "rgba(255,255,255,0.30)", fontSize: 8 }}>
                    {verticalFpm > 0 ? "+" : ""}{verticalFpm.toLocaleString("de-CH")} fpm
                </small>
            </div>
        </div>
    );
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (value: number) => value * Math.PI / 180;
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function headingDifference(a: number, b: number) {
    const diff = Math.abs(((a - b + 540) % 360) - 180);
    return diff;
}

const panelStyle: React.CSSProperties = { width: "min(360px, calc(100vw - 36px))", maxHeight: "min(620px, calc(100vh - 110px))", overflowY: "auto", border: "1px solid rgba(99,255,227,0.18)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(99,255,227,0.68)", fontSize: 8, letterSpacing: "0.15em" };
const countStyle: React.CSSProperties = { minWidth: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 999, background: "rgba(99,255,227,0.08)", border: "1px solid rgba(99,255,227,0.18)", color: "rgba(99,255,227,0.88)", fontSize: 9 };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 6, color: "rgba(255,255,255,0.48)", fontSize: 8, letterSpacing: "0.12em" };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 9px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, background: "rgba(255,255,255,0.025)" };
const emptyStyle: React.CSSProperties = { padding: "9px 10px", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 9, color: "rgba(255,255,255,0.30)", fontSize: 8, lineHeight: 1.45 };
const noticeStyle: React.CSSProperties = { marginTop: 12, padding: "9px 10px", borderRadius: 9, background: "rgba(255,190,80,0.05)", border: "1px solid rgba(255,190,80,0.10)", color: "rgba(255,220,155,0.50)", fontSize: 8, lineHeight: 1.45 };
