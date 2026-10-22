"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SkyObject } from "./stars-data";
import { fallbackCatalog, loadSkyCatalog, solarSystemObjects, type Constellation, type Observer, type SkyCatalog } from "./sky-catalog";
import { azimuthLabel, clamp, eclipticToEquatorial, horizontal, localSiderealTime, moonInfo, nightFor, riseTransitSet } from "./astro";
import { drawMoon, skyBrightness, skyColors } from "./sky-draw";
import { drawEarth, earthProjection, loadEarthMap, normalizeLon, subpoint, type EarthKind, type EarthMap, type GeoPoint } from "./earth-view";

type ViewState = { zoom: number; offsetX: number; offsetY: number };
type ViewMode = "sky" | "catalog" | "earth";
type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Layers = {
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
};
type MobilePanel = "none" | "navigator" | "object";
type PlaceResult = { id: number; label: string; latitude: number; longitude: number };
type SearchResult = { key: string; title: string; subtitle: string; object?: SkyObject; constellation?: Constellation };

type StoredSettings = {
    mode: ViewMode;
    layers: Layers;
    magnitudeLimit: number;
    observer: Observer;
    observerLabel: string;
    nightMode: boolean;
    earthKind: EarthKind;
};

const DEFAULT_VIEW: ViewState = { zoom: 1, offsetX: 0, offsetY: 0 };
const DEFAULT_OBSERVER: Observer = { lat: 47.3769, lon: 8.5417 };
const DEFAULT_OBSERVER_LABEL = "Zürich";
const DEFAULT_LAYERS: Layers = {
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
};
const CARDINALS: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 8;
const SETTINGS_KEY = "luma-radar-stars-settings-v1";
const SAT_LOCATION_KEY = "luma-radar-sat-manual-location";
const MOBILE_QUERY = "(max-width: 820px)";
const MINUTE = 60_000;
const HOUR = 3_600_000;
// Zeitraffer: simulierte Sekunden pro echter Sekunde.
const SPEEDS: [number, string][] = [[60, "1 min/s"], [600, "10 min/s"], [3600, "1 h/s"], [86400, "1 d/s"]];
const PLAY_TICK_MS = 100;

/*
 * Breite knapp vor den Polen begrenzen (dort ist der Azimut nicht
 * definiert), Laenge auf -180..180 falten.
 */
function normalizeObserver(lat: number, lon: number): Observer {
    return { lat: clamp(lat, -89.9, 89.9), lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
}

function formatCoordinate(value: number) {
    return String(Number(value.toFixed(4)));
}

function validObserver(value: unknown): Observer | null {
    const candidate = value as Partial<Observer> | null;
    if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lon)) return null;
    return normalizeObserver(Number(candidate.lat), Number(candidate.lon));
}

/*
 * Gespeicherte Einstellungen lesen. Ohne eigene Einstellungen wird
 * der Standort aus dem SAT-Modus uebernommen, falls dort einer gesetzt ist.
 */
function readSettings(): StoredSettings {
    const defaults: StoredSettings = { mode: "sky", layers: DEFAULT_LAYERS, magnitudeLimit: 5.5, observer: DEFAULT_OBSERVER, observerLabel: DEFAULT_OBSERVER_LABEL, nightMode: false, earthKind: "globe" };

    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            const saved = JSON.parse(raw) as Partial<StoredSettings>;
            const layers = { ...DEFAULT_LAYERS };
            for (const key of Object.keys(DEFAULT_LAYERS) as (keyof Layers)[]) {
                if (typeof saved.layers?.[key] === "boolean") layers[key] = saved.layers[key];
            }
            return {
                mode: saved.mode === "catalog" || saved.mode === "earth" ? saved.mode : "sky",
                layers,
                magnitudeLimit: Number.isFinite(saved.magnitudeLimit) ? clamp(Number(saved.magnitudeLimit), 1, 6.5) : defaults.magnitudeLimit,
                observer: validObserver(saved.observer) ?? DEFAULT_OBSERVER,
                observerLabel: typeof saved.observerLabel === "string" ? saved.observerLabel : DEFAULT_OBSERVER_LABEL,
                nightMode: saved.nightMode === true,
                earthKind: saved.earthKind === "map" ? "map" : "globe",
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

function hoursLabel(hours: number) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function timeLabel(date: Date | null, reference?: Date) {
    if (!date) return "—";
    const time = date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
    if (!reference || date.toDateString() === reference.toDateString()) return time;
    return `${date.toLocaleDateString("de-CH", { weekday: "short" })} ${time}`;
}

// Wert fuer <input type="datetime-local"> in der Zeitzone des Browsers.
function toLocalInput(date: Date) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDistance(object: SkyObject) {
    if (object.kind === "planet") return `${object.distanceAu < 0.1 ? (object.distanceAu * 149_597_871).toLocaleString("de-CH", { maximumFractionDigits: 0 }) + " km" : object.distanceAu.toFixed(2) + " AU"}`;
    const distance = object.distanceLy;
    if (!distance) return "Unknown";
    if (distance >= 1_000_000) return `${(distance / 1_000_000).toFixed(2)} M ly`;
    if (distance >= 1_000) return `${(distance / 1_000).toFixed(1)} k ly`;
    return `${distance.toLocaleString("de-CH")} ly`;
}

function objectSubtitle(object: SkyObject) {
    if (object.kind === "dso") return [object.catalog, object.constellation].filter(Boolean).join(" · ");
    if (object.kind === "planet") return object.name === "Sun" ? "Star · Solar system" : object.name === "Moon" ? "Moon · Solar system" : "Planet · Solar system";
    return `${object.designation ?? "Star"} · ${object.constellation}`;
}

/*
 * Kurzer Ortsname aus dem Nominatim-Text ("Zürich, Bezirk Zürich, ...").
 */
function shortPlaceLabel(label: string) {
    return label.split(",").slice(0, 2).map((part) => part.trim()).join(", ");
}

function applyView(x: number, y: number, width: number, height: number, view: ViewState): Point {
    return {
        x: (x - width / 2) * view.zoom + width / 2 + view.offsetX,
        y: (y - height / 2) * view.zoom + height / 2 + view.offsetY,
    };
}

/*
 * Zoomen um einen Bildschirmpunkt (Mauszeiger, Mitte zwischen zwei
 * Fingern): der Punkt unter dem Zeiger bleibt an seinem Platz.
 */
function zoomAround(view: ViewState, factor: number, screenX: number, screenY: number, size: Size): ViewState {
    const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = zoom / view.zoom;
    return {
        zoom,
        offsetX: screenX - size.width / 2 - (screenX - size.width / 2 - view.offsetX) * k,
        offsetY: screenY - size.height / 2 - (screenY - size.height / 2 - view.offsetY) * k,
    };
}

/*
 * Katalogansicht: Rektaszension waagrecht, Deklination senkrecht.
 */
function projectCatalog(ra: number, dec: number, width: number, height: number, view: ViewState): Point {
    return applyView(((ra % 24) / 24) * width, ((90 - dec) / 180) * height, width, height, view);
}

/*
 * Himmelsansicht: Blick nach oben, Zenit in der Mitte, Horizont als
 * Kreis, Norden oben und Osten links (wie auf drehbaren Sternkarten).
 */
function projectSkyDome(altitude: number, azimuth: number, width: number, height: number, view: ViewState): Point {
    const radius = (Math.min(width, height) / 2) * 0.92;
    const r = ((90 - altitude) / 90) * radius;
    const az = (azimuth * Math.PI) / 180;
    return applyView(width / 2 - r * Math.sin(az), height / 2 - r * Math.cos(az), width, height, view);
}

function isMobileLayout() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

function isTypingTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

const ECLIPTIC_POINTS: [number, number][] = Array.from({ length: 181 }, (_, i) => {
    const { ra, dec } = eclipticToEquatorial(i * 2);
    return [ra, dec];
});
const EQUATOR_POINTS: [number, number][] = Array.from({ length: 241 }, (_, i) => [i * 0.1, 0]);

export default function StarsClient() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const sizeRef = useRef<Size>({ width: 0, height: 0 });
    const pointersRef = useRef(new Map<number, Point>());
    const gestureRef = useRef<{ moved: boolean; pinchDistance: number; pinchMid: Point } | null>(null);
    const [initial] = useState(readSettings);
    const [catalog, setCatalog] = useState<SkyCatalog>(fallbackCatalog);
    const [catalogError, setCatalogError] = useState("");
    const [mode, setMode] = useState<ViewMode>(initial.mode);
    const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedConstellationId, setSelectedConstellationId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [layers, setLayers] = useState<Layers>(initial.layers);
    const [magnitudeLimit, setMagnitudeLimit] = useState(initial.magnitudeLimit);
    const [observer, setObserver] = useState<Observer>(initial.observer);
    const [observerLabel, setObserverLabel] = useState(initial.observerLabel);
    const [nightMode, setNightMode] = useState(initial.nightMode);
    const [latText, setLatText] = useState(formatCoordinate(initial.observer.lat));
    const [lonText, setLonText] = useState(formatCoordinate(initial.observer.lon));
    const [placeQuery, setPlaceQuery] = useState("");
    const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
    const [locationStatus, setLocationStatus] = useState("");
    const [mobilePanel, setMobilePanel] = useState<MobilePanel>("none");
    const [skyTime, setSkyTime] = useState(() => new Date());
    const [liveTime, setLiveTime] = useState(true);
    const [playSpeed, setPlaySpeed] = useState(SPEEDS[2][0]);
    const [playing, setPlaying] = useState(false);
    const [earthKind, setEarthKind] = useState<EarthKind>(initial.earthKind);
    const [globeCenter, setGlobeCenter] = useState<GeoPoint>({ lat: initial.observer.lat, lon: initial.observer.lon });
    const [earthMap, setEarthMap] = useState<EarthMap | null>(null);
    const [pickingLocation, setPickingLocation] = useState(false);

    // Weltkarte erst laden, wenn die Erdansicht geoeffnet wird.
    useEffect(() => {
        if (mode !== "earth" || earthMap) return;
        let active = true;
        loadEarthMap()
            .then((loaded) => { if (active) setEarthMap(loaded); })
            .catch(() => { /* Ohne Karte bleiben Gitter, Tag/Nacht und Marker. */ });
        return () => { active = false; };
    }, [mode, earthMap]);

    useEffect(() => {
        let active = true;
        loadSkyCatalog()
            .then((loaded) => { if (active) setCatalog(loaded); })
            .catch((error: unknown) => { if (active) setCatalogError(error instanceof Error ? error.message : "Sky catalog unavailable"); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!liveTime) return;
        const timer = window.setInterval(() => setSkyTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, [liveTime]);

    useEffect(() => {
        if (!playing) return;
        const timer = window.setInterval(() => setSkyTime((d) => new Date(d.getTime() + playSpeed * PLAY_TICK_MS)), PLAY_TICK_MS);
        return () => window.clearInterval(timer);
    }, [playing, playSpeed]);

    useEffect(() => {
        try {
            const settings: StoredSettings = { mode, layers, magnitudeLimit, observer, observerLabel, nightMode, earthKind };
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch {
            // Speichern ist optional, die Karte funktioniert auch ohne.
        }
    }, [mode, layers, magnitudeLimit, observer, observerLabel, nightMode, earthKind]);

    // Canvas-Groesse nur bei echter Groessenaenderung neu setzen.
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const observerBox = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            sizeRef.current = { width, height };
            setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
        });
        observerBox.observe(wrapper);
        return () => observerBox.disconnect();
    }, []);

    // Eigener Wheel-Listener: React registriert onWheel passiv, dort wirkt preventDefault nicht.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const factor = event.deltaY < 0 ? 1.12 : 0.89;
            setView((v) => zoomAround(v, factor, event.clientX - rect.left, event.clientY - rect.top, { width: rect.width, height: rect.height }));
        };
        canvas.addEventListener("wheel", onWheel, { passive: false });
        return () => canvas.removeEventListener("wheel", onWheel);
    }, []);

    /*
     * Tastatur: Pfeile verschieben, +/- zoomen, 0 setzt zurueck,
     * Leertaste startet den Zeitraffer, / sucht, N = jetzt, R = Nachtsicht.
     */
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === "Escape") {
                if (isTypingTarget(event.target)) (event.target as HTMLElement).blur();
                setSelectedId(null);
                setSelectedConstellationId(null);
                setQuery("");
                setPickingLocation(false);
                return;
            }
            if (isTypingTarget(event.target)) return;
            const { width, height } = sizeRef.current;
            const pan: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
            if (pan[event.key]) {
                const [dx, dy] = pan[event.key];
                setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
            } else if (event.key === "+" || event.key === "=") {
                setView((v) => zoomAround(v, 1.25, width / 2, height / 2, sizeRef.current));
            } else if (event.key === "-") {
                setView((v) => zoomAround(v, 1 / 1.25, width / 2, height / 2, sizeRef.current));
            } else if (event.key === "0") {
                setView(DEFAULT_VIEW);
            } else if (event.key === " ") {
                setLiveTime(false);
                setPlaying((current) => !current);
            } else if (event.key === "/") {
                searchInputRef.current?.focus();
            } else if (event.key === "n" || event.key === "N") {
                setPlaying(false);
                setSkyTime(new Date());
                setLiveTime(true);
            } else if (event.key === "r" || event.key === "R") {
                setNightMode((current) => !current);
            } else {
                return;
            }
            event.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const planets = useMemo(() => solarSystemObjects(skyTime, observer), [skyTime, observer]);

    const allObjects = useMemo<SkyObject[]>(() => [...planets, ...catalog.dsos, ...catalog.stars], [planets, catalog]);

    const selected = useMemo(() => allObjects.find((item) => item.id === selectedId) ?? null, [allObjects, selectedId]);

    const selectedConstellation = useMemo(
        () => catalog.constellations.find((item) => item.id === selectedConstellationId) ?? null,
        [catalog, selectedConstellationId]
    );

    const visibleStars = useMemo(() => catalog.stars.filter((star) => star.magnitude <= magnitudeLimit), [catalog, magnitudeLimit]);

    // Ein gesuchter Stern bleibt sichtbar, auch wenn er dunkler als die Grenzhelligkeit ist.
    const drawnStars = useMemo(
        () => (selected?.kind === "star" && selected.magnitude > magnitudeLimit ? [...visibleStars, selected] : visibleStars),
        [selected, visibleStars, magnitudeLimit]
    );

    const lst = useMemo(() => localSiderealTime(skyTime, observer.lon), [skyTime, observer.lon]);

    // Greenwich-Sternzeit fuer die Bildpunkte in der Erdansicht.
    const gmst = useMemo(() => localSiderealTime(skyTime, 0), [skyTime]);

    // Helle Sterne, die in der Erdansicht als Bildpunkte erscheinen.
    const earthStars = useMemo(() => catalog.stars.filter((star) => star.magnitude <= 1 && !star.name.startsWith("HIP ")), [catalog]);

    const earthProjectionFor = useCallback(
        (width: number, height: number, state: ViewState = view) => earthProjection(earthKind, width, height, state, globeCenter),
        [earthKind, view, globeCenter]
    );

    const sunAltitude = useMemo(() => {
        const sun = planets.find((planet) => planet.id === "sun");
        return sun ? horizontal(sun.ra, sun.dec, lst, observer.lat).altitude : -90;
    }, [planets, lst, observer.lat]);

    // Teure Suchen (Daemmerung, Auf-/Untergang) nur alle paar Minuten neu rechnen.
    const tenMinuteKey = Math.floor(skyTime.getTime() / (10 * MINUTE));
    const minuteKey = Math.floor(skyTime.getTime() / MINUTE);

    const night = useMemo(() => nightFor(new Date(tenMinuteKey * 10 * MINUTE), observer), [tenMinuteKey, observer]);

    const moon = useMemo(() => moonInfo(new Date(minuteKey * MINUTE)), [minuteKey]);

    const moonObject = useMemo(() => planets.find((planet) => planet.id === "moon") ?? null, [planets]);

    const moonEvents = useMemo(() => {
        if (!moonObject) return null;
        const anchor = new Date(tenMinuteKey * 10 * MINUTE);
        const altitude = horizontal(moonObject.ra, moonObject.dec, localSiderealTime(anchor, observer.lon), observer.lat).altitude;
        return riseTransitSet(moonObject, observer, anchor, altitude);
        // Der Mond bewegt sich in zehn Minuten kaum, die Position aus dem Anker genuegt.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenMinuteKey, observer]);

    const searchResults = useMemo<SearchResult[]>(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];

        const constellations: SearchResult[] = catalog.complete
            ? catalog.constellations
                .filter((item) => `${item.name} ${item.nameDe} ${item.id}`.toLowerCase().includes(needle))
                .map((item) => ({ key: `con-${item.id}`, title: item.name, subtitle: item.nameDe !== item.name ? `Constellation · ${item.nameDe}` : "Constellation", constellation: item }))
            : [];

        const objects: SearchResult[] = allObjects
            .filter((item) => {
                if (item.kind === "star" && item.name.startsWith("HIP ")) return false;
                const extra = item.kind === "dso" ? item.catalog : item.kind === "star" ? item.designation ?? "" : "";
                return `${item.name} ${extra} ${item.constellation}`.toLowerCase().includes(needle);
            })
            .map((item) => ({
                key: item.id,
                title: item.kind === "dso" ? item.catalog : item.name,
                subtitle: item.kind === "dso" ? item.name : item.constellation,
                object: item,
            }));

        return [...constellations, ...objects].slice(0, 8);
    }, [allObjects, catalog, query]);

    const selectedHorizontal = useMemo(
        () => (selected ? horizontal(selected.ra, selected.dec, lst, observer.lat) : null),
        [selected, lst, observer.lat]
    );

    const selectedEvents = useMemo(() => {
        if (!selected || !selectedHorizontal) return null;
        return riseTransitSet(selected, observer, new Date(minuteKey * MINUTE), selectedHorizontal.altitude);
        // Nur pro Minute und Objekt neu suchen, nicht bei jedem Sekundentakt.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, minuteKey, observer]);

    /*
     * Bildschirmposition fuer die aktuelle Ansicht, null = unter dem Horizont.
     */
    const project = useCallback((ra: number, dec: number, width: number, height: number, state: ViewState = view): Point | null => {
        if (mode === "catalog") return projectCatalog(ra, dec, width, height, state);
        if (mode === "earth") {
            // Erdansicht: Bildpunkt des Objekts, null = Rueckseite des Globus.
            const ground = subpoint(ra, dec, gmst);
            const point = earthProjectionFor(width, height, state).project(ground.lat, ground.lon);
            return point.visible ? { x: point.x, y: point.y } : null;
        }
        const { altitude, azimuth } = horizontal(ra, dec, lst, observer.lat);
        if (altitude < -1) return null;
        return projectSkyDome(altitude, azimuth, width, height, state);
    }, [mode, view, lst, observer.lat, gmst, earthProjectionFor]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.width === 0 || size.height === 0) return;

        const { width, height } = size;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.max(1, Math.floor(width * dpr));
        const pixelHeight = Math.max(1, Math.floor(height * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const inView = (p: Point | null, margin = 30): p is Point => !!p && p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;

        if (mode === "earth") {
            const projection = earthProjectionFor(width, height);
            const sun = planets.find((planet) => planet.id === "sun");
            drawEarth(ctx, projection, width, height, { map: earthMap, sun: sun ? subpoint(sun.ra, sun.dec, gmst) : null, nightShade: true });

            const label = (text: string, p: Point, offset: number, color: string, font = "600 11px ui-sans-serif, system-ui") => {
                if (!layers.labels) return;
                ctx.fillStyle = color;
                ctx.font = font;
                ctx.textAlign = "left";
                ctx.fillText(text, p.x + offset, p.y - offset);
            };

            if (layers.stars) {
                for (const star of earthStars) {
                    const p = project(star.ra, star.dec, width, height);
                    if (!inView(p)) continue;
                    ctx.fillStyle = star.color ?? "#ffffff";
                    ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
                    label(star.name, p, 5, "rgba(238,244,255,.72)", "10px ui-sans-serif, system-ui");
                }
            }

            if (layers.planets) {
                for (const planet of planets) {
                    const p = project(planet.ra, planet.dec, width, height);
                    if (!inView(p)) continue;
                    if (planet.id === "moon" && sun) {
                        const sunPoint = project(sun.ra, sun.dec, width, height);
                        const angle = sunPoint ? Math.atan2(sunPoint.y - p.y, sunPoint.x - p.x) : moon.phaseAngle < 180 ? 0 : Math.PI;
                        drawMoon(ctx, p.x, p.y, 7, moon.illumination, angle, planet.id === selectedId);
                    } else {
                        const color = planet.id === "sun" ? "#ffd27a" : planet.id === "mars" ? "#ff9b6b" : "#f7e3a3";
                        ctx.save();
                        ctx.shadowBlur = planet.id === "sun" ? 22 : 10;
                        ctx.shadowColor = color;
                        ctx.fillStyle = color;
                        ctx.beginPath(); ctx.arc(p.x, p.y, planet.id === "sun" ? 8 : 4.5, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                    }
                    label(planet.name, p, planet.id === "sun" || planet.id === "moon" ? 10 : 7, "rgba(255,236,190,.95)");
                }
            }

            if (selected && selected.kind !== "planet") {
                const p = project(selected.ra, selected.dec, width, height);
                if (inView(p)) {
                    ctx.fillStyle = "#ffe3a6";
                    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
                    label(selected.kind === "dso" ? selected.catalog : selected.name, p, 8, "#ffe3a6");
                }
            }
            if (selected) {
                const p = project(selected.ra, selected.dec, width, height);
                if (inView(p)) {
                    ctx.strokeStyle = "rgba(255,213,124,.9)";
                    ctx.lineWidth = 1.4;
                    ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
                }
            }

            // Eigener Standort
            const home = projection.project(observer.lat, observer.lon);
            if (home.visible) {
                ctx.save();
                ctx.fillStyle = "#63ffe3";
                ctx.shadowBlur = 12;
                ctx.shadowColor = "#63ffe3";
                ctx.beginPath(); ctx.arc(home.x, home.y, 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "rgba(99,255,227,.6)";
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(home.x, home.y, 10, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = "#63ffe3";
                ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
                ctx.textAlign = "left";
                ctx.fillText(`YOU${observerLabel ? " · " + observerLabel.toUpperCase() : ""}`, home.x + 13, home.y + 4);
                ctx.restore();
            }

            ctx.fillStyle = "rgba(255,255,255,.48)";
            ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.textAlign = "left";
            ctx.fillText(`${observerLabel ? observerLabel.toUpperCase() + " · " : ""}LAT ${observer.lat.toFixed(2)}° · LON ${observer.lon.toFixed(2)}° · GMST ${hoursLabel(gmst)}`, 14, height - 16);
            return;
        }

        const skyMode = mode === "sky";
        const domeCenter = applyView(width / 2, height / 2, width, height, view);
        const horizonRadius = (Math.min(width, height) / 2) * 0.92 * view.zoom;
        // Aufgehellter Himmel daempft Sterne und Milchstrasse (nur in der Himmelsansicht).
        const brightness = skyMode ? skyBrightness(sunAltitude) : 0;
        const pixelsPerDegree = skyMode ? horizonRadius / 90 : ((width / 360 + height / 180) / 2) * view.zoom;

        // Linie durch Himmelskoordinaten, unterbrochen unter dem Horizont und am RA-Rand.
        const strokeSky = (points: ArrayLike<number> | [number, number][], stride = 2) => {
            const flat = Array.isArray(points) && Array.isArray(points[0]);
            const count = flat ? (points as [number, number][]).length : (points as ArrayLike<number>).length / stride;
            let previous: Point | null = null;
            let previousRa = 0;
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const ra = flat ? (points as [number, number][])[i][0] : (points as ArrayLike<number>)[i * stride];
                const dec = flat ? (points as [number, number][])[i][1] : (points as ArrayLike<number>)[i * stride + 1];
                const point = project(ra, dec, width, height);
                const wraps = !skyMode && Math.abs(ra - previousRa) > 12;
                if (point && previous && !wraps) ctx.lineTo(point.x, point.y);
                else if (point) ctx.moveTo(point.x, point.y);
                previous = point;
                previousRa = ra;
            }
            ctx.stroke();
        };

        // Hintergrund: in der Himmelsansicht Farbe nach Sonnenstand, ausserhalb des Horizonts dunkel.
        if (skyMode) {
            ctx.fillStyle = "#01030b";
            ctx.fillRect(0, 0, width, height);
            const [zenith, middle, horizon] = skyColors(sunAltitude);
            const bg = ctx.createRadialGradient(domeCenter.x, domeCenter.y, 0, domeCenter.x, domeCenter.y, horizonRadius);
            bg.addColorStop(0, zenith);
            bg.addColorStop(0.6, middle);
            bg.addColorStop(1, horizon);
            ctx.fillStyle = bg;
            ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius, 0, Math.PI * 2); ctx.fill();
        } else {
            const bg = ctx.createRadialGradient(width * 0.46, height * 0.48, 0, width * 0.46, height * 0.48, Math.max(width, height) * 0.8);
            bg.addColorStop(0, "#08142c");
            bg.addColorStop(0.48, "#030b1b");
            bg.addColorStop(1, "#01030b");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);
        }

        if (layers.milkyWay && catalog.milkyWay.length > 0 && brightness < 1) {
            ctx.save();
            const points = catalog.milkyWay;
            const radius = Math.max(1.5, pixelsPerDegree * 1.25);
            const fade = 1 - brightness;
            for (let i = 0; i < points.length; i += 3) {
                const p = project(points[i], points[i + 1], width, height);
                if (!inView(p, radius)) continue;
                ctx.fillStyle = `rgba(176,196,255,${(0.045 + points[i + 2] * 0.035) * fade})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = "rgba(110,160,255,.18)";
        ctx.lineWidth = 1;
        if (!skyMode) {
            if (layers.grid) {
                ctx.globalAlpha = 0.35;
                for (let ra = 0; ra <= 24; ra += 2) {
                    const a = projectCatalog(ra, 90, width, height, view);
                    const b = projectCatalog(ra, -90, width, height, view);
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
                for (let dec = -60; dec <= 60; dec += 30) {
                    const a = projectCatalog(0, dec, width, height, view);
                    const b = projectCatalog(24, dec, width, height, view);
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
        } else {
            if (layers.grid) {
                ctx.strokeStyle = "rgba(110,160,255,.14)";
                for (let altitude = 15; altitude < 90; altitude += 15) {
                    ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius * ((90 - altitude) / 90), 0, Math.PI * 2); ctx.stroke();
                }
                for (let azimuth = 0; azimuth < 360; azimuth += 30) {
                    const a = projectSkyDome(0, azimuth, width, height, view);
                    const b = projectSkyDome(75, azimuth, width, height, view);
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
            if (layers.meridian) {
                const north = projectSkyDome(0, 0, width, height, view);
                const south = projectSkyDome(0, 180, width, height, view);
                ctx.strokeStyle = "rgba(255,140,160,.45)";
                ctx.setLineDash([6, 5]);
                ctx.beginPath(); ctx.moveTo(north.x, north.y); ctx.lineTo(south.x, south.y); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.strokeStyle = "rgba(99,255,227,.55)";
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "rgba(99,255,227,.85)";
            ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (const [label, azimuth] of CARDINALS) {
                const p = projectSkyDome(-6, azimuth, width, height, view);
                ctx.fillText(label, p.x, p.y);
            }
        }
        ctx.restore();

        ctx.save();
        ctx.lineWidth = 1;
        if (layers.equator) {
            ctx.strokeStyle = "rgba(120,220,255,.4)";
            ctx.setLineDash([2, 4]);
            strokeSky(EQUATOR_POINTS);
        }
        if (layers.ecliptic) {
            ctx.strokeStyle = "rgba(247,199,104,.45)";
            ctx.setLineDash([7, 5]);
            strokeSky(ECLIPTIC_POINTS);
        }
        if (layers.bounds) {
            ctx.strokeStyle = "rgba(150,170,230,.2)";
            ctx.setLineDash([3, 4]);
            for (const boundary of catalog.bounds) {
                for (const ring of boundary.rings) strokeSky(ring);
            }
        }
        ctx.restore();

        if (layers.constellations || selectedConstellation) {
            ctx.save();
            ctx.lineWidth = 1;
            for (const constellation of catalog.constellations) {
                const highlighted = constellation.id === selectedConstellationId;
                if (!layers.constellations && !highlighted) continue;
                ctx.strokeStyle = highlighted ? "rgba(247,199,104,.85)" : `rgba(112,169,255,${0.32 * (1 - brightness * 0.6)})`;
                ctx.lineWidth = highlighted ? 1.8 : 1;
                for (const line of constellation.lines) strokeSky(line);
            }
            if (catalog.complete) {
                ctx.textAlign = "center";
                for (const constellation of catalog.constellations) {
                    const highlighted = constellation.id === selectedConstellationId;
                    if (!highlighted && !(layers.labels && layers.constellations)) continue;
                    const p = project(constellation.ra, constellation.dec, width, height);
                    if (!inView(p)) continue;
                    ctx.fillStyle = highlighted ? "#ffe3a6" : "rgba(140,180,255,.42)";
                    ctx.font = highlighted ? "600 12px ui-sans-serif, system-ui" : "10px ui-sans-serif, system-ui";
                    ctx.fillText(constellation.name.toUpperCase(), p.x, p.y);
                }
            }
            ctx.restore();
        }

        if (layers.dso) {
            for (const object of catalog.dsos) {
                const selectedObject = object.id === selectedId;
                if (object.magnitude > magnitudeLimit + 4 && !selectedObject) continue;
                const p = project(object.ra, object.dec, width, height);
                if (!inView(p)) continue;
                ctx.save();
                ctx.globalAlpha = selectedObject ? 1 : 1 - brightness * 0.7;
                ctx.strokeStyle = selectedObject ? "#f7c768" : "rgba(112,224,255,.75)";
                ctx.fillStyle = selectedObject ? "rgba(247,199,104,.22)" : "rgba(112,224,255,.08)";
                ctx.lineWidth = selectedObject ? 2 : 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedObject ? 7 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (layers.labels && (selectedObject || object.magnitude <= 6 || view.zoom >= 2)) {
                    ctx.fillStyle = selectedObject ? "#ffe3a6" : "rgba(184,232,255,.7)";
                    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
                    ctx.fillText(object.catalog, p.x + 8, p.y - 6);
                }
                ctx.restore();
            }
        }

        if (layers.stars) {
            const labelLimit = view.zoom >= 2.5 ? 3 : 1.8;
            for (const star of drawnStars) {
                const p = project(star.ra, star.dec, width, height);
                if (!inView(p)) continue;
                const selectedStar = star.id === selectedId;
                const radius = clamp((6.2 - star.magnitude) * 0.55, 0.55, 5.3) * Math.sqrt(view.zoom);
                ctx.save();
                // Glow nur fuer helle Sterne, sonst wird das Zeichnen von 5000 Sternen traege.
                ctx.shadowBlur = selectedStar ? 22 : star.magnitude < 2 ? radius * 3 : 0;
                ctx.shadowColor = star.color ?? "#ffffff";
                ctx.fillStyle = star.color ?? "#ffffff";
                ctx.globalAlpha = selectedStar ? 1 : clamp(1.1 - star.magnitude * 0.11, 0.4, 1) * (1 - brightness * 0.75);
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedStar ? radius + 2.4 : radius, 0, Math.PI * 2); ctx.fill();
                if (selectedStar) {
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = "rgba(255,213,124,.9)";
                    ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.stroke();
                }
                if (layers.labels && (selectedStar || (star.magnitude <= labelLimit && !star.name.startsWith("HIP ")))) {
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = selectedStar ? "#ffe3a6" : "rgba(238,244,255,.8)";
                    ctx.font = selectedStar ? "600 12px ui-sans-serif, system-ui" : "11px ui-sans-serif, system-ui";
                    ctx.fillText(star.name, p.x + radius + 6, p.y - radius - 2);
                }
                ctx.restore();
            }
        }

        if (layers.planets) {
            const sun = planets.find((planet) => planet.id === "sun");
            for (const planet of planets) {
                const p = project(planet.ra, planet.dec, width, height);
                if (!inView(p)) continue;
                const selectedPlanet = planet.id === selectedId;
                const radius = planet.id === "sun" || planet.id === "moon" ? 9 : 5;
                if (planet.id === "moon" && sun) {
                    // Helle Seite zur Sonne; deren Bildschirmposition auch unter dem Horizont.
                    const sunPoint = skyMode
                        ? (() => { const h = horizontal(sun.ra, sun.dec, lst, observer.lat); return projectSkyDome(h.altitude, h.azimuth, width, height, view); })()
                        : projectCatalog(sun.ra, sun.dec, width, height, view);
                    drawMoon(ctx, p.x, p.y, radius, moon.illumination, Math.atan2(sunPoint.y - p.y, sunPoint.x - p.x), selectedPlanet);
                } else {
                    const color = planet.id === "sun" ? "#ffd27a" : planet.id === "mars" ? "#ff9b6b" : "#f7e3a3";
                    ctx.save();
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = color;
                    ctx.fillStyle = color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                    if (selectedPlanet) {
                        ctx.strokeStyle = "rgba(255,213,124,.9)";
                        ctx.lineWidth = 1.3;
                        ctx.beginPath(); ctx.arc(p.x, p.y, radius + 7, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                }
                if (layers.labels) {
                    ctx.save();
                    ctx.fillStyle = selectedPlanet ? "#ffe3a6" : "rgba(255,236,190,.92)";
                    ctx.font = "600 11px ui-sans-serif, system-ui";
                    ctx.fillText(planet.name, p.x + radius + 6, p.y - radius);
                    ctx.restore();
                }
            }
        }

        ctx.fillStyle = "rgba(255,255,255,.48)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        if (!skyMode) {
            // RA-Beschriftung an den Gitterlinien, wandert beim Verschieben und Zoomen mit.
            ctx.textAlign = "center";
            for (let ra = 0; ra <= 24; ra += 6) {
                const p = projectCatalog(ra, 0, width, height, view);
                if (p.x < 24 || p.x > width - 24) continue;
                ctx.fillText(`RA ${String(ra).padStart(2, "0")}h`, p.x, height - 16);
            }
        } else {
            ctx.textAlign = "left";
            ctx.fillText(`${observerLabel ? observerLabel.toUpperCase() + " · " : ""}LAT ${observer.lat.toFixed(2)}° · LON ${observer.lon.toFixed(2)}° · LST ${hoursLabel(lst)}`, 14, height - 16);
        }
    }, [catalog, drawnStars, earthMap, earthProjectionFor, earthStars, gmst, layers, lst, magnitudeLimit, mode, moon, observer, observerLabel, planets, project, selected, selectedConstellation, selectedConstellationId, selectedId, size, sunAltitude, view]);

    useEffect(() => {
        draw();
    }, [draw]);

    function pickObject(clientX: number, clientY: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (mode === "earth" && pickingLocation) {
            const ground = earthProjectionFor(rect.width, rect.height).invert(x, y);
            if (!ground) return;
            applyObserver({ lat: ground.lat, lon: ground.lon }, "Map pick");
            setPickingLocation(false);
            setLocationStatus("");
            return;
        }

        const earthIds = mode === "earth" ? new Set(earthStars.map((star) => star.id)) : null;
        let best: { id: string; distance: number } | null = null;
        for (const object of allObjects) {
            // In der Erdansicht nur die gezeichneten Bildpunkte anklickbar.
            if (earthIds && object.kind !== "planet" && !earthIds.has(object.id)) continue;
            if (object.kind === "star" && (!layers.stars || (object.magnitude > magnitudeLimit && object.id !== selectedId))) continue;
            if (object.kind === "dso" && !layers.dso) continue;
            if (object.kind === "planet" && !layers.planets) continue;
            const p = project(object.ra, object.dec, rect.width, rect.height);
            if (!p) continue;
            const distance = Math.hypot(p.x - x, p.y - y);
            if (distance <= 14 && (!best || distance < best.distance)) best = { id: object.id, distance };
        }
        if (!best) return;
        setSelectedId(best.id);
        setSelectedConstellationId(null);
        if (isMobileLayout()) setMobilePanel("object");
    }

    /*
     * Ansicht auf einen Himmelspunkt zentrieren. Liegt er unter dem
     * Horizont, wechselt die Karte in die Katalogansicht.
     */
    function focusPoint(ra: number, dec: number) {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (mode === "earth") {
            // Erdansicht: Globus auf den Bildpunkt drehen bzw. Karte darauf zentrieren.
            const ground = subpoint(ra, dec, gmst);
            if (earthKind === "globe") {
                setGlobeCenter(ground);
                setView(DEFAULT_VIEW);
            } else {
                const zoomed = { zoom: 1.6, offsetX: 0, offsetY: 0 };
                const base = earthProjectionFor(rect.width, rect.height, zoomed).project(ground.lat, ground.lon);
                setView({ zoom: 1.6, offsetX: rect.width / 2 - base.x, offsetY: rect.height / 2 - base.y });
            }
            return;
        }
        const zoomed = { zoom: 1.9, offsetX: 0, offsetY: 0 };
        let base = project(ra, dec, rect.width, rect.height, zoomed);
        if (!base) {
            setMode("catalog");
            base = projectCatalog(ra, dec, rect.width, rect.height, zoomed);
        }
        setView({ zoom: 1.9, offsetX: rect.width / 2 - base.x, offsetY: rect.height / 2 - base.y });
    }

    function focusObject(object: SkyObject) {
        focusPoint(object.ra, object.dec);
        setSelectedId(object.id);
        setSelectedConstellationId(null);
        setQuery("");
        if (isMobileLayout()) setMobilePanel("object");
    }

    function focusConstellation(constellation: Constellation) {
        focusPoint(constellation.ra, constellation.dec);
        setSelectedConstellationId(constellation.id);
        setSelectedId(null);
        setQuery("");
        if (isMobileLayout()) setMobilePanel("none");
    }

    function switchMode(next: ViewMode) {
        setMode(next);
        setView(DEFAULT_VIEW);
        setPickingLocation(false);
        // Globus startet ueber dem eigenen Standort.
        if (next === "earth") setGlobeCenter({ lat: observer.lat, lon: observer.lon });
    }

    function switchEarthKind(next: EarthKind) {
        setEarthKind(next);
        setView(DEFAULT_VIEW);
        if (next === "globe") setGlobeCenter({ lat: observer.lat, lon: observer.lon });
    }

    function zoomBy(factor: number) {
        setView((v) => zoomAround(v, factor, size.width / 2, size.height / 2, size));
    }

    function shiftTime(milliseconds: number) {
        setLiveTime(false);
        setSkyTime((d) => new Date(d.getTime() + milliseconds));
    }

    function goLive() {
        setPlaying(false);
        setSkyTime(new Date());
        setLiveTime(true);
    }

    function applyObserver(next: Observer, label: string) {
        const normalized = normalizeObserver(next.lat, next.lon);
        setObserver(normalized);
        setObserverLabel(label);
        setLatText(formatCoordinate(normalized.lat));
        setLonText(formatCoordinate(normalized.lon));
    }

    // LAT/LON erst beim Verlassen des Feldes oder mit Enter uebernehmen.
    function commitCoordinates() {
        const lat = Number(latText.replace(",", "."));
        const lon = Number(lonText.replace(",", "."));
        if (latText.trim() === "" || lonText.trim() === "" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
            setLatText(formatCoordinate(observer.lat));
            setLonText(formatCoordinate(observer.lon));
            return;
        }
        if (formatCoordinate(lat) === formatCoordinate(observer.lat) && formatCoordinate(lon) === formatCoordinate(observer.lon)) return;
        applyObserver({ lat, lon }, "Custom");
    }

    function locateObserver() {
        if (!navigator.geolocation) {
            setLocationStatus("Location is not supported by this browser.");
            return;
        }
        setLocationStatus("Requesting location…");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                applyObserver({ lat: position.coords.latitude, lon: position.coords.longitude }, "My location");
                setLocationStatus("");
                setPlaceResults([]);
            },
            (error) => setLocationStatus(error.code === error.PERMISSION_DENIED ? "Location permission denied." : "Location unavailable."),
            { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 }
        );
    }

    async function searchPlace() {
        const q = placeQuery.trim();
        if (q.length < 2) return;
        setLocationStatus("Searching…");
        try {
            const response = await fetch(`/api/radar/geocode?q=${encodeURIComponent(q)}`);
            const data = (await response.json()) as { ok: boolean; results: PlaceResult[]; error?: string };
            if (!data.ok) throw new Error(data.error ?? "Place search unavailable.");
            setPlaceResults(data.results);
            setLocationStatus(data.results.length ? "" : "No place found.");
        } catch (error) {
            setPlaceResults([]);
            setLocationStatus(error instanceof Error ? error.message : "Place search unavailable.");
        }
    }

    function choosePlace(place: PlaceResult) {
        applyObserver({ lat: place.latitude, lon: place.longitude }, shortPlaceLabel(place.label));
        setPlaceResults([]);
        setPlaceQuery("");
    }

    /*
     * Ein Finger verschiebt, zwei Finger zoomen um ihre Mitte.
     * Ein kurzer Tipp/Klick ohne Bewegung waehlt ein Objekt aus.
     */
    function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        const pointers = pointersRef.current;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) {
            gestureRef.current = { moved: false, pinchDistance: 0, pinchMid: { x: 0, y: 0 } };
        } else if (pointers.size === 2 && gestureRef.current) {
            const [a, b] = [...pointers.values()];
            gestureRef.current = { moved: true, pinchDistance: Math.hypot(a.x - b.x, a.y - b.y), pinchMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        }
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
        const pointers = pointersRef.current;
        const previous = pointers.get(event.pointerId);
        const gesture = gestureRef.current;
        if (!previous || !gesture) return;
        const current = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, current);

        if (pointers.size === 1) {
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            if (!gesture.moved && Math.hypot(dx, dy) < 1) return;
            gesture.moved = true;
            if (mode === "earth" && earthKind === "globe") {
                // Globus drehen: ein Erdradius Zeigerweg entspricht etwa 57°.
                const rect = event.currentTarget.getBoundingClientRect();
                const radius = earthProjectionFor(rect.width, rect.height).radius;
                const degrees = 180 / Math.PI / radius;
                setGlobeCenter((center) => ({ lat: clamp(center.lat + dy * degrees, -89, 89), lon: normalizeLon(center.lon - dx * degrees) }));
                return;
            }
            setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
            return;
        }

        if (pointers.size === 2) {
            const rect = event.currentTarget.getBoundingClientRect();
            const [a, b] = [...pointers.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const factor = gesture.pinchDistance > 0 ? distance / gesture.pinchDistance : 1;
            const pan = { x: mid.x - gesture.pinchMid.x, y: mid.y - gesture.pinchMid.y };
            gestureRef.current = { moved: true, pinchDistance: distance, pinchMid: mid };
            setView((v) => {
                const zoomed = zoomAround(v, factor, mid.x - rect.left, mid.y - rect.top, { width: rect.width, height: rect.height });
                return { ...zoomed, offsetX: zoomed.offsetX + pan.x, offsetY: zoomed.offsetY + pan.y };
            });
        }
    }

    function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
        const pointers = pointersRef.current;
        const start = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        const gesture = gestureRef.current;
        if (pointers.size === 0) {
            gestureRef.current = null;
            if (start && gesture && !gesture.moved && event.type === "pointerup") pickObject(event.clientX, event.clientY);
        }
    }

    function toggleMobilePanel(panel: Exclude<MobilePanel, "none">) {
        setMobilePanel((current) => (current === panel ? "none" : panel));
    }

    const visibleNow = selectedHorizontal ? selectedHorizontal.altitude > 0 : false;
    const moonUp = moonObject ? horizontal(moonObject.ra, moonObject.dec, lst, observer.lat).altitude > 0 : false;
    // Zeiten stehen in der Zeitzone des Browsers, auch fuer entfernte Standorte.
    const timeZoneName = new Intl.DateTimeFormat("de-CH", { timeZoneName: "short" }).formatToParts(skyTime).find((part) => part.type === "timeZoneName")?.value ?? "";

    const objectToggles: [keyof Layers, string, string | number][] = [
        ["stars", "Stars", visibleStars.length.toLocaleString("de-CH")],
        ["planets", "Sun, Moon & planets", planets.length],
        ["constellations", "Constellations", catalog.constellations.length],
        ["dso", "Deep sky", catalog.dsos.length],
        ["milkyWay", "Milky Way", ""],
        ["labels", "Labels", "Auto"],
    ];
    const lineToggles: [keyof Layers, string, string][] = [
        ["grid", mode === "sky" ? "Alt/Az grid" : "RA/Dec grid", ""],
        ["ecliptic", "Ecliptic", ""],
        ["equator", "Celestial equator", ""],
        ["meridian", "Meridian", mode === "sky" ? "" : "Sky only"],
        ["bounds", "Constellation borders", ""],
    ];

    const timeStatus = liveTime ? "LIVE SKY" : playing ? `TIME LAPSE · ${SPEEDS.find(([value]) => value === playSpeed)?.[1] ?? ""}` : "TIME SHIFT";

    return (
        <main className={`stars-workspace${nightMode ? " is-night" : ""}`}>
            <header className="stars-topbar">
                <div>
                    <div className="stars-kicker">LuMa RADAR · STARS</div>
                    <h1>Celestial Operations</h1>
                </div>
                <div className="stars-topbar-right">
                    <div className="stars-status-row">
                        <span className={`stars-live-dot${liveTime ? "" : " is-paused"}`} />
                        <span>{timeStatus}</span>
                        <span className="stars-separator">•</span>
                        <span>{visibleStars.length.toLocaleString("de-CH")} stars</span>
                        <span className="stars-separator">•</span>
                        <span>{catalog.constellations.length} constellations</span>
                        <span className="stars-separator">•</span>
                        <span>{catalog.dsos.length} deep-sky</span>
                    </div>
                    <button className={`stars-night-toggle${nightMode ? " is-active" : ""}`} onClick={() => setNightMode((current) => !current)} aria-pressed={nightMode} title="Red night vision (R)">
                        Night
                    </button>
                </div>
            </header>

            <section className="stars-layout">
                <aside className={`stars-panel stars-left-panel${mobilePanel === "navigator" ? " is-open" : ""}`}>
                    <div className="stars-panel-title">Sky Navigator</div>
                    <div className="stars-search-wrap">
                        <input
                            ref={searchInputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                                const first = searchResults[0];
                                if (event.key !== "Enter" || !first) return;
                                if (first.constellation) focusConstellation(first.constellation);
                                else if (first.object) focusObject(first.object);
                            }}
                            placeholder="Search Sirius, Jupiter, M31, Orion…"
                            aria-label="Search sky objects"
                        />
                        {searchResults.length > 0 && (
                            <div className="stars-search-results">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.key}
                                        onClick={() => {
                                            if (result.constellation) focusConstellation(result.constellation);
                                            else if (result.object) focusObject(result.object);
                                        }}
                                    >
                                        <strong>{result.title}</strong>
                                        <span>{result.subtitle}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="stars-section-label">View</div>
                    <div className="stars-mode-controls">
                        <button onClick={() => switchMode("sky")} className={mode === "sky" ? "is-active" : undefined}>Sky now</button>
                        <button onClick={() => switchMode("catalog")} className={mode === "catalog" ? "is-active" : undefined}>Catalog</button>
                        <button onClick={() => switchMode("earth")} className={mode === "earth" ? "is-active" : undefined}>Earth</button>
                    </div>

                    <div className="stars-section-label">Layers</div>
                    {objectToggles.map(([key, label, count]) => (
                        <label key={key} className="stars-toggle">
                            <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))} />
                            <span>{label}</span>
                            <b>{count}</b>
                        </label>
                    ))}

                    <div className="stars-section-label">Lines</div>
                    {lineToggles.map(([key, label, note]) => (
                        <label key={key} className="stars-toggle">
                            <input type="checkbox" checked={layers[key]} onChange={(e) => setLayers((current) => ({ ...current, [key]: e.target.checked }))} />
                            <span>{label}</span>
                            <b>{note}</b>
                        </label>
                    ))}

                    <div className="stars-section-label">Magnitude limit</div>
                    <div className="stars-range-row">
                        <input type="range" min="1" max="6.5" step="0.25" value={magnitudeLimit} onChange={(e) => setMagnitudeLimit(Number(e.target.value))} aria-label="Magnitude limit" />
                        <span>{magnitudeLimit.toFixed(2)}</span>
                    </div>

                    <div className="stars-section-label">Observer · {observerLabel || "Custom"}</div>
                    <div className="stars-place-row">
                        <input
                            value={placeQuery}
                            onChange={(event) => setPlaceQuery(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") void searchPlace(); }}
                            placeholder="Search place…"
                            aria-label="Search observer place"
                        />
                        <button onClick={() => void searchPlace()} aria-label="Search place">⌕</button>
                    </div>
                    {placeResults.length > 0 && (
                        <div className="stars-place-results">
                            {placeResults.map((place) => (
                                <button key={place.id} onClick={() => choosePlace(place)}>
                                    <strong>{shortPlaceLabel(place.label)}</strong>
                                    <span>{place.latitude.toFixed(2)}°, {place.longitude.toFixed(2)}°</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="stars-coordinate-grid">
                        <label>LAT
                            <input
                                inputMode="decimal"
                                value={latText}
                                onChange={(e) => setLatText(e.target.value)}
                                onBlur={commitCoordinates}
                                onKeyDown={(e) => { if (e.key === "Enter") commitCoordinates(); }}
                            />
                        </label>
                        <label>LON
                            <input
                                inputMode="decimal"
                                value={lonText}
                                onChange={(e) => setLonText(e.target.value)}
                                onBlur={commitCoordinates}
                                onKeyDown={(e) => { if (e.key === "Enter") commitCoordinates(); }}
                            />
                        </label>
                    </div>
                    <div className="stars-observer-buttons">
                        <button className="stars-secondary-button" onClick={locateObserver}>My location</button>
                        <button className="stars-secondary-button" onClick={() => { applyObserver(DEFAULT_OBSERVER, DEFAULT_OBSERVER_LABEL); setLocationStatus(""); }}>Zürich</button>
                    </div>
                    {locationStatus && <p className="stars-muted">{locationStatus}</p>}
                    {catalogError && <p className="stars-muted">{catalogError} – showing starter catalog.</p>}
                    <p className="stars-shortcuts">Keys: arrows pan · +/− zoom · 0 reset · space play · / search · N now · R night · Esc clear</p>
                </aside>

                <div ref={wrapperRef} className={`stars-canvas-wrap${pickingLocation && mode === "earth" ? " is-picking" : ""}${mode === "earth" && earthKind === "globe" ? " is-globe" : ""}`}>
                    <canvas
                        ref={canvasRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    />
                    <div className={`stars-canvas-badge${pickingLocation && mode === "earth" ? " is-picking" : ""}`}>
                        {mode === "sky"
                            ? sunAltitude > 0 ? "SKY NOW · DAYLIGHT – STARS NOT VISIBLE TO THE EYE"
                                : sunAltitude > -18 ? "SKY NOW · TWILIGHT · ZENITH CENTER, NORTH UP"
                                    : "SKY NOW · ZENITH CENTER · NORTH UP, EAST LEFT"
                            : mode === "earth"
                                ? pickingLocation ? "CLICK ON THE EARTH TO SET YOUR POSITION · ESC CANCELS"
                                    : `EARTH ${earthKind === "globe" ? "GLOBE · DRAG TO ROTATE" : "MAP · DRAG TO PAN"} · WHERE EACH OBJECT IS OVERHEAD NOW`
                                : "EQUATORIAL · J2000 CATALOG VIEW"}
                    </div>
                    <div className="stars-view-switch">
                        <div className="stars-segmented" role="group" aria-label="View">
                            <button onClick={() => switchMode("sky")} className={mode === "sky" ? "is-active" : undefined}>Sky</button>
                            <button onClick={() => switchMode("catalog")} className={mode === "catalog" ? "is-active" : undefined}>Catalog</button>
                            <button onClick={() => switchMode("earth")} className={mode === "earth" ? "is-active" : undefined}>Earth</button>
                        </div>
                        {mode === "earth" && (
                            <>
                                <div className="stars-segmented" role="group" aria-label="Earth projection">
                                    <button onClick={() => switchEarthKind("map")} className={earthKind === "map" ? "is-active" : undefined}>Map</button>
                                    <button onClick={() => switchEarthKind("globe")} className={earthKind === "globe" ? "is-active" : undefined}>Globe</button>
                                </div>
                                <button
                                    className={`stars-pick-button${pickingLocation ? " is-active" : ""}`}
                                    onClick={() => setPickingLocation((current) => !current)}
                                    aria-pressed={pickingLocation}
                                >
                                    {pickingLocation ? "Cancel" : "Set my position"}
                                </button>
                            </>
                        )}
                    </div>
                    <div className="stars-mobile-tabs">
                        <button className={mobilePanel === "navigator" ? "is-active" : undefined} onClick={() => toggleMobilePanel("navigator")}>Navigator</button>
                        <button className={mobilePanel === "object" ? "is-active" : undefined} onClick={() => toggleMobilePanel("object")}>{selected ? selected.name : "Details"}</button>
                    </div>
                    <div className="stars-canvas-controls">
                        <button onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
                        <button onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
                        <button onClick={() => setView(DEFAULT_VIEW)} aria-label="Reset view">⌂</button>
                    </div>
                </div>

                <aside className={`stars-panel stars-right-panel${mobilePanel === "object" ? " is-open" : ""}`}>
                    <div className="stars-panel-title">Object Intelligence</div>
                    {selected ? (
                        <>
                            <div className="stars-object-heading">
                                <div className={`stars-object-icon ${selected.kind}`}>{selected.kind === "star" ? "✦" : selected.kind === "planet" ? "●" : "◎"}</div>
                                <div><h2>{selected.name}</h2><p>{objectSubtitle(selected)}</p></div>
                            </div>
                            <div className={`stars-visibility ${visibleNow ? "is-visible" : "is-below"}`}>
                                <span />{visibleNow ? "ABOVE HORIZON" : "BELOW HORIZON"}
                            </div>
                            {selectedEvents && (
                                <div className="stars-events">
                                    {selectedEvents.status === "circumpolar" ? (
                                        <div className="stars-event-note">Circumpolar – never sets here</div>
                                    ) : selectedEvents.status === "never" ? (
                                        <div className="stars-event-note">Never rises at this latitude</div>
                                    ) : (
                                        <>
                                            <div><span>Rise</span><strong>{timeLabel(selectedEvents.rise, skyTime)}</strong></div>
                                            <div><span>Set</span><strong>{timeLabel(selectedEvents.set, skyTime)}</strong></div>
                                        </>
                                    )}
                                    <div>
                                        <span>Culmination</span>
                                        <strong>{timeLabel(selectedEvents.transit, skyTime)}{selectedEvents.transitAltitude !== null ? ` · ${selectedEvents.transitAltitude.toFixed(0)}°` : ""}</strong>
                                    </div>
                                </div>
                            )}
                            <dl className="stars-data-grid">
                                <div><dt>Right ascension</dt><dd>{hoursLabel(selected.ra)}</dd></div>
                                <div><dt>Declination</dt><dd>{selected.dec.toFixed(2)}°</dd></div>
                                <div><dt>Magnitude</dt><dd>{selected.magnitude < 50 ? selected.magnitude.toFixed(2) : "—"}</dd></div>
                                <div><dt>Distance</dt><dd>{formatDistance(selected)}</dd></div>
                                {selected.kind === "star" && <div><dt>Spectral class</dt><dd>{selected.spectral ?? "—"}</dd></div>}
                                {selected.kind === "dso" && <div><dt>Object type</dt><dd>{selected.objectType}</dd></div>}
                                {selected.id === "moon" && <div><dt>Phase</dt><dd>{moon.name} · {Math.round(moon.illumination * 100)}%</dd></div>}
                                {selectedHorizontal && <div><dt>Altitude</dt><dd>{selectedHorizontal.altitude.toFixed(1)}°</dd></div>}
                                {selectedHorizontal && <div><dt>Azimuth</dt><dd>{selectedHorizontal.azimuth.toFixed(1)}° {azimuthLabel(selectedHorizontal.azimuth)}</dd></div>}
                                <div><dt>Local sidereal</dt><dd>{hoursLabel(lst)}</dd></div>
                            </dl>
                            <button className="stars-primary-button" onClick={() => focusObject(selected)}>Center object</button>
                        </>
                    ) : selectedConstellation ? (
                        <>
                            <div className="stars-object-heading">
                                <div className="stars-object-icon">✶</div>
                                <div><h2>{selectedConstellation.name}</h2><p>Constellation{selectedConstellation.nameDe !== selectedConstellation.name ? ` · ${selectedConstellation.nameDe}` : ""}</p></div>
                            </div>
                            <dl className="stars-data-grid">
                                <div><dt>Abbreviation</dt><dd>{selectedConstellation.id}</dd></div>
                                <div><dt>Right ascension</dt><dd>{hoursLabel(selectedConstellation.ra)}</dd></div>
                                <div><dt>Declination</dt><dd>{selectedConstellation.dec.toFixed(2)}°</dd></div>
                            </dl>
                            <button className="stars-primary-button" onClick={() => focusConstellation(selectedConstellation)}>Center constellation</button>
                        </>
                    ) : <p className="stars-muted">Click a star, planet or deep-sky object, or search for one.</p>}

                    <div className="stars-section-label">Observation time</div>
                    <div className="stars-time-card">
                        <strong>{skyTime.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</strong>
                        <span>{skyTime.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    <input
                        className="stars-datetime"
                        type="datetime-local"
                        value={toLocalInput(skyTime)}
                        onChange={(event) => {
                            const next = new Date(event.target.value);
                            if (Number.isNaN(next.getTime())) return;
                            setLiveTime(false);
                            setSkyTime(next);
                        }}
                        aria-label="Observation date and time"
                    />
                    <div className="stars-time-controls stars-time-controls-wide">
                        <button onClick={() => shiftTime(-24 * HOUR)}>−1d</button>
                        <button onClick={() => shiftTime(-HOUR)}>−1h</button>
                        <button onClick={goLive} className={liveTime ? "is-active" : undefined}>Now</button>
                        <button onClick={() => shiftTime(HOUR)}>+1h</button>
                        <button onClick={() => shiftTime(24 * HOUR)}>+1d</button>
                    </div>
                    <div className="stars-speed-row">
                        <button
                            className={`stars-play-button${playing ? " is-active" : ""}`}
                            onClick={() => { setLiveTime(false); setPlaying((current) => !current); }}
                            aria-label={playing ? "Pause time lapse" : "Play time lapse"}
                        >
                            {playing ? "❚❚" : "▶"}
                        </button>
                        {SPEEDS.map(([value, label]) => (
                            <button
                                key={value}
                                className={playSpeed === value ? "is-active" : undefined}
                                onClick={() => { setPlaySpeed(value); setLiveTime(false); setPlaying(true); }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="stars-section-label">Sky tonight · {observerLabel || "Custom"}{timeZoneName ? ` · times ${timeZoneName}` : ""}</div>
                    <dl className="stars-data-grid stars-night-grid">
                        <div><dt>Sunset</dt><dd>{timeLabel(night.sunset, skyTime)}</dd></div>
                        <div><dt>Civil / nautical dusk</dt><dd>{timeLabel(night.civilDusk, skyTime)} / {timeLabel(night.nauticalDusk, skyTime)}</dd></div>
                        <div>
                            <dt>Astronomical dark</dt>
                            <dd>{night.astronomicalDusk ? `${timeLabel(night.astronomicalDusk, skyTime)} – ${timeLabel(night.astronomicalDawn, skyTime)}` : "No full darkness"}</dd>
                        </div>
                        <div><dt>Nautical / civil dawn</dt><dd>{timeLabel(night.nauticalDawn, skyTime)} / {timeLabel(night.civilDawn, skyTime)}</dd></div>
                        <div><dt>Sunrise</dt><dd>{timeLabel(night.sunrise, skyTime)}</dd></div>
                    </dl>
                    <div className="stars-moon-card">
                        <canvas
                            className="stars-moon-icon"
                            width={44}
                            height={44}
                            ref={(element) => {
                                const ctx = element?.getContext("2d");
                                if (!ctx) return;
                                ctx.clearRect(0, 0, 44, 44);
                                // Zunehmend: helle Seite rechts (Nordhalbkugel), abnehmend links.
                                drawMoon(ctx, 22, 22, 15, moon.illumination, moon.phaseAngle < 180 ? 0 : Math.PI, false);
                            }}
                        />
                        <div>
                            <strong>{moon.name}</strong>
                            <span>{Math.round(moon.illumination * 100)}% illuminated</span>
                            {moonEvents && (
                                moonUp
                                    ? <span>Up now · sets {timeLabel(moonEvents.set, skyTime)}</span>
                                    : <span>Rises {timeLabel(moonEvents.rise, skyTime)} · sets {timeLabel(moonEvents.set, skyTime)}</span>
                            )}
                        </div>
                    </div>
                </aside>
            </section>

            <footer className="stars-footer">
                <span>Drag to pan · Wheel or pinch to zoom · Space plays time · / searches</span>
                <span>Stars, constellations, Milky Way & Messier: d3-celestial (Hipparcos, mag ≤ 6) · Sun, Moon & planets: astronomy-engine</span>
            </footer>
        </main>
    );
}
