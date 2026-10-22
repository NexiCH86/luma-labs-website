"use client";

import { useEffect, useState } from "react";
import type { Observer } from "./orbit";
import { validObserver } from "./settings";

/*
 * Standort per GPS, Ortssuche (OpenStreetMap) oder Koordinaten.
 * Der Standort gilt auch fuer STARS.
 */

type PlaceResult = { id: number; label: string; latitude: number; longitude: number };

type Props = {
    observer: Observer | null;
    onChange: (observer: Observer) => void;
    onClose: () => void;
};

function parseNumber(value: string) {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

export default function SatLocation({ observer, onChange, onClose }: Props) {
    const [query, setQuery] = useState(observer?.label ?? "");
    const [results, setResults] = useState<PlaceResult[]>([]);
    const [busy, setBusy] = useState<"" | "gps" | "search">("");
    const [message, setMessage] = useState("");
    const [latitude, setLatitude] = useState(observer ? String(observer.latitude) : "");
    const [longitude, setLongitude] = useState(observer ? String(observer.longitude) : "");
    const [altitude, setAltitude] = useState(observer ? String(Math.round(observer.altitudeKm * 1000)) : "0");

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    function apply(next: Observer) {
        onChange(next);
        onClose();
    }

    function useGps() {
        if (!navigator.geolocation) {
            setMessage("Dieser Browser kann den Standort nicht ermitteln.");
            return;
        }
        setBusy("gps");
        setMessage("");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setBusy("");
                const next = validObserver(position.coords.latitude, position.coords.longitude, (position.coords.altitude ?? 0) / 1000, "GPS location");
                if (next) apply(next);
            },
            (error) => {
                setBusy("");
                setMessage(`Standort nicht verfügbar: ${error.message}`);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }

    async function search() {
        const text = query.trim();
        if (text.length < 2) {
            setMessage("Bitte Ort, PLZ oder Adresse eingeben.");
            return;
        }
        setBusy("search");
        setMessage("");
        setResults([]);
        try {
            const response = await fetch(`/api/radar/geocode?q=${encodeURIComponent(text)}`);
            const data = (await response.json()) as { ok?: boolean; results?: PlaceResult[]; error?: string };
            if (!response.ok || !data.ok) throw new Error(data.error ?? "Ortssuche fehlgeschlagen.");
            setResults(data.results ?? []);
            if (!data.results?.length) setMessage("Kein passender Ort gefunden. Versuche z. B. «5242 Birr, Schweiz».");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Ortssuche fehlgeschlagen.");
        } finally {
            setBusy("");
        }
    }

    function setCoordinates() {
        const lat = parseNumber(latitude);
        const lon = parseNumber(longitude);
        const alt = parseNumber(altitude) ?? 0;
        if (lat == null || lat < -90 || lat > 90) return setMessage("Breitengrad muss zwischen −90 und 90 liegen.");
        if (lon == null || lon < -180 || lon > 180) return setMessage("Längengrad muss zwischen −180 und 180 liegen.");
        if (alt < -500 || alt > 10000) return setMessage("Höhe bitte in Metern zwischen −500 und 10'000 eingeben.");
        const next = validObserver(lat, lon, alt / 1000, "Manual coordinates");
        if (next) apply(next);
    }

    return (
        <div className="sat-dialog-backdrop" onClick={onClose}>
            <section className="sat-dialog" role="dialog" aria-modal="true" aria-label="My location" onClick={(event) => event.stopPropagation()}>
                <div className="sat-dialog-head">
                    <div><small>OBSERVER POSITION</small><strong>MY LOCATION</strong></div>
                    <button onClick={onClose} aria-label="Close location">×</button>
                </div>
                <p>Der Standort gilt für Sichtbarkeit und Überflüge, auch im STARS-Modus.</p>

                <button className="sat-primary" onClick={useGps} disabled={busy === "gps"}>{busy === "gps" ? "LOCATING…" : "USE MY DEVICE LOCATION"}</button>

                <div className="sat-dialog-search">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") search();
                        }}
                        placeholder="z. B. 5242 Birr, Schweiz"
                        aria-label="Place"
                    />
                    <button onClick={search} disabled={busy === "search"}>{busy === "search" ? "…" : "SEARCH"}</button>
                </div>
                {results.length > 0 && (
                    <div className="sat-dialog-results">
                        {results.map((result) => (
                            <button
                                key={`${result.id}-${result.latitude}-${result.longitude}`}
                                onClick={() => {
                                    const next = validObserver(result.latitude, result.longitude, (parseNumber(altitude) ?? 0) / 1000, result.label);
                                    if (next) apply(next);
                                }}
                            >
                                <strong>{result.label}</strong>
                                <small>{result.latitude.toFixed(5)}°, {result.longitude.toFixed(5)}°</small>
                            </button>
                        ))}
                    </div>
                )}

                <details className="sat-dialog-advanced">
                    <summary>Koordinaten eingeben</summary>
                    <div className="sat-dialog-grid">
                        <label><span>LATITUDE</span><input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" /></label>
                        <label><span>LONGITUDE</span><input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" /></label>
                        <label><span>ALTITUDE (m)</span><input value={altitude} onChange={(event) => setAltitude(event.target.value)} inputMode="decimal" /></label>
                    </div>
                    <button className="sat-secondary" onClick={setCoordinates}>SET COORDINATES</button>
                </details>

                {message && <div className="sat-dialog-message" role="status">{message}</div>}
                <small className="sat-footnote">Ortssuche © OpenStreetMap contributors</small>
            </section>
        </div>
    );
}
