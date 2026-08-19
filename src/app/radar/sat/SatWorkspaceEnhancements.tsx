"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ManualLocation = {
    latitude: number;
    longitude: number;
    altitudeM: number;
    label?: string;
};

type PlaceResult = {
    id: number;
    label: string;
    latitude: number;
    longitude: number;
    type: string;
    postcode: string | null;
    country: string | null;
};

type StoredPanelPosition = { left: number; top: number };

const LOCATION_STORAGE_KEY = "luma-radar-sat-manual-location";
const PANEL_STORAGE_KEY = "luma-radar-sat-details-position";

function parseNumber(value: string) {
    if (!value.trim()) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function fakePosition(location: ManualLocation): GeolocationPosition {
    return {
        coords: {
            latitude: location.latitude,
            longitude: location.longitude,
            altitude: location.altitudeM,
            accuracy: 1,
            altitudeAccuracy: 1,
            heading: null,
            speed: null,
        },
        timestamp: Date.now(),
    } as GeolocationPosition;
}

function applyManualLocation(location: ManualLocation) {
    const geolocation = navigator.geolocation;
    if (!geolocation) throw new Error("Geolocation API is not available in this browser.");

    const ownDescriptor = Object.getOwnPropertyDescriptor(geolocation, "getCurrentPosition");
    const manualGetCurrentPosition: Geolocation["getCurrentPosition"] = (success) => success(fakePosition(location));

    try {
        Object.defineProperty(geolocation, "getCurrentPosition", { configurable: true, value: manualGetCurrentPosition });
        document.querySelector<HTMLButtonElement>(".sat2-location-button")?.click();
        document.querySelector<HTMLButtonElement>(".sat3-location")?.click();
    } finally {
        if (ownDescriptor) Object.defineProperty(geolocation, "getCurrentPosition", ownDescriptor);
        else Reflect.deleteProperty(geolocation, "getCurrentPosition");
    }
}

function enableDetailsPanelDragging() {
    const panel = document.querySelector<HTMLElement>(".sat2-panel");
    const parent = document.querySelector<HTMLElement>(".sat-main");
    if (!panel || !parent || panel.dataset.lumaDraggable === "true") return false;

    panel.dataset.lumaDraggable = "true";
    panel.classList.add("satx-draggable-panel");
    const handle = panel.querySelector<HTMLElement>(".live-status");
    if (!handle) return true;

    handle.classList.add("satx-drag-handle");
    handle.title = "Ziehen zum Verschieben · Doppelklick zum Zurücksetzen";

    const applyPosition = (left: number, top: number, persist = true) => {
        const parentRect = parent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const maxLeft = Math.max(8, parentRect.width - panelRect.width - 8);
        const maxTop = Math.max(8, parentRect.height - panelRect.height - 8);
        const nextLeft = Math.min(Math.max(8, left), maxLeft);
        const nextTop = Math.min(Math.max(8, top), maxTop);
        panel.classList.add("satx-is-dragged");
        panel.style.left = `${nextLeft}px`;
        panel.style.top = `${nextTop}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.height = `${Math.min(panelRect.height, parentRect.height - 16)}px`;
        if (persist) localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left: nextLeft, top: nextTop }));
    };

    const resetPosition = () => {
        localStorage.removeItem(PANEL_STORAGE_KEY);
        panel.classList.remove("satx-is-dragged");
        for (const property of ["left", "top", "right", "bottom", "height"]) panel.style.removeProperty(property);
    };

    try {
        const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) ?? "null") as StoredPanelPosition | null;
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
            requestAnimationFrame(() => applyPosition(saved.left, saved.top, false));
        }
    } catch {
        localStorage.removeItem(PANEL_STORAGE_KEY);
    }

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const parentRect = parent.getBoundingClientRect();
        applyPosition(event.clientX - parentRect.left - offsetX, event.clientY - parentRect.top - offsetY, false);
    };

    const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove("is-dragging");
        const parentRect = parent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left: panelRect.left - parentRect.left, top: panelRect.top - parentRect.top }));
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const panelRect = panel.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        if (!panel.classList.contains("satx-is-dragged")) {
            applyPosition(panelRect.left - parentRect.left, panelRect.top - parentRect.top, false);
        }
        dragging = true;
        offsetX = event.clientX - panelRect.left;
        offsetY = event.clientY - panelRect.top;
        handle.classList.add("is-dragging");
        event.preventDefault();
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const onResize = () => {
        if (!panel.classList.contains("satx-is-dragged")) return;
        const parentRect = parent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        applyPosition(panelRect.left - parentRect.left, panelRect.top - parentRect.top, false);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("dblclick", resetPosition);
    window.addEventListener("resize", onResize);
    return true;
}

export default function SatWorkspaceEnhancements() {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [placeQuery, setPlaceQuery] = useState("5242 Birr, Schweiz");
    const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [latitude, setLatitude] = useState("47.3769");
    const [longitude, setLongitude] = useState("8.5417");
    const [altitude, setAltitude] = useState("0");
    const [advanced, setAdvanced] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        setMounted(true);
        try {
            const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) ?? "null") as ManualLocation | null;
            if (saved) {
                setLatitude(String(saved.latitude));
                setLongitude(String(saved.longitude));
                setAltitude(String(saved.altitudeM));
                if (saved.label) setPlaceQuery(saved.label);
            }
        } catch {
            localStorage.removeItem(LOCATION_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        let stopped = false;
        const tryEnable = () => {
            if (stopped) return;
            if (!enableDetailsPanelDragging()) requestAnimationFrame(tryEnable);
        };
        tryEnable();
        return () => { stopped = true; };
    }, []);

    function activateLocation(location: ManualLocation) {
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
        applyManualLocation(location);
        setLatitude(String(location.latitude));
        setLongitude(String(location.longitude));
        setAltitude(String(location.altitudeM));
        setMessage(`${location.label ?? "Position"} aktiv · ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`);
        window.setTimeout(() => setOpen(false), 900);
    }

    async function searchPlace() {
        const query = placeQuery.trim();
        if (query.length < 2) {
            setMessage("Bitte Ort, PLZ oder Adresse eingeben.");
            return;
        }
        setSearching(true);
        setMessage("");
        setPlaceResults([]);
        try {
            const response = await fetch(`/api/radar/geocode?q=${encodeURIComponent(query)}`);
            const data = await response.json() as { ok?: boolean; results?: PlaceResult[]; error?: string };
            if (!response.ok || !data.ok) throw new Error(data.error ?? "Ortssuche fehlgeschlagen.");
            const results = data.results ?? [];
            setPlaceResults(results);
            if (!results.length) setMessage("Kein passender Ort gefunden. Versuche z.B. «5242 Birr, Schweiz». ");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Ortssuche fehlgeschlagen.");
        } finally {
            setSearching(false);
        }
    }

    function choosePlace(result: PlaceResult) {
        const location: ManualLocation = {
            latitude: result.latitude,
            longitude: result.longitude,
            altitudeM: parseNumber(altitude) ?? 0,
            label: result.label,
        };
        try {
            activateLocation(location);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Position konnte nicht gesetzt werden.");
        }
    }

    function setCoordinates() {
        const lat = parseNumber(latitude);
        const lon = parseNumber(longitude);
        const alt = parseNumber(altitude) ?? 0;
        if (lat == null || lat < -90 || lat > 90) return setMessage("Breitengrad muss zwischen -90 und 90 liegen.");
        if (lon == null || lon < -180 || lon > 180) return setMessage("Längengrad muss zwischen -180 und 180 liegen.");
        if (alt < -500 || alt > 10000) return setMessage("Höhe bitte in Metern zwischen -500 und 10'000 eingeben.");
        try {
            activateLocation({ latitude: lat, longitude: lon, altitudeM: alt, label: "Manual coordinates" });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Position konnte nicht gesetzt werden.");
        }
    }

    if (!mounted) return null;
    const header = document.querySelector<HTMLElement>(".radar-header");

    return (
        <>
            {header && createPortal(
                <button className="satx-manual-button" onClick={() => setOpen((value) => !value)}>MY LOCATION</button>,
                header
            )}

            {open && (
                <section className="satx-location-panel" aria-label="Satellite observer location">
                    <div className="satx-location-head">
                        <div><small>OBSERVER POSITION</small><strong>MY LOCATION</strong></div>
                        <button onClick={() => setOpen(false)} aria-label="Close location">×</button>
                    </div>

                    <p>Einfach Ort, PLZ oder Adresse eingeben. LuMa RADAR ermittelt die Koordinaten automatisch.</p>

                    <div className="satx-place-search">
                        <input
                            value={placeQuery}
                            onChange={(event) => setPlaceQuery(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") searchPlace(); }}
                            placeholder="z.B. 5242 Birr, Schweiz"
                        />
                        <button onClick={searchPlace} disabled={searching}>{searching ? "SEARCHING..." : "SEARCH PLACE"}</button>
                    </div>

                    {placeResults.length > 0 && (
                        <div className="satx-place-results">
                            {placeResults.map((result) => (
                                <button key={`${result.id}-${result.latitude}-${result.longitude}`} onClick={() => choosePlace(result)}>
                                    <strong>{result.label}</strong>
                                    <small>{result.latitude.toFixed(5)}°, {result.longitude.toFixed(5)}° · USE THIS LOCATION</small>
                                </button>
                            ))}
                        </div>
                    )}

                    <button className="satx-advanced-toggle" onClick={() => setAdvanced((value) => !value)}>
                        {advanced ? "HIDE" : "SHOW"} ADVANCED COORDINATES
                    </button>

                    {advanced && (
                        <>
                            <div className="satx-location-grid">
                                <label><span>LATITUDE</span><input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" /></label>
                                <label><span>LONGITUDE</span><input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" /></label>
                                <label className="satx-location-altitude"><span>ALTITUDE (m, optional)</span><input value={altitude} onChange={(event) => setAltitude(event.target.value)} inputMode="decimal" /></label>
                            </div>
                            <button className="satx-location-apply" onClick={setCoordinates}>SET COORDINATES</button>
                        </>
                    )}

                    {message && <div className="satx-location-message">{message}</div>}
                    <small className="satx-osm-credit">Place search © OpenStreetMap contributors</small>
                </section>
            )}
        </>
    );
}
