"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DeepSkyObject, type SkyObject, type StarObject } from "./stars-data";
import { fallbackCatalog, loadDeepStars, loadSkyCatalog, solarSystemObjects, type Constellation, type Observer, type SkyCatalog } from "./sky-catalog";
import { clamp, createSkyFrame, moonInfo, nightFor, riseTransitSet } from "./astro";
import { dsoGroup } from "./sky-draw";
import { tonightsBest } from "./tonight";
import { earthProjection, loadEarthMap, normalizeLon, subpoint, type EarthKind, type EarthMap, type GeoPoint } from "./earth-view";
import { BROWSER_TIME_ZONE, constellationName, dateLabel, formatCoordinate, objectName, shortPlaceLabel, timeLabel, timeZoneLabel, toZonedInput, wikipediaTitles } from "./format";
import { buildShareQuery, normalizeObserver, readSettings, readUrlState, writeSettings } from "./settings";
import { horizonProjector, projectCatalog, projectSkyDome, zoomAround, type HorizonView } from "./projection";
import { lookFromOrientation } from "./device-orientation";
import { drawSkyScene, type SkyMarker } from "./render-sky";
import { drawEarthScene, earthObjectPoint } from "./render-earth";
import { useCanvasGestures, useKeyboardShortcuts } from "./use-canvas-gestures";
import { jupiterMoons, loadSmallBodies, smallBodyObjects, type SmallBodiesFile } from "./kepler";
import { useWatchlist } from "./watchlist";
import AltitudeChart from "./AltitudeChart";
import JupiterMoonsDiagram from "./JupiterMoonsDiagram";
import { groundTrack, isHighlighted, loadSatellites, predictPasses, satelliteState, skyTrack, SATELLITE_GROUPS, type SatelliteEntry, type SatellitePass, type SatelliteState } from "./satellites";
import { aircraftInSky, loadAircraftAround, type AreaAircraft } from "./aircraft";
import { nightScore, type SkyWeather } from "./score";
import { upcomingEvents, type KpForecast, type SkyEvent } from "./events";
import { useSkyAlerts } from "./use-sky-alerts";
import { ScoreCard, EventsList } from "./ScoreAndEvents";
import { AircraftDetails, SatelliteDetails } from "./MovingDetails";
import NavigatorPanel from "./NavigatorPanel";
import ObjectDetails from "./ObjectDetails";
import TimeAndTonight from "./TimeAndTonight";
import {
    DEEP_STAR_LIMIT,
    DEFAULT_OBSERVER,
    DEFAULT_OBSERVER_LABEL,
    DEFAULT_VIEW,
    MINUTE,
    MOBILE_QUERY,
    PLAY_TICK_MS,
    SPEEDS,
    type Layers,
    type MobilePanel,
    type NameLanguage,
    type PanelState,
    type PlaceResult,
    type Point,
    type SearchResult,
    type Size,
    type SkyInfo,
    type ViewMode,
    type ViewState,
} from "./types";

function isMobileLayout() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

/*
 * Startzustand: gespeicherte Einstellungen, ueberschrieben von einem
 * geteilten Link (?v=…&obj=…&t=…&lat=…&lon=…).
 */
function readInitialState() {
    const settings = readSettings();
    const url = readUrlState(window.location.search);
    return {
        settings: {
            ...settings,
            mode: url.mode ?? settings.mode,
            observer: url.observer ?? settings.observer,
            observerLabel: url.observerLabel ?? settings.observerLabel,
            earthKind: url.earthKind ?? settings.earthKind,
        },
        objectId: url.objectId ?? null,
        constellationId: url.constellationId ?? null,
        time: url.time ?? null,
    };
}

export default function StarsClient() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const sizeRef = useRef<Size>({ width: 0, height: 0 });
    const [initial] = useState(readInitialState);
    const [catalog, setCatalog] = useState<SkyCatalog>(fallbackCatalog);
    const [catalogError, setCatalogError] = useState("");
    const [mode, setMode] = useState<ViewMode>(initial.settings.mode);
    const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(initial.objectId);
    const [selectedConstellationId, setSelectedConstellationId] = useState<string | null>(initial.constellationId);
    const [query, setQuery] = useState("");
    const [layers, setLayers] = useState<Layers>(initial.settings.layers);
    const [magnitudeLimit, setMagnitudeLimit] = useState(initial.settings.magnitudeLimit);
    const [observer, setObserver] = useState<Observer>(initial.settings.observer);
    const [observerLabel, setObserverLabel] = useState(initial.settings.observerLabel);
    const [nightMode, setNightMode] = useState(initial.settings.nightMode);
    const [names, setNames] = useState<NameLanguage>(initial.settings.names);
    const [panels, setPanels] = useState<PanelState>(initial.settings.panels);
    const [latText, setLatText] = useState(formatCoordinate(initial.settings.observer.lat));
    const [lonText, setLonText] = useState(formatCoordinate(initial.settings.observer.lon));
    const [placeQuery, setPlaceQuery] = useState("");
    const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
    const [locationStatus, setLocationStatus] = useState("");
    const [mobilePanel, setMobilePanel] = useState<MobilePanel>("none");
    const [skyTime, setSkyTime] = useState(() => initial.time ?? new Date());
    const [liveTime, setLiveTime] = useState(!initial.time);
    const [playSpeed, setPlaySpeed] = useState(SPEEDS[2][0]);
    const [playing, setPlaying] = useState(false);
    const [earthKind, setEarthKind] = useState<EarthKind>(initial.settings.earthKind);
    const [globeCenter, setGlobeCenter] = useState<GeoPoint>({ lat: initial.settings.observer.lat, lon: initial.settings.observer.lon });
    const [earthMap, setEarthMap] = useState<EarthMap | null>(null);
    const [pickingLocation, setPickingLocation] = useState(false);
    const [deepStars, setDeepStars] = useState<StarObject[]>([]);
    // Wikipedia-Infos je Objekt- bzw. Sternbild-ID; null = kein Artikel gefunden.
    const [skyInfos, setSkyInfos] = useState<Record<string, SkyInfo | null>>({});
    const skyInfoRequested = useRef(new Set<string>());
    // Zeitzone des Standorts (Open-Meteo), bis dahin die des Browsers.
    const [siteTimeZone, setSiteTimeZone] = useState<{ key: string; zone: string } | null>(null);
    const [shareStatus, setShareStatus] = useState("");
    const [smallBodiesFile, setSmallBodiesFile] = useState<SmallBodiesFile | null>(null);
    const watchlist = useWatchlist();
    const [bortle, setBortle] = useState(initial.settings.bortle);
    const [brightSatellites, setBrightSatellites] = useState<SatelliteEntry[]>([]);
    const [starlinkSatellites, setStarlinkSatellites] = useState<SatelliteEntry[]>([]);
    const [aircraftRaw, setAircraftRaw] = useState<{ key: string; list: AreaAircraft[] } | null>(null);
    const [weather, setWeather] = useState<{ key: string; data: SkyWeather } | null>(null);
    const [weatherError, setWeatherError] = useState(false);
    const [kpForecast, setKpForecast] = useState<KpForecast | null>(null);
    // Rundblick: Blickrichtung (Azimut, Hoehe) und Rollwinkel; im AR-Modus vom Handy gesteuert.
    const [look, setLook] = useState({ azimuth: 180, altitude: 25, roll: 0 });
    const [arActive, setArActive] = useState(false);
    const [arStatus, setArStatus] = useState("");
    const lookTargetRef = useRef(look);
    // Auf dem Handy sind die Panels Leisten; Einklappen gilt nur am Desktop.
    const [isMobile, setIsMobile] = useState(isMobileLayout);

    useEffect(() => {
        const query = window.matchMedia(MOBILE_QUERY);
        const onChange = () => setIsMobile(query.matches);
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        let active = true;
        loadSkyCatalog()
            .then((loaded) => { if (active) setCatalog(loaded); })
            .catch((error: unknown) => { if (active) setCatalogError(error instanceof Error ? error.message : "Sky catalog unavailable"); });
        return () => { active = false; };
    }, []);

    // Lichtschwache Sterne erst laden, wenn die Grenzhelligkeit ueber 6 steht.
    useEffect(() => {
        if (magnitudeLimit <= DEEP_STAR_LIMIT || deepStars.length > 0) return;
        let active = true;
        loadDeepStars()
            .then((loaded) => { if (active) setDeepStars(loaded); })
            .catch(() => { /* Ohne die Datei bleibt die Karte bei Helligkeit 6. */ });
        return () => { active = false; };
    }, [magnitudeLimit, deepStars.length]);

    // Kometen und Kleinplaneten (Bahnelemente, 15 KB).
    useEffect(() => {
        let active = true;
        loadSmallBodies()
            .then((loaded) => { if (active) setSmallBodiesFile(loaded); })
            .catch(() => { /* Ohne Datei fehlen nur Kometen und Kleinplaneten. */ });
        return () => { active = false; };
    }, []);

    // Weltkarte erst laden, wenn die Erdansicht geoeffnet wird.
    useEffect(() => {
        if (mode !== "earth" || earthMap) return;
        let active = true;
        loadEarthMap()
            .then((loaded) => { if (active) setEarthMap(loaded); })
            .catch(() => { /* Ohne Karte bleiben Gitter, Tag/Nacht und Marker. */ });
        return () => { active = false; };
    }, [mode, earthMap]);

    // Zeitzone des Standorts holen (auf 0,1° gerundet, wie die Route).
    const observerKey = `${observer.lat.toFixed(1)},${observer.lon.toFixed(1)}`;
    useEffect(() => {
        let active = true;
        fetch(`/api/radar/sky-weather?lat=${observer.lat.toFixed(2)}&lon=${observer.lon.toFixed(2)}`)
            .then((response) => response.json() as Promise<{ ok: boolean } & SkyWeather>)
            .then((data) => {
                if (!active) return;
                if (!data.ok) throw new Error("weather");
                setSiteTimeZone({ key: observerKey, zone: data.timezone });
                setWeather({ key: observerKey, data });
                setWeatherError(false);
            })
            // Ohne Antwort gilt die Zeitzone des Browsers.
            .catch(() => { if (active) setWeatherError(true); });
        return () => { active = false; };
        // observer.lat/lon stecken in observerKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [observerKey]);
    const timeZone = siteTimeZone?.key === observerKey ? siteTimeZone.zone : BROWSER_TIME_ZONE;

    // Flugzeuge im Umkreis von 100 NM, alle 20 s (nur live und nicht in der Katalogansicht).
    useEffect(() => {
        if (!layers.aircraft || !liveTime || mode === "catalog") return;
        let active = true;
        const key = observerKey;
        const load = () => loadAircraftAround(observer).then((list) => { if (active) setAircraftRaw({ key, list }); }).catch(() => { /* AIR-Daten voruebergehend nicht erreichbar */ });
        void load();
        const timer = window.setInterval(load, 20_000);
        return () => { active = false; window.clearInterval(timer); };
        // observer steckt in observerKey.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layers.aircraft, liveTime, mode, observerKey]);

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
        writeSettings({ mode, layers, magnitudeLimit, observer, observerLabel, nightMode, earthKind, names, panels, bortle });
    }, [mode, layers, magnitudeLimit, observer, observerLabel, nightMode, earthKind, names, panels, bortle]);

    // Satelliten (Raumstationen + 100 hellste), Starlink nur auf Wunsch.
    useEffect(() => {
        if (!layers.satellites || brightSatellites.length > 0) return;
        let active = true;
        loadSatellites(SATELLITE_GROUPS.bright).then((list) => { if (active) setBrightSatellites(list); }).catch(() => { /* ohne Satelliten */ });
        return () => { active = false; };
    }, [layers.satellites, brightSatellites.length]);

    useEffect(() => {
        if (!layers.starlink || starlinkSatellites.length > 0) return;
        let active = true;
        loadSatellites(SATELLITE_GROUPS.starlink).then((list) => { if (active) setStarlinkSatellites(list); }).catch(() => { /* ohne Starlink */ });
        return () => { active = false; };
    }, [layers.starlink, starlinkSatellites.length]);

    // Kp-Index fuer die Polarlicht-Aussicht.
    useEffect(() => {
        let active = true;
        fetch("/api/radar/space-weather")
            .then((response) => response.json() as Promise<{ ok: boolean; kp: { time: string; kp: number; observed: boolean }[] }>)
            .then((data) => { if (active && data.ok) setKpForecast(data.kp.map((entry) => ({ time: new Date(entry.time), kp: entry.kp, observed: entry.observed }))); })
            .catch(() => { /* ohne Polarlicht-Aussicht */ });
        return () => { active = false; };
    }, []);

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

    // Zeitpunkt auf die Minute, damit die Adresszeile nicht jede Sekunde wechselt.
    const minuteKey = Math.floor(skyTime.getTime() / MINUTE);
    const tenMinuteKey = Math.floor(skyTime.getTime() / (10 * MINUTE));

    // Adresszeile aktuell halten, damit sie sich jederzeit teilen laesst.
    const shareQuery = useMemo(
        () => buildShareQuery({
            mode,
            objectId: selectedId ?? undefined,
            constellationId: selectedConstellationId ?? undefined,
            time: liveTime ? undefined : new Date(minuteKey * MINUTE),
            observer,
            observerLabel,
            earthKind,
        }),
        [mode, selectedId, selectedConstellationId, liveTime, minuteKey, observer, observerLabel, earthKind]
    );
    useEffect(() => {
        const url = `${window.location.pathname}?${shareQuery}`;
        window.history.replaceState(window.history.state, "", url);
    }, [shareQuery]);

    const frame = useMemo(() => createSkyFrame(skyTime, observer), [skyTime, observer]);

    const planets = useMemo(() => solarSystemObjects(skyTime, observer), [skyTime, observer]);

    // Kometen und Kleinplaneten bewegen sich langsam: einmal pro Minute rechnen.
    const minorBodies = useMemo(() => smallBodyObjects(smallBodiesFile, new Date(minuteKey * MINUTE)), [smallBodiesFile, minuteKey]);

    const allObjects = useMemo<SkyObject[]>(() => [...planets, ...minorBodies, ...catalog.dsos, ...catalog.stars, ...deepStars], [planets, minorBodies, catalog, deepStars]);

    const selected = useMemo(() => allObjects.find((item) => item.id === selectedId) ?? null, [allObjects, selectedId]);

    const selectedConstellation = useMemo(
        () => catalog.constellations.find((item) => item.id === selectedConstellationId) ?? null,
        [catalog, selectedConstellationId]
    );

    const visibleStars = useMemo(
        () => [...catalog.stars, ...(magnitudeLimit > DEEP_STAR_LIMIT ? deepStars : [])].filter((star) => star.magnitude <= magnitudeLimit),
        [catalog, deepStars, magnitudeLimit]
    );

    // Ein gesuchter Stern bleibt sichtbar, auch wenn er dunkler als die Grenzhelligkeit ist.
    const drawnStars = useMemo(
        () => (selected?.kind === "star" && selected.magnitude > magnitudeLimit ? [...visibleStars, selected] : visibleStars),
        [selected, visibleStars, magnitudeLimit]
    );

    const earthProjectionFor = useCallback(
        (width: number, height: number, state: ViewState = view) => earthProjection(earthKind, width, height, state, globeCenter),
        [earthKind, view, globeCenter]
    );

    const sunAltitude = useMemo(() => {
        const sun = planets.find((planet) => planet.id === "sun");
        return sun ? frame.toHorizontal(sun.ra, sun.dec).altitude : -90;
    }, [planets, frame]);

    // Teure Suchen (Daemmerung, Auf-/Untergang) nur alle paar Minuten neu rechnen.
    const night = useMemo(() => nightFor(new Date(tenMinuteKey * 10 * MINUTE), observer), [tenMinuteKey, observer]);

    const moon = useMemo(() => moonInfo(new Date(minuteKey * MINUTE)), [minuteKey]);

    const moonObject = useMemo(() => planets.find((planet) => planet.id === "moon") ?? null, [planets]);

    const moonEvents = useMemo(() => {
        if (!moonObject) return null;
        const anchor = new Date(tenMinuteKey * 10 * MINUTE);
        const altitude = createSkyFrame(anchor, observer).toHorizontal(moonObject.ra, moonObject.dec).altitude;
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
                .map((item) => ({ key: `con-${item.id}`, title: constellationName(item, names), subtitle: `Constellation · ${names === "de" ? item.name : item.nameDe}`, constellation: item }))
            : [];

        const objects: SearchResult[] = allObjects
            .filter((item) => {
                if (item.kind === "star" && item.name.startsWith("HIP ")) return false;
                const extra = item.kind === "dso" ? item.catalog : item.kind === "star" ? item.designation ?? "" : objectName(item, "de");
                return `${item.name} ${extra} ${item.constellation}`.toLowerCase().includes(needle);
            })
            .map((item) => ({
                key: item.id,
                title: item.kind === "dso" ? item.catalog : objectName(item, names),
                subtitle: item.kind === "dso" ? item.name : item.constellation,
                object: item,
            }));

        return [...constellations, ...objects].slice(0, 8);
    }, [allObjects, catalog, query, names]);

    const selectedHorizontal = useMemo(
        () => (selected ? frame.toHorizontal(selected.ra, selected.dec) : null),
        [selected, frame]
    );

    const selectedEvents = useMemo(() => {
        if (!selected || !selectedHorizontal) return null;
        return riseTransitSet(selected, observer, new Date(minuteKey * MINUTE), selectedHorizontal.altitude);
        // Nur pro Minute und Objekt neu suchen, nicht bei jedem Sekundentakt.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, minuteKey, observer]);

    // Bild und Kurzbeschreibung zum gewaehlten Objekt bzw. Sternbild, einmal pro Eintrag geladen.
    const infoKey = selected ? selected.id : selectedConstellation ? `con-${selectedConstellation.id}` : null;
    useEffect(() => {
        if (!infoKey || skyInfoRequested.current.has(infoKey)) return;
        const titles = selected ? wikipediaTitles(selected) : selectedConstellation ? [`${selectedConstellation.name} (constellation)`, selectedConstellation.name] : [];
        if (titles.length === 0) return;
        skyInfoRequested.current.add(infoKey);
        fetch(`/api/radar/sky-info?titles=${encodeURIComponent(titles.join("|"))}`)
            .then((response) => response.json() as Promise<{ ok: boolean } & SkyInfo>)
            .then((data) => setSkyInfos((current) => ({ ...current, [infoKey]: data.ok ? { title: data.title, extract: data.extract, image: data.image, url: data.url } : null })))
            .catch(() => {
                // Beim naechsten Auswaehlen erneut versuchen.
                skyInfoRequested.current.delete(infoKey);
            });
    }, [infoKey, selected, selectedConstellation]);

    // Hellste Sterne des gewaehlten Sternbilds.
    const constellationStars = useMemo(
        () => (selectedConstellation ? catalog.stars.filter((star) => star.constellation === selectedConstellation.name && !star.name.startsWith("HIP ")).sort((a, b) => a.magnitude - b.magnitude).slice(0, 6) : []),
        [catalog, selectedConstellation]
    );

    // Kandidaten fuer "Tonight's best": Messier, helle Objekte mit Eigennamen, helle benannte Sterne.
    const tonightCandidates = useMemo<SkyObject[]>(
        () => [
            ...catalog.dsos.filter((dso) => /^M\d+$/.test(dso.catalog) || (dso.name !== dso.catalog && dso.magnitude <= 6 && dsoGroup(dso.typeCode) !== "nebula")),
            ...catalog.stars.filter((star) => star.magnitude <= 1.5 && !star.name.startsWith("HIP ")),
        ],
        [catalog]
    );

    const tonight = useMemo(
        () => tonightsBest(tonightCandidates, observer, night, new Date(tenMinuteKey * 10 * MINUTE)),
        // Die Nacht aendert sich nur mit night/observer, der Anker dient dem Polarsommer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tonightCandidates, observer, night]
    );

    /*
     * Welche Deep-Sky-Objekte gezeichnet werden: Typ-Filter, Messier immer,
     * sonst mit dem Zoom immer mehr. Galaxien und Haufen nach Helligkeit,
     * Nebel nach Groesse (ihre Helligkeitswerte sind oft unbrauchbar).
     */
    const dsoVisible = useCallback((object: DeepSkyObject) => {
        const group = dsoGroup(object.typeCode);
        if (group === "galaxy" && !layers.galaxies) return false;
        if (group === "cluster" && !layers.clusters) return false;
        if (group === "nebula" && !layers.nebulae) return false;
        if (/^M\d+$/.test(object.catalog)) return true;
        const level = view.zoom >= 2.5 ? 2 : view.zoom >= 1.6 ? 1 : 0;
        if (group === "nebula" && object.typeCode !== "pn") return (object.size?.[0] ?? 0) >= [120, 60, 30][level];
        return object.magnitude <= [7.5, 9.5, 12][level];
    }, [layers.galaxies, layers.clusters, layers.nebulae, view.zoom]);

    /*
     * Welche Kometen und Kleinplaneten sichtbar sind: Kometen bis etwas
     * ueber der Grenzhelligkeit (hoechstens 13), Kleinplaneten bis 2,5
     * darueber; das gewaehlte Objekt immer.
     */
    const minorVisible = useCallback((object: SkyObject) => {
        if (object.id === selectedId) return true;
        if (!layers.smallBodies) return false;
        if (object.id.startsWith("comet-")) return object.magnitude <= Math.min(13, magnitudeLimit + 5);
        return object.magnitude <= magnitudeLimit + 2.5;
    }, [layers.smallBodies, magnitudeLimit, selectedId]);

    // Satelliten: helle Gruppe jede Sekunde, Starlink (tausende) alle 5 s.
    const satelliteById = useMemo(
        () => new Map([...brightSatellites, ...(layers.starlink ? starlinkSatellites : [])].map((entry) => [entry.id, entry])),
        [brightSatellites, starlinkSatellites, layers.starlink]
    );
    const brightStates = useMemo(
        () => (layers.satellites ? brightSatellites.map((entry) => satelliteState(entry, skyTime, observer)).filter((state): state is SatelliteState => state !== null) : []),
        [layers.satellites, brightSatellites, skyTime, observer]
    );
    const starlinkKey = Math.floor(skyTime.getTime() / 5000);
    const starlinkStates = useMemo(
        () => (layers.starlink
            ? starlinkSatellites
                .map((entry) => satelliteState(entry, new Date(starlinkKey * 5000), observer))
                .filter((state): state is SatelliteState => state !== null && (mode === "earth" || state.altitude > 0))
            : []),
        [layers.starlink, starlinkSatellites, starlinkKey, observer, mode]
    );
    const satelliteStates = useMemo(() => [...brightStates, ...starlinkStates], [brightStates, starlinkStates]);

    const planesInSky = useMemo(
        () => (layers.aircraft && aircraftRaw?.key === observerKey ? aircraftInSky(aircraftRaw.list, observer) : []),
        [layers.aircraft, aircraftRaw, observerKey, observer]
    );

    // Sonnenhoehe zu einem Zeitpunkt (fuer die Sichtbarkeit von Ueberfluegen).
    const sunAltitudeAt = useCallback((date: Date) => {
        const sun = solarSystemObjects(date, observer).find((body) => body.id === "sun");
        return sun ? createSkyFrame(date, observer).toHorizontal(sun.ra, sun.dec).altitude : -90;
    }, [observer]);

    // Ueberfluege von ISS, Tiangong und Hubble fuer 3 Tage, alle 10 Minuten neu.
    const passSatellites = useMemo(() => brightSatellites.filter((entry) => isHighlighted(entry.norad)), [brightSatellites]);
    const passes = useMemo<SatellitePass[]>(
        () => passSatellites
            .flatMap((entry) => predictPasses(entry, new Date(tenMinuteKey * 10 * MINUTE), observer, sunAltitudeAt, 72))
            .sort((a, b) => a.rise.getTime() - b.rise.getTime()),
        [passSatellites, tenMinuteKey, observer, sunAltitudeAt]
    );

    const selectedSatellite = useMemo(
        () => (selectedId?.startsWith("sat-") ? satelliteStates.find((state) => state.id === selectedId) ?? null : null),
        [selectedId, satelliteStates]
    );
    const selectedSatellitePasses = useMemo(() => {
        if (!selectedId?.startsWith("sat-")) return [];
        const entry = satelliteById.get(selectedId);
        if (!entry) return [];
        if (isHighlighted(entry.norad)) return passes.filter((pass) => pass.id.startsWith(`${entry.id}-`));
        return predictPasses(entry, new Date(tenMinuteKey * 10 * MINUTE), observer, sunAltitudeAt, 72);
    }, [selectedId, satelliteById, passes, tenMinuteKey, observer, sunAltitudeAt]);
    const selectedAircraft = useMemo(
        () => (selectedId?.startsWith("air-") ? planesInSky.find((plane) => plane.id === selectedId) ?? null : null),
        [selectedId, planesInSky]
    );

    const score = useMemo(
        () => nightScore(weather?.key === observerKey ? weather.data : null, observer, night, bortle),
        [weather, observerKey, observer, night, bortle]
    );

    const events = useMemo(
        () => upcomingEvents(new Date(tenMinuteKey * 10 * MINUTE), observer, passes, kpForecast),
        [tenMinuteKey, observer, passes, kpForecast]
    );
    const alerts = useSkyAlerts(events);

    const jupiter = useMemo(() => jupiterMoons(new Date(minuteKey * MINUTE)), [minuteKey]);

    // Zusaetzliche Marker: Kometen (Schweif von der Sonne weg), Kleinplaneten, Jupitermonde.
    const markers = useMemo<SkyMarker[]>(() => {
        const sun = planets.find((planet) => planet.id === "sun");
        const list: SkyMarker[] = minorBodies.filter(minorVisible).map((body) => ({
            id: body.id,
            // "C/2025 A1 (Lemmon)" -> "Lemmon"
            label: body.name.match(/\(([^)]+)\)$/)?.[1] ?? body.name,
            color: body.minorKind === "comet" ? "#9ff3ff" : "#e5c9ff",
            shape: body.minorKind === "comet" ? "comet" : "diamond",
            size: body.minorKind === "comet" ? 3 : 2.6,
            ra: body.ra,
            dec: body.dec,
            awayFrom: body.minorKind === "comet" && sun ? { ra: sun.ra, dec: sun.dec } : undefined,
            highlighted: body.id === selectedId,
        }));
        if (layers.planets) {
            for (const moon of jupiter.moons) {
                list.push({ id: moon.id, label: moon.name, color: "#f3ead2", shape: "dot", size: 1.5, ra: moon.ra, dec: moon.dec, minZoom: 25 });
            }
        }
        // Satelliten: hell, wenn beschienen und dunkel genug; ISS & Co. mit Spur.
        const siteDark = sunAltitude < -6;
        for (const state of satelliteStates) {
            const highlighted = state.id === selectedId;
            const entry = satelliteById.get(state.id);
            const important = isHighlighted(state.norad);
            if (mode !== "earth" && state.altitude < 0 && !highlighted) continue;
            const visible = state.sunlit && siteDark;
            list.push({
                id: state.id,
                // "ISS (ZARYA)" -> "ISS"
                label: important || highlighted ? state.name.replace(/\s*\(.*\)$/, "") : "",
                color: state.category === "constellation" ? "#b9c4d8" : visible ? "#e9fbff" : "#7d8aa3",
                shape: "dot",
                size: important ? 3.4 : state.category === "constellation" ? 1.4 : 2.2,
                altitude: state.altitude,
                azimuth: state.azimuth,
                lat: state.lat,
                lon: state.lon,
                highlighted,
                track: (important || highlighted) && entry && mode !== "earth" && state.altitude > -5 ? skyTrack(entry, skyTime, observer, 6, 20) : undefined,
                groundTrack: (important || highlighted) && entry && mode === "earth" ? groundTrack(entry, skyTime, 45, 45, 1) : undefined,
            });
        }
        for (const plane of planesInSky) {
            list.push({
                id: plane.id,
                // Nur hoch stehende oder gewaehlte Flugzeuge beschriften, sonst wird es am Horizont eng.
                label: plane.altitude >= 30 || plane.id === selectedId ? plane.callsign : "",
                color: "#ffb26b",
                shape: "plane",
                size: 4,
                altitude: plane.altitude,
                azimuth: plane.azimuth,
                lat: plane.lat,
                lon: plane.lon,
                heading: plane.heading ?? 0,
                towards: plane.ahead ?? undefined,
                highlighted: plane.id === selectedId,
            });
        }
        return list;
        // skyTime steckt in satelliteStates (Sekundentakt).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minorBodies, minorVisible, planets, jupiter, layers.planets, selectedId, satelliteStates, satelliteById, planesInSky, mode, sunAltitude, observer]);

    /*
     * Bildschirmposition fuer die aktuelle Ansicht, null = unter dem
     * Horizont bzw. auf der Rueckseite des Globus.
     */
    // Bildwinkel im Rundblick: 100° bei Zoom 1, mit dem Zoom enger (Fernglas/Teleskop).
    const horizonLook = useMemo<HorizonView>(() => ({ ...look, fov: clamp(100 / view.zoom, 0.8, 120) }), [look, view.zoom]);

    const project = useCallback((ra: number, dec: number, width: number, height: number, state: ViewState = view): Point | null => {
        if (mode === "catalog") return projectCatalog(ra, dec, width, height, state);
        if (mode === "horizon") {
            const { altitude, azimuth } = frame.toHorizontal(ra, dec);
            if (altitude < -1) return null;
            return horizonProjector({ ...horizonLook, fov: clamp(100 / state.zoom, 0.8, 120) }, width, height).project(altitude, azimuth);
        }
        if (mode === "earth") return earthObjectPoint(earthProjectionFor(width, height, state), frame, ra, dec);
        const { altitude, azimuth } = frame.toHorizontal(ra, dec);
        if (altitude < -1) return null;
        return projectSkyDome(altitude, azimuth, width, height, state);
    }, [mode, view, frame, earthProjectionFor, horizonLook]);

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

        if (mode === "earth") {
            drawEarthScene({
                ctx, width, height,
                projection: earthProjectionFor(width, height),
                frame, map: earthMap, catalog, layers,
                stars: drawnStars, planets, moon, selected, selectedConstellationId, dsoVisible,
                names, observer, observerLabel, zoom: view.zoom, markers,
            });
            return;
        }

        const projector = horizonProjector(horizonLook, width, height);
        drawSkyScene({
            ctx, width, height, mode, view, frame,
            horizon: mode === "horizon" ? { look: horizonLook, project: projector.project, pixelsPerDegree: projector.pixelsPerDegree } : undefined,
            project: (ra, dec) => project(ra, dec, width, height),
            catalog, layers, stars: drawnStars, planets, moon, sunAltitude,
            selectedId, selectedConstellationId, dsoVisible, names, observer, observerLabel, markers,
        });
    }, [catalog, drawnStars, dsoVisible, earthMap, earthProjectionFor, frame, horizonLook, layers, markers, mode, moon, names, observer, observerLabel, planets, project, selected, selectedConstellationId, selectedId, size, sunAltitude, view]);

    /*
     * AR-Modus: Lage des Handys -> Blickrichtung. Die Sensorwerte kommen
     * sehr oft; geglaettet und hoechstens 20-mal pro Sekunde gezeichnet.
     */
    useEffect(() => {
        if (!arActive) return;
        let frameTimer = 0;
        const smooth = (current: number, target: number, factor: number) => current + (target - current) * factor;
        const onOrientation = (event: DeviceOrientationEvent) => {
            const compass = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
            if (event.beta == null || event.gamma == null || (event.alpha == null && compass == null)) return;
            // iOS liefert den Kompasskurs (im Uhrzeigersinn), sonst alpha (gegen den Uhrzeigersinn).
            const alpha = compass != null ? 360 - compass : event.alpha ?? 0;
            const screenAngle = window.screen.orientation?.angle ?? 0;
            const target = lookFromOrientation({ alpha, beta: event.beta, gamma: event.gamma }, screenAngle);
            const previous = lookTargetRef.current;
            let deltaAz = target.azimuth - previous.azimuth;
            if (deltaAz > 180) deltaAz -= 360;
            if (deltaAz < -180) deltaAz += 360;
            lookTargetRef.current = {
                azimuth: (previous.azimuth + deltaAz * 0.35 + 360) % 360,
                altitude: smooth(previous.altitude, target.altitude, 0.35),
                roll: smooth(previous.roll, target.roll, 0.35),
            };
            if (!frameTimer) frameTimer = window.setTimeout(() => { frameTimer = 0; setLook(lookTargetRef.current); }, 50);
        };
        const absolute = "ondeviceorientationabsolute" in window;
        const eventName = absolute ? "deviceorientationabsolute" : "deviceorientation";
        window.addEventListener(eventName, onOrientation as EventListener);
        return () => {
            window.removeEventListener(eventName, onOrientation as EventListener);
            window.clearTimeout(frameTimer);
        };
    }, [arActive]);

    async function toggleAr() {
        if (arActive) {
            setArActive(false);
            setLook((current) => ({ ...current, roll: 0 }));
            setArStatus("");
            return;
        }
        if (typeof DeviceOrientationEvent === "undefined") {
            setArStatus("This device has no orientation sensor.");
            return;
        }
        // iOS fragt beim ersten Mal nach der Erlaubnis.
        const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> }).requestPermission;
        if (request) {
            try {
                if ((await request()) !== "granted") {
                    setArStatus("Motion & orientation access was denied.");
                    return;
                }
            } catch {
                setArStatus("Motion & orientation access was denied.");
                return;
            }
        }
        setMode("horizon");
        setView({ zoom: 100 / 70, offsetX: 0, offsetY: 0 });
        setArActive(true);
        setArStatus("Hold your phone up to the sky.");
    }

    /*
     * Bild der aktuellen Ansicht herunterladen, mit Datum, Ort und
     * Ansicht als Fusszeile (z. B. der Himmel am Geburtstag).
     */
    function downloadSnapshot() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const footer = 46;
        const out = document.createElement("canvas");
        out.width = canvas.width;
        out.height = canvas.height + footer * (canvas.width / Math.max(1, size.width));
        const ctx = out.getContext("2d");
        if (!ctx) return;
        const scale = canvas.width / Math.max(1, size.width);
        ctx.fillStyle = "#01030b";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#eef4ff";
        ctx.font = "600 14px Inter, ui-sans-serif, system-ui";
        ctx.fillText(`${dateLabel(skyTime, timeZone)} · ${timeLabel(skyTime, timeZone)} (${timeZoneLabel(skyTime, timeZone)})`, 16, size.height + 20);
        ctx.fillStyle = "rgba(200,214,248,.7)";
        ctx.font = "11px ui-monospace, Menlo, monospace";
        ctx.fillText(`${observerLabel || "Custom"} · ${observer.lat.toFixed(2)}°, ${observer.lon.toFixed(2)}° · LuMa RADAR STARS · lumalabs.ch`, 16, size.height + 38);
        const link = document.createElement("a");
        const stamp = toZonedInput(skyTime, timeZone).replace(/[:T]/g, "-");
        link.download = `luma-sky-${stamp}-${(observerLabel || "custom").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        link.href = out.toDataURL("image/png");
        link.click();
    }

    useEffect(() => {
        draw();
    }, [draw]);

    // Bildschirmposition eines Markers in der aktuellen Ansicht (fuer Klicks).
    function markerScreenPoint(marker: SkyMarker, width: number, height: number): Point | null {
        if (mode === "earth") {
            if (marker.lat !== undefined && marker.lon !== undefined) {
                const point = earthProjectionFor(width, height).project(marker.lat, marker.lon);
                return point.visible ? { x: point.x, y: point.y } : null;
            }
            return marker.ra !== undefined && marker.dec !== undefined ? project(marker.ra, marker.dec, width, height) : null;
        }
        if (marker.altitude !== undefined && marker.azimuth !== undefined) {
            if (mode === "horizon") return marker.altitude < -1 ? null : horizonProjector(horizonLook, width, height).project(marker.altitude, marker.azimuth);
            if (mode === "sky") return marker.altitude < -1 ? null : projectSkyDome(marker.altitude, marker.azimuth, width, height, view);
            const { ra, dec } = frame.fromHorizontal(marker.altitude, marker.azimuth);
            return projectCatalog(ra, dec, width, height, view);
        }
        return marker.ra !== undefined && marker.dec !== undefined ? project(marker.ra, marker.dec, width, height) : null;
    }

    // Ereignis gewaehlt: Zeit darauf stellen und das Objekt auswaehlen.
    function showEvent(event: SkyEvent) {
        setPlaying(false);
        setLiveTime(false);
        setSkyTime(event.time);
        if (event.objectId) {
            setSelectedId(event.objectId);
            setSelectedConstellationId(null);
        }
        if (mode === "catalog") setMode("sky");
        if (mode !== "earth") setView(DEFAULT_VIEW);
        if (isMobileLayout()) setMobilePanel("object");
    }

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

        let best: { id: string; distance: number } | null = null;
        for (const object of allObjects) {
            if (object.kind === "star" && (!layers.stars || (object.magnitude > magnitudeLimit && object.id !== selectedId))) continue;
            if (object.kind === "dso" && (!layers.dso || (!dsoVisible(object) && object.id !== selectedId))) continue;
            if (object.kind === "planet" && (object.id.startsWith("comet-") || object.id.startsWith("asteroid-")) ? !minorVisible(object) : object.kind === "planet" && !layers.planets) continue;
            const p = project(object.ra, object.dec, rect.width, rect.height);
            if (!p) continue;
            const distance = Math.hypot(p.x - x, p.y - y);
            // Planeten und helle Objekte gewinnen knappe Faelle.
            const weighted = distance - (object.kind === "planet" ? 4 : 0) + Math.max(0, object.magnitude) * 0.2;
            if (distance <= 14 && (!best || weighted < best.distance)) best = { id: object.id, distance: weighted };
        }
        // Satelliten und Flugzeuge haben keine Katalogkoordinaten: ueber die Marker pruefen.
        for (const marker of markers) {
            if (!marker.id.startsWith("sat-") && !marker.id.startsWith("air-")) continue;
            const p = markerScreenPoint(marker, rect.width, rect.height);
            if (!p) continue;
            const distance = Math.hypot(p.x - x, p.y - y) - 3;
            if (distance <= 14 && (!best || distance < best.distance)) best = { id: marker.id, distance };
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
            const date = frame.toDate(ra, dec);
            const ground = subpoint(date.ra, date.dec, frame.gast);
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
        if (mode === "horizon") {
            // Rundblick: in die Richtung des Objekts schauen (unter dem Horizont: Katalogansicht).
            const { altitude, azimuth } = frame.toHorizontal(ra, dec);
            if (altitude > -1) {
                if (!arActive) setLook((current) => ({ ...current, azimuth, altitude: clamp(altitude, -5, 90) }));
                return;
            }
        }
        const zoomed = { zoom: 1.9, offsetX: 0, offsetY: 0 };
        let base = mode === "horizon" ? null : project(ra, dec, rect.width, rect.height, zoomed);
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
        if (isMobileLayout()) setMobilePanel("object");
    }

    function pickSearchResult(result: SearchResult) {
        if (result.constellation) focusConstellation(result.constellation);
        else if (result.object) focusObject(result.object);
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

    // Objekt aus "Tonight's best": Zeit auf den besten Moment stellen und auswaehlen.
    function showTonightEntry(object: SkyObject, bestTime: Date) {
        setPlaying(false);
        setLiveTime(false);
        setSkyTime(bestTime);
        setSelectedId(object.id);
        setSelectedConstellationId(null);
        if (mode === "catalog") setMode("sky");
        if (mode !== "earth") setView(DEFAULT_VIEW);
        if (isMobileLayout()) setMobilePanel("object");
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

    function togglePlay() {
        setLiveTime(false);
        setPlaying((current) => !current);
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

    // Link mit Objekt, Zeit, Standort und Ansicht in die Zwischenablage.
    async function shareView() {
        const url = `${window.location.origin}${window.location.pathname}?${shareQuery}`;
        try {
            if (navigator.share && isMobileLayout()) {
                await navigator.share({ title: "LuMa RADAR · STARS", url });
                setShareStatus("Shared");
            } else {
                await navigator.clipboard.writeText(url);
                setShareStatus("Link copied");
            }
        } catch {
            setShareStatus("Copy the address bar");
        }
        window.setTimeout(() => setShareStatus(""), 2500);
    }

    const gestures = useCanvasGestures(canvasRef, {
        onPan: (dx, dy, rect) => {
            if (mode === "horizon") {
                // Ziehen dreht den Blick; im AR-Modus steuert das Handy.
                if (arActive) return;
                const degreesPerPixel = horizonLook.fov / rect.width;
                setLook((current) => ({ ...current, azimuth: (current.azimuth - dx * degreesPerPixel + 360) % 360, altitude: clamp(current.altitude + dy * degreesPerPixel, -5, 90) }));
                return;
            }
            if (mode === "earth" && earthKind === "globe") {
                // Globus drehen: ein Erdradius Zeigerweg entspricht etwa 57°.
                const radius = earthProjectionFor(rect.width, rect.height).radius;
                const degrees = 180 / Math.PI / radius;
                setGlobeCenter((center) => ({ lat: clamp(center.lat + dy * degrees, -89, 89), lon: normalizeLon(center.lon - dx * degrees) }));
                return;
            }
            setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
        },
        onPinch: (factor, mid, pan, rect) => {
            setView((v) => {
                const zoomed = zoomAround(v, factor, mid.x, mid.y, { width: rect.width, height: rect.height });
                return { ...zoomed, offsetX: zoomed.offsetX + pan.x, offsetY: zoomed.offsetY + pan.y };
            });
        },
        onWheel: (factor, at, rect) => setView((v) => zoomAround(v, factor, at.x, at.y, { width: rect.width, height: rect.height })),
        onTap: pickObject,
    });

    /*
     * Tastatur: Pfeile verschieben, +/- zoomen, 0 setzt zurueck,
     * Leertaste startet den Zeitraffer, / sucht, N = jetzt, R = Nachtsicht.
     */
    const pan = (dx: number, dy: number) => () => setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
    const zoomKey = (factor: number) => () => setView((v) => zoomAround(v, factor, sizeRef.current.width / 2, sizeRef.current.height / 2, sizeRef.current));
    useKeyboardShortcuts({
        Escape: () => { setSelectedId(null); setSelectedConstellationId(null); setQuery(""); setPickingLocation(false); },
        ArrowLeft: pan(60, 0),
        ArrowRight: pan(-60, 0),
        ArrowUp: pan(0, 60),
        ArrowDown: pan(0, -60),
        "+": zoomKey(1.25),
        "=": zoomKey(1.25),
        "-": zoomKey(1 / 1.25),
        "0": () => setView(DEFAULT_VIEW),
        " ": togglePlay,
        "/": () => searchInputRef.current?.focus(),
        n: goLive,
        r: () => setNightMode((current) => !current),
    });

    function toggleMobilePanel(panel: Exclude<MobilePanel, "none">) {
        setMobilePanel((current) => (current === panel ? "none" : panel));
    }

    const moonUp = moonObject ? frame.toHorizontal(moonObject.ra, moonObject.dec).altitude > 0 : false;
    const timeStatus = liveTime ? "LIVE SKY" : playing ? `TIME LAPSE · ${SPEEDS.find(([value]) => value === playSpeed)?.[1] ?? ""}` : "TIME SHIFT";
    const horizonBadge = arStatus ? arStatus.toUpperCase() : arActive ? "AR · HOLD YOUR PHONE UP TO THE SKY" : "LOOK AROUND · DRAG TO TURN, ZOOM FOR BINOCULARS";
    const domeBadge = sunAltitude > 0 ? "SKY NOW · DAYLIGHT – STARS NOT VISIBLE TO THE EYE"
        : sunAltitude > -18 ? "SKY NOW · TWILIGHT · ZENITH CENTER, NORTH UP"
            : "SKY NOW · ZENITH CENTER · NORTH UP, EAST LEFT";
    const earthBadge = pickingLocation ? "CLICK ON THE EARTH TO SET YOUR POSITION · ESC CANCELS"
        : `EARTH ${earthKind === "globe" ? "GLOBE · DRAG TO ROTATE" : "MAP · DRAG TO PAN"} · THE SKY PROJECTED ONTO THE GROUND`;

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
                    <button className="stars-night-toggle" onClick={downloadSnapshot} title="Download this view as an image">
                        Image
                    </button>
                    <button className="stars-night-toggle" onClick={() => void shareView()} title="Copy a link to this view">
                        {shareStatus || "Share"}
                    </button>
                    <button className={`stars-night-toggle${nightMode ? " is-active" : ""}`} onClick={() => setNightMode((current) => !current)} aria-pressed={nightMode} title="Red night vision (R)">
                        Night
                    </button>
                </div>
            </header>

            <section className={`stars-layout${panels.left || isMobile ? "" : " left-collapsed"}${panels.right || isMobile ? "" : " right-collapsed"}`}>
                <NavigatorPanel
                    open={mobilePanel === "navigator"}
                    collapsed={!panels.left && !isMobile}
                    onCollapse={() => setPanels((current) => ({ ...current, left: !current.left }))}
                    searchInputRef={searchInputRef}
                    query={query}
                    onQuery={setQuery}
                    searchResults={searchResults}
                    onPickResult={pickSearchResult}
                    mode={mode}
                    onMode={switchMode}
                    layers={layers}
                    onLayers={setLayers}
                    counts={{ stars: visibleStars.length, planets: planets.length, constellations: catalog.constellations.length, dsos: catalog.dsos.length, smallBodies: minorBodies.length, satellites: brightStates.filter((state) => state.altitude > 0).length, aircraft: planesInSky.length }}
                    magnitudeLimit={magnitudeLimit}
                    onMagnitudeLimit={setMagnitudeLimit}
                    deepStarsLoaded={deepStars.length > 0}
                    names={names}
                    onNames={setNames}
                    observerLabel={observerLabel}
                    placeQuery={placeQuery}
                    onPlaceQuery={setPlaceQuery}
                    onSearchPlace={() => void searchPlace()}
                    placeResults={placeResults}
                    onChoosePlace={choosePlace}
                    latText={latText}
                    lonText={lonText}
                    onLatText={setLatText}
                    onLonText={setLonText}
                    onCommitCoordinates={commitCoordinates}
                    onLocate={locateObserver}
                    onZurich={() => { applyObserver(DEFAULT_OBSERVER, DEFAULT_OBSERVER_LABEL); setLocationStatus(""); }}
                    locationStatus={locationStatus}
                    catalogError={catalogError}
                />

                <div ref={wrapperRef} className={`stars-canvas-wrap${pickingLocation && mode === "earth" ? " is-picking" : ""}${mode === "earth" && earthKind === "globe" ? " is-globe" : ""}`}>
                    <canvas ref={canvasRef} {...gestures} />
                    <div className={`stars-canvas-badge${pickingLocation && mode === "earth" ? " is-picking" : ""}`}>
                        {mode === "sky" ? domeBadge : mode === "earth" ? earthBadge : mode === "horizon" ? horizonBadge : "EQUATORIAL · J2000 CATALOG VIEW"}
                    </div>
                    <div className="stars-view-switch">
                        <div className="stars-segmented" role="group" aria-label="View">
                            <button onClick={() => switchMode("sky")} className={mode === "sky" ? "is-active" : undefined}>Sky</button>
                            <button onClick={() => switchMode("catalog")} className={mode === "catalog" ? "is-active" : undefined}>Catalog</button>
                            <button onClick={() => switchMode("horizon")} className={mode === "horizon" ? "is-active" : undefined}>Look</button>
                            <button onClick={() => switchMode("earth")} className={mode === "earth" ? "is-active" : undefined}>Earth</button>
                        </div>
                        {mode === "horizon" && (
                            <button className={`stars-pick-button${arActive ? " is-active" : ""}`} onClick={() => void toggleAr()} aria-pressed={arActive}>
                                {arActive ? "Stop AR" : "AR (phone)"}
                            </button>
                        )}
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
                        <button className={mobilePanel === "object" ? "is-active" : undefined} onClick={() => toggleMobilePanel("object")}>{selected ? objectName(selected, names) : selectedSatellite ? selectedSatellite.name : selectedAircraft ? selectedAircraft.callsign : "Details"}</button>
                    </div>
                    <div className="stars-canvas-controls">
                        <button onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
                        <button onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
                        <button onClick={() => setView(DEFAULT_VIEW)} aria-label="Reset view">⌂</button>
                    </div>
                </div>

                {panels.right || isMobile ? (
                    <aside className={`stars-panel stars-right-panel${mobilePanel === "object" ? " is-open" : ""}`}>
                        <div className="stars-panel-title">
                            Object Intelligence
                            <button className="stars-collapse-button" onClick={() => setPanels((current) => ({ ...current, right: false }))} aria-label="Hide details panel" title="Hide details">›</button>
                        </div>
                        {selectedSatellite ? (
                            <SatelliteDetails
                                state={selectedSatellite}
                                passes={selectedSatellitePasses}
                                timeZone={timeZone}
                                skyTime={skyTime}
                                siteDark={sunAltitude < -6}
                                onShowOnGlobe={() => {
                                    // Globus ueber den Satelliten drehen.
                                    setMode("earth");
                                    setEarthKind("globe");
                                    setView(DEFAULT_VIEW);
                                    setGlobeCenter({ lat: selectedSatellite.lat, lon: selectedSatellite.lon });
                                }}
                            />
                        ) : selectedAircraft ? (
                            <AircraftDetails plane={selectedAircraft} />
                        ) : (
                        <ObjectDetails
                            selected={selected}
                            selectedConstellation={selectedConstellation}
                            info={infoKey ? skyInfos[infoKey] : undefined}
                            events={selectedEvents}
                            horizontal={selectedHorizontal}
                            moon={moon}
                            lst={frame.lst}
                            skyTime={skyTime}
                            timeZone={timeZone}
                            names={names}
                            onCenterObject={focusObject}
                            onCenterConstellation={focusConstellation}
                        >
                            {selected && (
                                <>
                                    <button
                                        className={`stars-watch-button${watchlist.has(selected.id) ? " is-active" : ""}`}
                                        onClick={() => (watchlist.has(selected.id) ? watchlist.remove(selected.id) : watchlist.add({ id: selected.id, name: objectName(selected, names), kind: selected.kind }))}
                                    >
                                        {watchlist.has(selected.id) ? "★ On my list" : "☆ Add to my list"}
                                    </button>
                                    {selected.id !== "sun" && <AltitudeChart object={selected} observer={observer} night={night} skyTime={skyTime} timeZone={timeZone} />}
                                    {selected.id === "jupiter" && <JupiterMoonsDiagram moons={jupiter.moons} />}
                                </>
                            )}
                            {!selected && selectedConstellation && constellationStars.length > 0 && (
                                <div className="stars-constellation-stars">
                                    <div className="stars-mini-label">Brightest stars</div>
                                    {constellationStars.map((star) => (
                                        <button key={star.id} onClick={() => focusObject(star)}>
                                            <strong>{star.name}</strong>
                                            <span>{star.designation !== star.name ? `${star.designation} · ` : ""}mag {star.magnitude.toFixed(1)}{star.distanceLy ? ` · ${star.distanceLy.toLocaleString("de-CH")} ly` : ""}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ObjectDetails>
                        )}
                        <TimeAndTonight
                            skyTime={skyTime}
                            timeZone={timeZone}
                            liveTime={liveTime}
                            playing={playing}
                            playSpeed={playSpeed}
                            onSetTime={(date) => { setLiveTime(false); setSkyTime(date); }}
                            onShiftTime={shiftTime}
                            onLive={goLive}
                            onTogglePlay={togglePlay}
                            onPlaySpeed={(speed) => { setPlaySpeed(speed); setLiveTime(false); setPlaying(true); }}
                            observerLabel={observerLabel}
                            night={night}
                            moon={moon}
                            moonEvents={moonEvents}
                            moonUp={moonUp}
                            tonight={tonight}
                            selectedId={selectedId}
                            onTonightEntry={showTonightEntry}
                            names={names}
                        />

                        <div className="stars-section-label">Observing score tonight</div>
                        <ScoreCard score={score} bortle={bortle} onBortle={setBortle} timeZone={timeZone} skyTime={skyTime} weatherError={weatherError} />

                        <div className="stars-section-label">Upcoming events</div>
                        <EventsList events={events} timeZone={timeZone} skyTime={skyTime} notify={alerts.enabled} onNotify={() => void alerts.toggle()} notifyStatus={alerts.status} onPick={showEvent} />

                        <div className="stars-section-label">My list · {watchlist.entries.filter((entry) => entry.seen).length}/{watchlist.entries.length} seen</div>
                        {watchlist.entries.length === 0 ? (
                            <p className="stars-muted">Select an object and press “Add to my list”.</p>
                        ) : (
                            <div className="stars-watchlist">
                                {watchlist.entries.map((entry) => (
                                    <div key={entry.id} className={entry.seen ? "is-seen" : undefined}>
                                        <input type="checkbox" checked={entry.seen} onChange={() => watchlist.toggleSeen(entry.id)} aria-label={`Mark ${entry.name} as seen`} />
                                        <button onClick={() => { const object = allObjects.find((item) => item.id === entry.id); if (object) focusObject(object); }}>{entry.name}</button>
                                        <button className="stars-watch-remove" onClick={() => watchlist.remove(entry.id)} aria-label={`Remove ${entry.name}`}>×</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </aside>
                ) : (
                    <aside className="stars-panel stars-right-panel is-collapsed">
                        <button className="stars-collapse-button" onClick={() => setPanels((current) => ({ ...current, right: true }))} aria-label="Show details panel" title="Show details">‹</button>
                    </aside>
                )}
            </section>

            <footer className="stars-footer">
                <span>Drag to pan · Wheel or pinch to zoom · Space plays time · / searches</span>
                <span>Stars, constellations, Milky Way & Messier: d3-celestial · Star data: HYG · Sun, Moon & planets: astronomy-engine</span>
            </footer>
        </main>
    );
}
