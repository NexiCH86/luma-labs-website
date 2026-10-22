import { clamp } from "./astro";
import { type Observer } from "./sky-catalog";
import { type EarthKind } from "./earth-view";
import {
    DEFAULT_LAYERS,
    DEFAULT_OBSERVER,
    DEFAULT_OBSERVER_LABEL,
    MAX_MAGNITUDE,
    SAT_LOCATION_KEY,
    SETTINGS_KEY,
    type Layers,
    type StoredSettings,
    type ViewMode,
} from "./types";

/*
 * Gespeicherte Einstellungen (localStorage) und teilbare Links (URL).
 */

/*
 * Breite knapp vor den Polen begrenzen (dort ist der Azimut nicht
 * definiert), Laenge auf -180..180 falten.
 */
export function normalizeObserver(lat: number, lon: number): Observer {
    return { lat: clamp(lat, -89.9, 89.9), lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
}

export function validObserver(value: unknown): Observer | null {
    const candidate = value as Partial<Observer> | null;
    if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lon)) return null;
    return normalizeObserver(Number(candidate.lat), Number(candidate.lon));
}

const VIEW_MODES: ViewMode[] = ["sky", "catalog", "earth"];

export const DEFAULT_SETTINGS: StoredSettings = {
    mode: "sky",
    layers: DEFAULT_LAYERS,
    magnitudeLimit: 5.5,
    observer: DEFAULT_OBSERVER,
    observerLabel: DEFAULT_OBSERVER_LABEL,
    nightMode: false,
    earthKind: "globe",
    names: "en",
    panels: { left: true, right: true },
    bortle: 6,
};

/*
 * Gespeicherte Einstellungen lesen. Ohne eigene Einstellungen wird
 * der Standort aus dem SAT-Modus uebernommen, falls dort einer gesetzt ist.
 */
export function readSettings(): StoredSettings {
    const defaults = DEFAULT_SETTINGS;

    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const saved = JSON.parse(raw) as Partial<StoredSettings>;
            const layers = { ...DEFAULT_LAYERS };
            for (const key of Object.keys(DEFAULT_LAYERS) as (keyof Layers)[]) {
                if (typeof saved.layers?.[key] === "boolean") layers[key] = saved.layers[key];
            }
            return {
                mode: VIEW_MODES.includes(saved.mode as ViewMode) ? (saved.mode as ViewMode) : "sky",
                layers,
                magnitudeLimit: Number.isFinite(saved.magnitudeLimit) ? clamp(Number(saved.magnitudeLimit), 1, MAX_MAGNITUDE) : defaults.magnitudeLimit,
                observer: validObserver(saved.observer) ?? DEFAULT_OBSERVER,
                observerLabel: typeof saved.observerLabel === "string" ? saved.observerLabel : DEFAULT_OBSERVER_LABEL,
                nightMode: saved.nightMode === true,
                earthKind: saved.earthKind === "map" ? "map" : "globe",
                names: saved.names === "de" ? "de" : "en",
                panels: { left: saved.panels?.left !== false, right: saved.panels?.right !== false },
                bortle: Number.isFinite(saved.bortle) ? clamp(Math.round(Number(saved.bortle)), 1, 9) : defaults.bortle,
            };
        }

        const sat = JSON.parse(window.localStorage.getItem(SAT_LOCATION_KEY) ?? "null") as { latitude?: number; longitude?: number; label?: string } | null;
        const satObserver = validObserver(sat ? { lat: sat.latitude, lon: sat.longitude } : null);
        if (satObserver) return { ...defaults, observer: satObserver, observerLabel: sat?.label || "SAT location" };
    } catch {
        // Ohne Speicher (privates Fenster o. ae.) gelten die Standardwerte.
    }

    return defaults;
}

export function writeSettings(settings: StoredSettings) {
    try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Speichern ist optional, die Karte funktioniert auch ohne.
    }
}

/*
 * Teilbarer Link: /radar/stars?v=sky&obj=dso-M31&t=2026-10-22T21:30:00Z&lat=47.3769&lon=8.5417&place=Zürich
 * Ohne t zeigt der Link den Live-Himmel.
 */
export type UrlState = {
    mode?: ViewMode;
    objectId?: string;
    constellationId?: string;
    time?: Date;
    observer?: Observer;
    observerLabel?: string;
    earthKind?: EarthKind;
};

export function readUrlState(search: string): UrlState {
    const params = new URLSearchParams(search);
    const state: UrlState = {};
    const mode = params.get("v");
    if (mode && VIEW_MODES.includes(mode as ViewMode)) state.mode = mode as ViewMode;
    const objectId = params.get("obj");
    if (objectId && /^[\w .+-]{1,40}$/.test(objectId)) state.objectId = objectId;
    const constellationId = params.get("con");
    if (constellationId && /^[A-Za-z]{2,4}$/.test(constellationId)) state.constellationId = constellationId;
    const time = params.get("t");
    if (time) {
        const date = new Date(time);
        if (!Number.isNaN(date.getTime())) state.time = date;
    }
    const observer = validObserver({ lat: Number(params.get("lat") ?? NaN), lon: Number(params.get("lon") ?? NaN) });
    if (params.has("lat") && params.has("lon") && observer) {
        state.observer = observer;
        state.observerLabel = (params.get("place") ?? "").slice(0, 60) || "Shared location";
    }
    const earthKind = params.get("e");
    if (earthKind === "map" || earthKind === "globe") state.earthKind = earthKind;
    return state;
}

export function buildShareQuery(state: Required<Pick<UrlState, "mode">> & UrlState) {
    const params = new URLSearchParams();
    params.set("v", state.mode);
    if (state.objectId) params.set("obj", state.objectId);
    if (state.constellationId) params.set("con", state.constellationId);
    if (state.time) params.set("t", new Date(Math.round(state.time.getTime() / 60_000) * 60_000).toISOString().replace(".000Z", "Z"));
    if (state.observer) {
        params.set("lat", String(Number(state.observer.lat.toFixed(4))));
        params.set("lon", String(Number(state.observer.lon.toFixed(4))));
        if (state.observerLabel) params.set("place", state.observerLabel);
    }
    if (state.mode === "earth" && state.earthKind) params.set("e", state.earthKind);
    return params.toString();
}
