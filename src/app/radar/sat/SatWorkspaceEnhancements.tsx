"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ManualLocation = {
    latitude: number;
    longitude: number;
    altitudeM: number;
};

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
        toJSON() {
            return {
                coords: this.coords,
                timestamp: this.timestamp,
            };
        },
    } as GeolocationPosition;
}

function applyManualLocation(location: ManualLocation) {
    const geolocation = navigator.geolocation;
    if (!geolocation) {
        throw new Error("Geolocation API is not available in this browser.");
    }

    const ownDescriptor = Object.getOwnPropertyDescriptor(geolocation, "getCurrentPosition");
    const manualGetCurrentPosition: Geolocation["getCurrentPosition"] = (success) => {
        success(fakePosition(location));
    };

    try {
        Object.defineProperty(geolocation, "getCurrentPosition", {
            configurable: true,
            value: manualGetCurrentPosition,
        });

        document.querySelector<HTMLButtonElement>(".sat2-location-button")?.click();
        document.querySelector<HTMLButtonElement>(".sat3-location")?.click();
    } finally {
        if (ownDescriptor) {
            Object.defineProperty(geolocation, "getCurrentPosition", ownDescriptor);
        } else {
            try {
                delete (geolocation as Geolocation & { getCurrentPosition?: Geolocation["getCurrentPosition"] })
                    .getCurrentPosition;
            } catch {
                // Browser owns the property. The page reload restores the native API in this rare case.
            }
        }
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

    const clampAndApply = (left: number, top: number, persist = true) => {
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

        if (persist) {
            localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left: nextLeft, top: nextTop }));
        }
    };

    const restoreSavedPosition = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(PANEL_STORAGE_KEY) ?? "null") as
                | { left?: number; top?: number }
                | null;
            if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                requestAnimationFrame(() => clampAndApply(saved.left ?? 8, saved.top ?? 8, false));
            }
        } catch {
            localStorage.removeItem(PANEL_STORAGE_KEY);
        }
    };

    const resetPosition = () => {
        localStorage.removeItem(PANEL_STORAGE_KEY);
        panel.classList.remove("satx-is-dragged");
        panel.style.removeProperty("left");
        panel.style.removeProperty("top");
        panel.style.removeProperty("right");
        panel.style.removeProperty("bottom");
        panel.style.removeProperty("height");
    };

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onPointerMove = (event: PointerEvent) => {
        if (!dragging) return;
        const parentRect = parent.getBoundingClientRect();
        clampAndApply(event.clientX - parentRect.left - offsetX, event.clientY - parentRect.top - offsetY, false);
    };

    const onPointerUp = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove("is-dragging");
        const parentRect = parent.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        localStorage.setItem(
            PANEL_STORAGE_KEY,
            JSON.stringify({ left: panelRect.left - parentRect.left, top: panelRect.top - parentRect.top })
        );
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        const panelRect = panel.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        if (!panel.classList.contains("satx-is-dragged")) {
            clampAndApply(panelRect.left - parentRect.left, panelRect.top - parentRect.top, false);
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
        clampAndApply(panelRect.left - parentRect.left, panelRect.top - parentRect.top, false);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("dblclick", resetPosition);
    window.addEventListener("resize", onResize);
    restoreSavedPosition();

    return true;
}

export default function SatWorkspaceEnhancements() {
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [latitude, setLatitude] = useState("47.3769");
    const [longitude, setLongitude] = useState("8.5417");
    const [altitude, setAltitude] = useState("408");
    const [message, setMessage] = useState("");

    useEffect(() => {
        setMounted(true);
        try {
            const saved = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) ?? "null") as
                | ManualLocation
                | null;
            if (saved) {
                setLatitude(String(saved.latitude));
                setLongitude(String(saved.longitude));
                setAltitude(String(saved.altitudeM));
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
        return () => {
            stopped = true;
        };
    }, []);

    function setManualLocation() {
        const lat = parseNumber(latitude);
        const lon = parseNumber(longitude);
        const alt = parseNumber(altitude) ?? 0;

        if (lat == null || lat < -90 || lat > 90) {
            setMessage("Breitengrad muss zwischen -90 und 90 liegen.");
            return;
        }
        if (lon == null || lon < -180 || lon > 180) {
            setMessage("Längengrad muss zwischen -180 und 180 liegen.");
            return;
        }
        if (alt < -500 || alt > 10000) {
            setMessage("Höhe bitte in Metern zwischen -500 und 10'000 eingeben.");
            return;
        }

        const location = { latitude: lat, longitude: lon, altitudeM: alt };
        try {
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
            applyManualLocation(location);
            setMessage(`Position aktiv: ${lat.toFixed(4)}°, ${lon.toFixed(4)}° · ${Math.round(alt)} m`);
            window.setTimeout(() => setOpen(false), 700);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Manuelle Position konnte nicht gesetzt werden.");
        }
    }

    if (!mounted) return null;

    const header = document.querySelector<HTMLElement>(".radar-header");

    return (
        <>
            {header && createPortal(
                <button className="satx-manual-button" onClick={() => setOpen((value) => !value)}>
                    MANUAL LOCATION
                </button>,
                header
            )}

            {open && (
                <section className="satx-location-panel" aria-label="Manual satellite observer location">
                    <div className="satx-location-head">
                        <div>
                            <small>OBSERVER POSITION</small>
                            <strong>MANUAL LOCATION</strong>
                        </div>
                        <button onClick={() => setOpen(false)} aria-label="Close manual location">×</button>
                    </div>

                    <p>Falls der PC keinen Standort liefert, kannst du die Position hier direkt setzen.</p>

                    <div className="satx-location-grid">
                        <label>
                            <span>LATITUDE</span>
                            <input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" />
                        </label>
                        <label>
                            <span>LONGITUDE</span>
                            <input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" />
                        </label>
                        <label className="satx-location-altitude">
                            <span>ALTITUDE (m)</span>
                            <input value={altitude} onChange={(event) => setAltitude(event.target.value)} inputMode="decimal" />
                        </label>
                    </div>

                    <small className="satx-location-hint">Positive Werte = Nord/Ost · negative Werte = Süd/West</small>
                    <button className="satx-location-apply" onClick={setManualLocation}>SET LOCATION</button>
                    {message && <div className="satx-location-message">{message}</div>}
                </section>
            )}
        </>
    );
}
