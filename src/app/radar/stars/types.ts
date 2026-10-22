import { type Constellation, type Observer } from "./sky-catalog";
import { type SkyObject } from "./stars-data";
import { type EarthKind } from "./earth-view";

/*
 * Gemeinsame Typen und Konstanten des STARS-Modus.
 */

export type ViewState = { zoom: number; offsetX: number; offsetY: number };
// horizon = Rundblick (auch AR auf dem Handy)
export type ViewMode = "sky" | "catalog" | "earth" | "horizon";
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type NameLanguage = "en" | "de";

export type Layers = {
    stars: boolean;
    planets: boolean;
    dso: boolean;
    constellations: boolean;
    labels: boolean;
    milkyWay: boolean;
    bounds: boolean;
    ecliptic: boolean;
    equator: boolean;
    meridian: boolean;
    grid: boolean;
    galaxies: boolean;
    clusters: boolean;
    nebulae: boolean;
    smallBodies: boolean;
    satellites: boolean;
    starlink: boolean;
    aircraft: boolean;
};

export type MobilePanel = "none" | "navigator" | "object";
export type PlaceResult = { id: number; label: string; latitude: number; longitude: number };
export type SearchResult = { key: string; title: string; subtitle: string; object?: SkyObject; constellation?: Constellation };
export type SkyInfo = { title: string; extract: string; image: string | null; url: string | null };
export type PanelState = { left: boolean; right: boolean };

export type StoredSettings = {
    mode: ViewMode;
    layers: Layers;
    magnitudeLimit: number;
    observer: Observer;
    observerLabel: string;
    nightMode: boolean;
    earthKind: EarthKind;
    names: NameLanguage;
    panels: PanelState;
    // Lichtverschmutzung am Standort (Bortle 1-9) fuer den Beobachtungs-Score
    bortle: number;
};

export const DEFAULT_VIEW: ViewState = { zoom: 1, offsetX: 0, offsetY: 0 };
export const DEFAULT_OBSERVER: Observer = { lat: 47.3769, lon: 8.5417 };
export const DEFAULT_OBSERVER_LABEL = "Zürich";
export const DEFAULT_LAYERS: Layers = {
    stars: true,
    planets: true,
    dso: true,
    constellations: true,
    labels: true,
    milkyWay: true,
    bounds: false,
    ecliptic: true,
    equator: false,
    meridian: false,
    grid: true,
    galaxies: true,
    clusters: true,
    nebulae: true,
    smallBodies: true,
    satellites: true,
    starlink: false,
    aircraft: true,
};

export const MIN_ZOOM = 0.8;
// Bis 150x (Teleskopblick), damit sich die Jupitermonde trennen lassen.
export const MAX_ZOOM = 150;
export const SETTINGS_KEY = "luma-radar-stars-settings-v1";
export const SAT_LOCATION_KEY = "luma-radar-sat-manual-location";
export const MOBILE_QUERY = "(max-width: 820px)";
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
// Zeitraffer: simulierte Sekunden pro echter Sekunde.
export const SPEEDS: [number, string][] = [[60, "1 min/s"], [600, "10 min/s"], [3600, "1 h/s"], [86400, "1 d/s"]];
export const PLAY_TICK_MS = 100;
// Ueber Helligkeit 6 werden die lichtschwachen Sterne (bis 8) nachgeladen.
export const MAX_MAGNITUDE = 8;
export const DEEP_STAR_LIMIT = 6;

export const PLANET_NAMES_DE: Record<string, string> = {
    sun: "Sonne",
    moon: "Mond",
    mercury: "Merkur",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
    uranus: "Uranus",
    neptune: "Neptun",
};
