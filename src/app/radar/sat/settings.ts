import type { SatCategory } from "@/lib/satellite-source";
import { SAT_LOCATION_KEY, SETTINGS_KEY as STARS_SETTINGS_KEY } from "../stars/types";
import type { Observer } from "./orbit";

/*
 * Gruppen, gespeicherte Einstellungen (localStorage), Standort und
 * teilbare Links des SAT-Modus.
 *
 * Nur Typen aus @/lib/satellite-source importieren: das Modul
 * selbst laeuft auf dem Server (Redis).
 */

export type GroupDefinition = { key: string; label: string; category: SatCategory; defaultOn?: boolean };

export const GROUPS: GroupDefinition[] = [
    { key: "STATIONS", label: "Stations", category: "station", defaultOn: true },
    { key: "GPS-OPS", label: "GPS", category: "navigation", defaultOn: true },
    { key: "GLO-OPS", label: "GLONASS", category: "navigation" },
    { key: "GALILEO", label: "Galileo", category: "navigation" },
    { key: "BEIDOU", label: "BeiDou", category: "navigation" },
    { key: "STARLINK", label: "Starlink", category: "constellation" },
    { key: "WEATHER", label: "Weather", category: "weather" },
    { key: "RESOURCE", label: "Earth", category: "earth" },
    { key: "VISUAL", label: "Brightest", category: "science" },
    { key: "SCIENCE", label: "Science", category: "science" },
    { key: "AMATEUR", label: "Amateur", category: "amateur" },
    { key: "GEO", label: "GEO", category: "geo" },
];

export const GROUP_KEYS = new Set(GROUPS.map((group) => group.key));
export const DEFAULT_GROUPS = GROUPS.filter((group) => group.defaultOn).map((group) => group.key);

export function groupLabel(key: string) {
    return GROUPS.find((group) => group.key === key)?.label ?? key;
}

/* ---------- Einstellungen ---------- */

export type SatSettings = {
    groups: string[];
    panels: { left: boolean; right: boolean };
    showMarkers: boolean;
    showOrbit: boolean;
    alerts: boolean;
};

const SETTINGS_KEY = "luma-radar-sat-settings-v1";
const WATCH_KEY = "luma-radar-sat-watchlist";

export const DEFAULT_SETTINGS: SatSettings = {
    groups: DEFAULT_GROUPS,
    panels: { left: true, right: true },
    showMarkers: true,
    showOrbit: true,
    alerts: false,
};

function readJson<T>(key: string): T | null {
    try {
        return JSON.parse(window.localStorage.getItem(key) ?? "null") as T | null;
    } catch {
        return null;
    }
}

function writeJson(key: string, value: unknown) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Speichern ist optional (privates Fenster o. ae.).
    }
}

export function validGroups(value: unknown) {
    if (!Array.isArray(value)) return null;
    const groups = value.filter((group): group is string => typeof group === "string" && GROUP_KEYS.has(group));
    return groups.length ? Array.from(new Set(groups)) : null;
}

export function readSettings(): SatSettings {
    const saved = readJson<Partial<SatSettings>>(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    return {
        groups: validGroups(saved.groups) ?? DEFAULT_GROUPS,
        panels: { left: saved.panels?.left !== false, right: saved.panels?.right !== false },
        showMarkers: saved.showMarkers !== false,
        showOrbit: saved.showOrbit !== false,
        alerts: saved.alerts === true,
    };
}

export function writeSettings(settings: SatSettings) {
    writeJson(SETTINGS_KEY, settings);
}

/* ---------- Beobachtungsliste ---------- */

export type WatchItem = { norad: number; name: string; groupKey: string };

export function readWatchlist(): WatchItem[] {
    const parsed = readJson<Array<Partial<WatchItem>>>(WATCH_KEY);
    if (!Array.isArray(parsed)) return [];
    return parsed
        .filter((item) => Number.isFinite(item.norad))
        .map((item) => ({
            norad: Number(item.norad),
            name: item.name || `NORAD ${item.norad}`,
            groupKey: item.groupKey && GROUP_KEYS.has(item.groupKey) ? item.groupKey : "STATIONS",
        }));
}

export function writeWatchlist(items: WatchItem[]) {
    writeJson(WATCH_KEY, items);
}

/* ---------- Standort (gemeinsam mit STARS) ---------- */

type StoredLocation = { latitude?: number; longitude?: number; altitudeM?: number; label?: string };

export function validObserver(latitude: unknown, longitude: unknown, altitudeKm = 0, label?: string): Observer | null {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (latitude == null || longitude == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return null;
    return {
        latitude: Math.max(-89.9, Math.min(89.9, lat)),
        longitude: Math.abs(lon) <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180,
        altitudeKm: Number.isFinite(altitudeKm) ? Math.max(0, altitudeKm) : 0,
        ...(label ? { label } : {}),
    };
}

/*
 * Eigener Standort des SAT-Modus; fehlt er, gilt der von STARS.
 */
export function readObserver(): Observer | null {
    const sat = readJson<StoredLocation>(SAT_LOCATION_KEY);
    const own = sat ? validObserver(sat.latitude, sat.longitude, Number(sat.altitudeM ?? 0) / 1000, sat.label) : null;
    if (own) return own;
    const stars = readJson<{ observer?: { lat?: number; lon?: number }; observerLabel?: string }>(STARS_SETTINGS_KEY);
    return stars?.observer ? validObserver(stars.observer.lat, stars.observer.lon, 0, stars.observerLabel) : null;
}

/*
 * Standort fuer beide Modi speichern: SAT direkt, STARS in seinen
 * Einstellungen (falls schon vorhanden; sonst liest STARS den
 * SAT-Standort ohnehin als Vorgabe).
 */
export function writeObserver(observer: Observer) {
    writeJson(SAT_LOCATION_KEY, {
        latitude: observer.latitude,
        longitude: observer.longitude,
        altitudeM: Math.round(observer.altitudeKm * 1000),
        label: observer.label,
    });
    const stars = readJson<Record<string, unknown>>(STARS_SETTINGS_KEY);
    if (stars) {
        writeJson(STARS_SETTINGS_KEY, {
            ...stars,
            observer: { lat: observer.latitude, lon: observer.longitude },
            observerLabel: observer.label || "SAT location",
        });
    }
}

/* ---------- Teilbare Links ---------- */

/*
 * /radar/sat?sat=25544&g=STATIONS,GPS-OPS&lat=47.3769&lon=8.5417&place=Zürich
 */
export type UrlState = { norad?: number; groups?: string[]; observer?: Observer };

export function readUrlState(search: string): UrlState {
    const params = new URLSearchParams(search);
    const state: UrlState = {};
    const norad = Number(params.get("sat"));
    if (params.has("sat") && Number.isInteger(norad) && norad > 0) state.norad = norad;
    const groups = validGroups(params.get("g")?.split(","));
    if (groups) state.groups = groups;
    if (params.has("lat") && params.has("lon")) {
        const observer = validObserver(params.get("lat"), params.get("lon"), 0, (params.get("place") ?? "").slice(0, 60) || "Shared location");
        if (observer) state.observer = observer;
    }
    return state;
}

export function buildShareQuery(state: UrlState) {
    const params = new URLSearchParams();
    if (state.norad) params.set("sat", String(state.norad));
    if (state.groups?.length) params.set("g", state.groups.join(","));
    if (state.observer) {
        params.set("lat", String(Number(state.observer.latitude.toFixed(4))));
        params.set("lon", String(Number(state.observer.longitude.toFixed(4))));
        if (state.observer.label) params.set("place", state.observer.label);
    }
    return params.toString();
}
