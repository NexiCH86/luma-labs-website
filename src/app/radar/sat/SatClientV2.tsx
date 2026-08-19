"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SatCategory = "station" | "navigation" | "constellation" | "weather" | "earth";

type SatelliteRecord = {
    OBJECT_NAME?: string;
    OBJECT_ID?: string;
    EPOCH?: string;
    MEAN_MOTION?: number;
    ECCENTRICITY?: number;
    INCLINATION?: number;
    RA_OF_ASC_NODE?: number;
    ARG_OF_PERICENTER?: number;
    MEAN_ANOMALY?: number;
    EPHEMERIS_TYPE?: number;
    CLASSIFICATION_TYPE?: string;
    NORAD_CAT_ID?: number;
    ELEMENT_SET_NO?: number;
    REV_AT_EPOCH?: number;
    BSTAR?: number;
    MEAN_MOTION_DOT?: number;
    MEAN_MOTION_DDOT?: number;
    category: SatCategory;
    group: string;
    groupLabel: string;
};

type SatelliteApiResponse = {
    ok: boolean;
    source: string;
    generatedAt: string;
    count: number;
    satellites: SatelliteRecord[];
    error?: string;
};

type Vector = { x: number; y: number; z: number };
type SatRec = unknown;

type SatelliteJs = {
    json2satrec: (record: SatelliteRecord) => SatRec;
    propagate: (satrec: SatRec, date: Date) => { position: Vector; velocity: Vector } | null;
    gstime: (date: Date) => number;
    eciToGeodetic: (position: Vector, gmst: number) => {
        longitude: number;
        latitude: number;
        height: number;
    };
    eciToEcf: (position: Vector, gmst: number) => Vector;
    ecfToLookAngles: (
        observer: { longitude: number; latitude: number; height: number },
        positionEcf: Vector
    ) => { azimuth: number; elevation: number; rangeSat: number };
    degreesLat: (radians: number) => number;
    degreesLong: (radians: number) => number;
    radiansLat: (degrees: number) => number;
    radiansLong: (degrees: number) => number;
};

declare global {
    interface Window {
        satellite?: SatelliteJs;
    }
}

type LivePosition = {
    latitude: number;
    longitude: number;
    altitudeKm: number;
    speedKmS: number;
};

type Observer = {
    latitude: number;
    longitude: number;
    altitudeKm: number;
};

type LookAngles = {
    azimuthDeg: number;
    elevationDeg: number;
    rangeKm: number;
};

type PassPrediction = {
    rise: Date;
    peak: Date;
    set: Date;
    peakElevationDeg: number;
};

type GroupDefinition = {
    key: string;
    label: string;
    category: SatCategory;
    defaultOn?: boolean;
};

const GROUPS: GroupDefinition[] = [
    { key: "STATIONS", label: "Stations", category: "station", defaultOn: true },
    { key: "GPS-OPS", label: "GPS", category: "navigation", defaultOn: true },
    { key: "GLO-OPS", label: "GLONASS", category: "navigation" },
    { key: "GALILEO", label: "Galileo", category: "navigation" },
    { key: "BEIDOU", label: "BeiDou", category: "navigation" },
    { key: "STARLINK", label: "Starlink", category: "constellation" },
    { key: "WEATHER", label: "Weather", category: "weather" },
    { key: "RESOURCE", label: "Earth", category: "earth" },
];

const SATELLITE_JS_URL =
    "https://cdn.jsdelivr.net/npm/satellite.js@6.0.2/dist/satellite.min.js";

function loadSatelliteLibrary(): Promise<SatelliteJs> {
    if (window.satellite) return Promise.resolve(window.satellite);

    return new Promise((resolve, reject) => {
        const current = document.querySelector<HTMLScriptElement>(
            'script[data-luma-satellite-js="true"]'
        );

        if (current) {
            current.addEventListener("load", () =>
                window.satellite
                    ? resolve(window.satellite)
                    : reject(new Error("satellite.js did not initialize"))
            );
            current.addEventListener("error", () => reject(new Error("satellite.js failed to load")));
            return;
        }

        const script = document.createElement("script");
        script.src = SATELLITE_JS_URL;
        script.async = true;
        script.dataset.lumaSatelliteJs = "true";
        script.onload = () =>
            window.satellite
                ? resolve(window.satellite)
                : reject(new Error("satellite.js did not initialize"));
        script.onerror = () => reject(new Error("satellite.js failed to load"));
        document.head.appendChild(script);
    });
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function positionFor(satellite: SatelliteJs, satrec: SatRec, date: Date): LivePosition | null {
    const result = satellite.propagate(satrec, date);
    if (!result) return null;

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(result.position, gmst);
    const latitude = satellite.degreesLat(geodetic.latitude);
    const longitude = satellite.degreesLong(geodetic.longitude);

    if (![latitude, longitude, geodetic.height].every(Number.isFinite)) return null;

    const speedKmS = Math.sqrt(
        result.velocity.x ** 2 + result.velocity.y ** 2 + result.velocity.z ** 2
    );

    return { latitude, longitude, altitudeKm: geodetic.height, speedKmS };
}

function lookAnglesFor(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer,
    date: Date
): LookAngles | null {
    const result = satellite.propagate(satrec, date);
    if (!result) return null;

    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(result.position, gmst);
    const look = satellite.ecfToLookAngles(
        {
            longitude: satellite.radiansLong(observer.longitude),
            latitude: satellite.radiansLat(observer.latitude),
            height: observer.altitudeKm,
        },
        ecf
    );

    return {
        azimuthDeg: (look.azimuth * 180) / Math.PI,
        elevationDeg: (look.elevation * 180) / Math.PI,
        rangeKm: look.rangeSat,
    };
}

function predictNextPass(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer
): PassPrediction | null {
    const start = Date.now();
    const end = start + 24 * 60 * 60_000;
    const step = 60_000;

    let previousElevation = lookAnglesFor(satellite, satrec, observer, new Date(start))?.elevationDeg ?? -90;
    let rise: Date | null = previousElevation >= 0 ? new Date(start) : null;
    let peak: Date | null = rise;
    let peakElevation = previousElevation;

    for (let time = start + step; time <= end; time += step) {
        const look = lookAnglesFor(satellite, satrec, observer, new Date(time));
        if (!look) continue;

        const elevation = look.elevationDeg;

        if (!rise && previousElevation < 0 && elevation >= 0) {
            rise = new Date(time);
            peak = new Date(time);
            peakElevation = elevation;
        }

        if (rise && elevation > peakElevation) {
            peakElevation = elevation;
            peak = new Date(time);
        }

        if (rise && previousElevation >= 0 && elevation < 0) {
            return {
                rise,
                peak: peak ?? rise,
                set: new Date(time),
                peakElevationDeg: peakElevation,
            };
        }

        previousElevation = elevation;
    }

    return null;
}

function categoryClass(category: SatCategory) {
    return `sat2-marker sat2-marker-${category}`;
}

function markerHtml(record: SatelliteRecord, selected: boolean) {
    const isIss = record.NORAD_CAT_ID === 25544;
    const symbol = isIss
        ? "ISS"
        : record.category === "station"
          ? "◆"
          : record.category === "navigation"
            ? "●"
            : record.category === "constellation"
              ? "✦"
              : record.category === "weather"
                ? "◈"
                : "◇";

    return `<div class="${categoryClass(record.category)}${selected ? " is-selected" : ""}${isIss ? " is-iss" : ""}"><span>${symbol}</span></div>`;
}

function formatEpoch(value?: string) {
    if (!value) return "---";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

function fmtTime(date?: Date | null) {
    return date
        ? date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
        : "---";
}

export default function SatClientV2() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const satelliteRef = useRef<SatelliteJs | null>(null);
    const markersRef = useRef<Record<string, any>>({});
    const satrecsRef = useRef<Map<number, SatRec>>(new Map());
    const recordsByGroupRef = useRef<Map<string, SatelliteRecord[]>>(new Map());
    const orbitLayerRef = useRef<any>(null);
    const observerMarkerRef = useRef<any>(null);
    const selectedNoradRef = useRef<number | null>(null);
    const enabledGroupsRef = useRef<Set<string>>(new Set(["STATIONS", "GPS-OPS"]));

    const [enabledGroups, setEnabledGroups] = useState<Set<string>>(
        new Set(GROUPS.filter((g) => g.defaultOn).map((g) => g.key))
    );
    const [records, setRecords] = useState<SatelliteRecord[]>([]);
    const [selected, setSelected] = useState<SatelliteRecord | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<LivePosition | null>(null);
    const [observer, setObserver] = useState<Observer | null>(null);
    const [lookAngles, setLookAngles] = useState<LookAngles | null>(null);
    const [nextPass, setNextPass] = useState<PassPrediction | null>(null);
    const [search, setSearch] = useState("");
    const [searchError, setSearchError] = useState("");
    const [status, setStatus] = useState("INITIALIZING SAT NETWORK...");
    const [updatedAt, setUpdatedAt] = useState("");
    const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());
    const [error, setError] = useState("");

    useEffect(() => {
        enabledGroupsRef.current = enabledGroups;
    }, [enabledGroups]);

    const rebuildRecords = useCallback(() => {
        const byNorad = new Map<number, SatelliteRecord>();

        for (const group of enabledGroupsRef.current) {
            const groupRecords = recordsByGroupRef.current.get(group) ?? [];
            for (const record of groupRecords) {
                if (record.NORAD_CAT_ID != null) byNorad.set(record.NORAD_CAT_ID, record);
            }
        }

        const merged = Array.from(byNorad.values());
        setRecords(merged);
        setStatus(`${merged.length.toLocaleString("de-CH")} OBJECTS ONLINE`);
    }, []);

    const loadGroup = useCallback(async (group: string) => {
        if (recordsByGroupRef.current.has(group)) return;

        setLoadingGroups((current) => new Set(current).add(group));
        try {
            const response = await fetch(
                `/api/radar/satellites?groups=${encodeURIComponent(group)}`,
                { cache: "no-store" }
            );
            const data = (await response.json()) as SatelliteApiResponse;
            if (!response.ok || !data.ok) throw new Error(data.error ?? `Could not load ${group}`);

            recordsByGroupRef.current.set(group, data.satellites);
            const satellite = satelliteRef.current;
            if (satellite) {
                for (const record of data.satellites) {
                    if (record.NORAD_CAT_ID == null || satrecsRef.current.has(record.NORAD_CAT_ID)) continue;
                    try {
                        satrecsRef.current.set(record.NORAD_CAT_ID, satellite.json2satrec(record));
                    } catch {
                        // Invalid orbital record: skip silently.
                    }
                }
            }
        } finally {
            setLoadingGroups((current) => {
                const next = new Set(current);
                next.delete(group);
                return next;
            });
        }
    }, []);

    const drawOrbit = useCallback((record: SatelliteRecord) => {
        const map = mapRef.current;
        const L = leafletRef.current;
        const satellite = satelliteRef.current;
        const norad = record.NORAD_CAT_ID;
        if (!map || !L || !satellite || norad == null) return;

        orbitLayerRef.current?.remove();
        const satrec = satrecsRef.current.get(norad);
        if (!satrec) return;

        const periodMinutes = record.MEAN_MOTION && record.MEAN_MOTION > 0
            ? 1440 / record.MEAN_MOTION
            : 100;
        const spanMinutes = Math.min(720, Math.max(100, Math.ceil(periodMinutes * 1.2)));
        const stepMinutes = Math.max(1, Math.round(spanMinutes / 120));
        const start = Date.now() - (spanMinutes / 2) * 60_000;
        const points: [number, number][] = [];

        for (let minute = 0; minute <= spanMinutes; minute += stepMinutes) {
            const pos = positionFor(satellite, satrec, new Date(start + minute * 60_000));
            if (pos) points.push([pos.latitude, pos.longitude]);
        }

        const segments: [number, number][][] = [];
        let segment: [number, number][] = [];
        for (const point of points) {
            const previous = segment.at(-1);
            if (previous && Math.abs(previous[1] - point[1]) > 180) {
                if (segment.length > 1) segments.push(segment);
                segment = [];
            }
            segment.push(point);
        }
        if (segment.length > 1) segments.push(segment);

        orbitLayerRef.current = L.polyline(segments, {
            color: record.NORAD_CAT_ID === 25544 ? "#ffd166" : "#5be7e0",
            weight: record.NORAD_CAT_ID === 25544 ? 3 : 2,
            opacity: 0.72,
            dashArray: "8 8",
        }).addTo(map);
    }, []);

    const refreshObserverData = useCallback((record: SatelliteRecord | null, obs: Observer | null) => {
        const satellite = satelliteRef.current;
        if (!satellite || !record || !obs || record.NORAD_CAT_ID == null) {
            setLookAngles(null);
            setNextPass(null);
            return;
        }

        const satrec = satrecsRef.current.get(record.NORAD_CAT_ID);
        if (!satrec) return;

        setLookAngles(lookAnglesFor(satellite, satrec, obs, new Date()));
        setNextPass(predictNextPass(satellite, satrec, obs));
    }, []);

    const selectSatellite = useCallback((record: SatelliteRecord, fly = true) => {
        const norad = record.NORAD_CAT_ID;
        if (norad == null) return;

        selectedNoradRef.current = norad;
        setSelected(record);
        setSearchError("");
        drawOrbit(record);

        const satellite = satelliteRef.current;
        const satrec = satrecsRef.current.get(norad);
        if (satellite && satrec) {
            const position = positionFor(satellite, satrec, new Date());
            setSelectedPosition(position);
            if (position && fly && mapRef.current) {
                mapRef.current.flyTo([position.latitude, position.longitude], 5, { duration: 1.2 });
            }
        }

        refreshObserverData(record, observer);
    }, [drawOrbit, observer, refreshObserverData]);

    const updatePositions = useCallback(() => {
        const map = mapRef.current;
        const L = leafletRef.current;
        const satellite = satelliteRef.current;
        if (!map || !L || !satellite) return;

        const now = new Date();
        const active = new Set<string>();

        for (const record of records) {
            const norad = record.NORAD_CAT_ID;
            if (norad == null) continue;
            const satrec = satrecsRef.current.get(norad);
            if (!satrec) continue;
            const position = positionFor(satellite, satrec, now);
            if (!position) continue;

            const key = String(norad);
            active.add(key);
            const isSelected = selectedNoradRef.current === norad;
            const isIss = norad === 25544;
            const icon = L.divIcon({
                className: "sat2-marker-wrapper",
                html: markerHtml(record, isSelected),
                iconSize: isIss ? [42, 28] : [24, 24],
                iconAnchor: isIss ? [21, 14] : [12, 12],
            });

            let marker = markersRef.current[key];
            if (!marker) {
                marker = L.marker([position.latitude, position.longitude], {
                    icon,
                    zIndexOffset: isIss ? 1000 : 0,
                }).addTo(map);
                marker.bindTooltip(
                    `<strong>${escapeHtml(record.OBJECT_NAME ?? `NORAD ${norad}`)}</strong><br>${escapeHtml(record.groupLabel)} · NORAD ${norad}`,
                    { direction: "top", offset: [0, -10], opacity: 0.94 }
                );
                marker.on("click", () => selectSatellite(record, false));
                markersRef.current[key] = marker;
            } else {
                marker.setLatLng([position.latitude, position.longitude]);
                marker.setIcon(icon);
            }

            if (isSelected) {
                setSelectedPosition(position);
                if (observer) setLookAngles(lookAnglesFor(satellite, satrec, observer, now));
            }
        }

        for (const [key, marker] of Object.entries(markersRef.current)) {
            if (!active.has(key)) {
                marker.remove();
                delete markersRef.current[key];
            }
        }

        setUpdatedAt(now.toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }));
    }, [observer, records, selectSatellite]);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setInterval> | null = null;

        async function initialize() {
            try {
                const [L, satellite] = await Promise.all([
                    import("leaflet"),
                    loadSatelliteLibrary(),
                ]);
                await import("leaflet/dist/leaflet.css");
                if (cancelled || !mapContainer.current) return;

                leafletRef.current = L;
                satelliteRef.current = satellite;

                const map = L.map(mapContainer.current, {
                    zoomControl: true,
                    minZoom: 2,
                    maxZoom: 13,
                    worldCopyJump: true,
                }).setView([24, 8], 3);

                L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                    maxZoom: 20,
                    attribution: "© OpenStreetMap © CARTO",
                }).addTo(map);
                mapRef.current = map;

                await Promise.all([loadGroup("STATIONS"), loadGroup("GPS-OPS")]);
                if (cancelled) return;
                rebuildRecords();
                setStatus("SAT NETWORK ONLINE");
            } catch (err) {
                console.error("SAT v2 initialize error:", err);
                setError(err instanceof Error ? err.message : "SAT initialization failed");
                setStatus("SAT NETWORK OFFLINE");
            }
        }

        initialize();
        timer = setInterval(() => updatePositions(), 1000);

        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
            orbitLayerRef.current?.remove();
            observerMarkerRef.current?.remove();
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [loadGroup, rebuildRecords, updatePositions]);

    useEffect(() => {
        updatePositions();
    }, [records, updatePositions]);

    async function toggleGroup(group: string) {
        const next = new Set(enabledGroups);
        if (next.has(group)) {
            next.delete(group);
        } else {
            next.add(group);
            if (!recordsByGroupRef.current.has(group)) {
                try {
                    await loadGroup(group);
                } catch (err) {
                    setError(err instanceof Error ? err.message : `Could not load ${group}`);
                    return;
                }
            }
        }
        enabledGroupsRef.current = next;
        setEnabledGroups(next);
        rebuildRecords();
    }

    function runSearch() {
        const query = search.trim().toUpperCase();
        setSearchError("");
        if (!query) return;

        const match = records.find((record) => {
            const name = (record.OBJECT_NAME ?? "").toUpperCase();
            const objectId = (record.OBJECT_ID ?? "").toUpperCase();
            return name.includes(query) || objectId.includes(query) || String(record.NORAD_CAT_ID ?? "") === query;
        });

        if (!match) {
            setSearchError("SATELLITE NOT FOUND IN ACTIVE GROUPS");
            return;
        }
        selectSatellite(match);
    }

    function locateObserver() {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by this browser");
            return;
        }

        setStatus("REQUESTING OBSERVER LOCATION...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const obs: Observer = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    altitudeKm: Math.max(0, (position.coords.altitude ?? 0) / 1000),
                };
                setObserver(obs);
                setStatus("OBSERVER LOCATION ACTIVE");

                const L = leafletRef.current;
                const map = mapRef.current;
                if (L && map) {
                    observerMarkerRef.current?.remove();
                    const icon = L.divIcon({
                        className: "sat2-observer-wrapper",
                        html: '<div class="sat2-observer"><span></span><b>YOU</b></div>',
                        iconSize: [52, 28],
                        iconAnchor: [10, 14],
                    });
                    observerMarkerRef.current = L.marker([obs.latitude, obs.longitude], {
                        icon,
                        zIndexOffset: 2000,
                    }).addTo(map);
                    map.flyTo([obs.latitude, obs.longitude], Math.max(map.getZoom(), 4), { duration: 1 });
                }
                refreshObserverData(selected, obs);
            },
            (geoError) => {
                setError(`Location unavailable: ${geoError.message}`);
                setStatus("LOCATION NOT ACTIVE");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    }

    function fullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    }

    const groupCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const record of records) counts[record.group] = (counts[record.group] ?? 0) + 1;
        return counts;
    }, [records]);

    const visibleNow = lookAngles ? lookAngles.elevationDeg > 0 : false;
    const orbitalPeriod = selected?.MEAN_MOTION && selected.MEAN_MOTION > 0
        ? 1440 / selected.MEAN_MOTION
        : null;

    return (
        <main className="radar-shell sat-shell sat2-shell">
            <header className="radar-header sat2-header">
                <a href="/" className="radar-brand">
                    <div>LuMa<span>RADAR</span></div>
                    <small>LIVE SATELLITE NETWORK</small>
                </a>

                <div className="radar-search-wrapper">
                    <div className="radar-search">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && runSearch()}
                            placeholder="Satellit / NORAD / Object ID suchen..."
                        />
                        <button onClick={runSearch}>SEARCH</button>
                    </div>
                    {searchError && <div className="radar-search-error">{searchError}</div>}
                </div>

                <button className="sat2-location-button" onClick={locateObserver}>
                    {observer ? "LOCATION ✓" : "MY LOCATION"}
                </button>
                <a href="/" className="back-button">← LUMA LABS</a>
                <button className="fullscreen-button" onClick={fullscreen}>FULLSCREEN</button>
            </header>

            <section className="radar-main sat-main sat2-main">
                <div ref={mapContainer} className="radar-map" />

                <div className="sat2-filter-panel">
                    <div className="sat2-filter-title">
                        <strong>NETWORKS</strong>
                        <span>{records.length.toLocaleString("de-CH")} active</span>
                    </div>
                    <div className="sat2-filter-grid">
                        {GROUPS.map((group) => {
                            const on = enabledGroups.has(group.key);
                            const loading = loadingGroups.has(group.key);
                            return (
                                <button
                                    key={group.key}
                                    className={`sat2-filter ${on ? "is-on" : ""}`}
                                    onClick={() => toggleGroup(group.key)}
                                    disabled={loading}
                                >
                                    <span className={`sat2-filter-dot cat-${group.category}`} />
                                    <b>{loading ? "LOADING…" : group.label}</b>
                                    <small>{on ? groupCounts[group.key] ?? "✓" : "+"}</small>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <aside className="radar-panel sat-panel sat2-panel">
                    <div className="live-status"><span />SAT LIVE</div>
                    <div className="radar-count">
                        <small>SATELLITES TRACKED</small>
                        <strong>{records.length.toLocaleString("de-CH")}</strong>
                    </div>

                    {selected ? (
                        <div className="sat2-details">
                            <div className="sat2-selected-header">
                                <div>
                                    <span>{selected.groupLabel}</span>
                                    <h2>{selected.OBJECT_NAME ?? `NORAD ${selected.NORAD_CAT_ID}`}</h2>
                                    <p>NORAD {selected.NORAD_CAT_ID ?? "---"} · {selected.OBJECT_ID ?? "NO OBJECT ID"}</p>
                                </div>
                                <div className={selected.NORAD_CAT_ID === 25544 ? "sat2-iss-badge" : "sat2-orbit-badge"}>
                                    {selected.NORAD_CAT_ID === 25544 ? "ISS" : "◉"}
                                </div>
                            </div>

                            {selectedPosition && (
                                <div className="sat2-metrics">
                                    <div><small>ALTITUDE</small><strong>{selectedPosition.altitudeKm.toFixed(0)} km</strong></div>
                                    <div><small>SPEED</small><strong>{selectedPosition.speedKmS.toFixed(2)} km/s</strong></div>
                                    <div><small>LAT</small><strong>{selectedPosition.latitude.toFixed(2)}°</strong></div>
                                    <div><small>LON</small><strong>{selectedPosition.longitude.toFixed(2)}°</strong></div>
                                </div>
                            )}

                            <div className="sat2-orbit-data">
                                <div><span>Inclination</span><b>{selected.INCLINATION?.toFixed(2) ?? "---"}°</b></div>
                                <div><span>Orbit period</span><b>{orbitalPeriod ? `${orbitalPeriod.toFixed(1)} min` : "---"}</b></div>
                                <div><span>Eccentricity</span><b>{selected.ECCENTRICITY?.toFixed(6) ?? "---"}</b></div>
                                <div><span>Epoch</span><b>{formatEpoch(selected.EPOCH)}</b></div>
                            </div>

                            <div className={`sat2-visibility ${observer ? (visibleNow ? "is-visible" : "is-below") : ""}`}>
                                <div className="sat2-visibility-head">
                                    <strong>OBSERVER / PASS</strong>
                                    <span>{!observer ? "LOCATION REQUIRED" : visibleNow ? "ABOVE HORIZON" : "BELOW HORIZON"}</span>
                                </div>
                                {!observer ? (
                                    <button onClick={locateObserver}>USE MY LOCATION</button>
                                ) : (
                                    <>
                                        <div className="sat2-look-grid">
                                            <div><small>ELEVATION</small><b>{lookAngles ? `${lookAngles.elevationDeg.toFixed(1)}°` : "---"}</b></div>
                                            <div><small>AZIMUTH</small><b>{lookAngles ? `${lookAngles.azimuthDeg.toFixed(0)}°` : "---"}</b></div>
                                            <div><small>RANGE</small><b>{lookAngles ? `${lookAngles.rangeKm.toFixed(0)} km` : "---"}</b></div>
                                        </div>
                                        <div className="sat2-pass-row">
                                            <div><small>NEXT RISE</small><b>{fmtTime(nextPass?.rise)}</b></div>
                                            <div><small>PEAK</small><b>{nextPass ? `${fmtTime(nextPass.peak)} · ${nextPass.peakElevationDeg.toFixed(0)}°` : "---"}</b></div>
                                            <div><small>SET</small><b>{fmtTime(nextPass?.set)}</b></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="sat-empty-state">
                            <b>◎</b>
                            <h3>SATELLITE SELECT</h3>
                            <p>Wähle einen Satelliten auf der Karte oder suche nach Name bzw. NORAD-ID.</p>
                            <p className="sat2-hint">Tipp: Die ISS ist besonders markiert.</p>
                        </div>
                    )}

                    <div className="sat-status-line">
                        <span>{error || status}</span>
                        {updatedAt && <small>POSITION {updatedAt}</small>}
                    </div>
                </aside>
            </section>
        </main>
    );
}
