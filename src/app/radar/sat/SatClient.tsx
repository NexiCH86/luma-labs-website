"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    category: "station" | "navigation";
};

type SatelliteApiResponse = {
    ok: boolean;
    source: string;
    generatedAt: string;
    count: number;
    satellites: SatelliteRecord[];
    error?: string;
};

type SatRec = unknown;

type Vector = {
    x: number;
    y: number;
    z: number;
};

type PropagationResult = {
    position: Vector;
    velocity: Vector;
};

type SatelliteJs = {
    json2satrec: (record: SatelliteRecord) => SatRec;
    propagate: (
        satrec: SatRec,
        date: Date
    ) => PropagationResult | null;
    gstime: (date: Date) => number;
    eciToGeodetic: (
        position: Vector,
        gmst: number
    ) => {
        longitude: number;
        latitude: number;
        height: number;
    };
    degreesLat: (radians: number) => number;
    degreesLong: (radians: number) => number;
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

const SATELLITE_JS_URL =
    "https://cdn.jsdelivr.net/npm/satellite.js@6.0.2/dist/satellite.min.js";

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function loadSatelliteLibrary(): Promise<SatelliteJs> {
    if (window.satellite) {
        return Promise.resolve(window.satellite);
    }

    return new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
            'script[data-luma-satellite-js="true"]'
        );

        if (existing) {
            existing.addEventListener("load", () => {
                if (window.satellite) {
                    resolve(window.satellite);
                } else {
                    reject(new Error("satellite.js did not initialize"));
                }
            });
            existing.addEventListener("error", () =>
                reject(new Error("satellite.js failed to load"))
            );
            return;
        }

        const script = document.createElement("script");
        script.src = SATELLITE_JS_URL;
        script.async = true;
        script.dataset.lumaSatelliteJs = "true";
        script.onload = () => {
            if (window.satellite) {
                resolve(window.satellite);
            } else {
                reject(new Error("satellite.js did not initialize"));
            }
        };
        script.onerror = () =>
            reject(new Error("satellite.js failed to load"));
        document.head.appendChild(script);
    });
}

function positionFor(
    satellite: SatelliteJs,
    satrec: SatRec,
    date: Date
): LivePosition | null {
    const result = satellite.propagate(satrec, date);

    if (!result) {
        return null;
    }

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(
        result.position,
        gmst
    );

    const latitude = satellite.degreesLat(
        geodetic.latitude
    );
    const longitude = satellite.degreesLong(
        geodetic.longitude
    );

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(geodetic.height)
    ) {
        return null;
    }

    const velocity = result.velocity;
    const speedKmS = Math.sqrt(
        velocity.x ** 2 +
            velocity.y ** 2 +
            velocity.z ** 2
    );

    return {
        latitude,
        longitude,
        altitudeKm: geodetic.height,
        speedKmS,
    };
}

function markerHtml(
    record: SatelliteRecord,
    selected: boolean
) {
    const isStation = record.category === "station";
    const className = isStation
        ? "sat-marker sat-marker-station"
        : "sat-marker sat-marker-navigation";

    return `
        <div class="${className}${selected ? " is-selected" : ""}">
            <span>${isStation ? "◆" : "●"}</span>
        </div>
    `;
}

function formatEpoch(value?: string) {
    if (!value) {
        return "---";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("de-CH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function SatClient() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const leafletRef = useRef<any>(null);
    const satelliteRef = useRef<SatelliteJs | null>(null);
    const markersRef = useRef<Record<string, any>>({});
    const satrecsRef = useRef<Map<number, SatRec>>(new Map());
    const recordsRef = useRef<SatelliteRecord[]>([]);
    const orbitLayerRef = useRef<any>(null);
    const selectedNoradRef = useRef<number | null>(null);

    const [records, setRecords] = useState<SatelliteRecord[]>([]);
    const [selected, setSelected] = useState<SatelliteRecord | null>(null);
    const [selectedPosition, setSelectedPosition] =
        useState<LivePosition | null>(null);
    const [search, setSearch] = useState("");
    const [searchError, setSearchError] = useState("");
    const [updatedAt, setUpdatedAt] = useState("");
    const [status, setStatus] = useState("INITIALIZING SAT NETWORK...");
    const [error, setError] = useState("");

    const drawOrbit = useCallback(
        (record: SatelliteRecord) => {
            const map = mapRef.current;
            const L = leafletRef.current;
            const satellite = satelliteRef.current;
            const norad = record.NORAD_CAT_ID;

            if (!map || !L || !satellite || norad == null) {
                return;
            }

            orbitLayerRef.current?.remove();
            orbitLayerRef.current = null;

            const satrec = satrecsRef.current.get(norad);

            if (!satrec) {
                return;
            }

            const now = Date.now();
            const points: [number, number][] = [];

            for (let minutes = -90; minutes <= 90; minutes += 3) {
                const position = positionFor(
                    satellite,
                    satrec,
                    new Date(now + minutes * 60_000)
                );

                if (position) {
                    points.push([
                        position.latitude,
                        position.longitude,
                    ]);
                }
            }

            const segments: [number, number][][] = [];
            let segment: [number, number][] = [];

            for (const point of points) {
                const previous = segment.at(-1);

                if (
                    previous &&
                    Math.abs(previous[1] - point[1]) > 180
                ) {
                    if (segment.length > 1) {
                        segments.push(segment);
                    }
                    segment = [];
                }

                segment.push(point);
            }

            if (segment.length > 1) {
                segments.push(segment);
            }

            orbitLayerRef.current = L.polyline(segments, {
                color:
                    record.category === "station"
                        ? "#5be7e0"
                        : "#8fa7ff",
                weight: 2,
                opacity: 0.62,
                dashArray: "8 8",
            }).addTo(map);
        },
        []
    );

    const selectSatellite = useCallback(
        (record: SatelliteRecord, fly = true) => {
            const norad = record.NORAD_CAT_ID;

            if (norad == null) {
                return;
            }

            selectedNoradRef.current = norad;
            setSelected(record);
            setSearchError("");
            drawOrbit(record);

            const satellite = satelliteRef.current;
            const satrec = satrecsRef.current.get(norad);

            if (satellite && satrec) {
                const position = positionFor(
                    satellite,
                    satrec,
                    new Date()
                );
                setSelectedPosition(position);

                if (position && fly && mapRef.current) {
                    mapRef.current.flyTo(
                        [position.latitude, position.longitude],
                        5,
                        { duration: 1.2 }
                    );
                }
            }
        },
        [drawOrbit]
    );

    const updatePositions = useCallback(() => {
        const map = mapRef.current;
        const L = leafletRef.current;
        const satellite = satelliteRef.current;

        if (!map || !L || !satellite) {
            return;
        }

        const now = new Date();
        const active = new Set<string>();

        for (const record of recordsRef.current) {
            const norad = record.NORAD_CAT_ID;

            if (norad == null) {
                continue;
            }

            const satrec = satrecsRef.current.get(norad);

            if (!satrec) {
                continue;
            }

            const position = positionFor(satellite, satrec, now);

            if (!position) {
                continue;
            }

            const key = String(norad);
            active.add(key);
            const isSelected = selectedNoradRef.current === norad;
            const icon = L.divIcon({
                className: "sat-marker-wrapper",
                html: markerHtml(record, isSelected),
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            let marker = markersRef.current[key];

            if (!marker) {
                marker = L.marker(
                    [position.latitude, position.longitude],
                    { icon }
                ).addTo(map);

                marker.bindTooltip(
                    `<strong>${escapeHtml(record.OBJECT_NAME ?? `NORAD ${norad}`)}</strong><br>NORAD ${norad}`,
                    {
                        direction: "top",
                        offset: [0, -10],
                        opacity: 0.92,
                    }
                );

                marker.on("click", () =>
                    selectSatellite(record, false)
                );

                markersRef.current[key] = marker;
            } else {
                marker.setLatLng([
                    position.latitude,
                    position.longitude,
                ]);
                marker.setIcon(icon);
            }

            if (isSelected) {
                setSelectedPosition(position);
            }
        }

        for (const [key, marker] of Object.entries(
            markersRef.current
        )) {
            if (!active.has(key)) {
                marker.remove();
                delete markersRef.current[key];
            }
        }

        setUpdatedAt(
            now.toLocaleTimeString("de-CH", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })
        );
    }, [selectSatellite]);

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

                if (cancelled || !mapContainer.current) {
                    return;
                }

                leafletRef.current = L;
                satelliteRef.current = satellite;

                const map = L.map(mapContainer.current, {
                    zoomControl: true,
                    minZoom: 2,
                    maxZoom: 12,
                    worldCopyJump: true,
                }).setView([24, 8], 3);

                L.tileLayer(
                    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                    {
                        maxZoom: 20,
                        attribution: "© OpenStreetMap © CARTO",
                    }
                ).addTo(map);

                mapRef.current = map;

                const response = await fetch(
                    "/api/radar/satellites",
                    { cache: "no-store" }
                );
                const data =
                    (await response.json()) as SatelliteApiResponse;

                if (!response.ok || !data.ok) {
                    throw new Error(
                        data.error ?? "Satellite data unavailable"
                    );
                }

                recordsRef.current = data.satellites;
                setRecords(data.satellites);

                for (const record of data.satellites) {
                    if (record.NORAD_CAT_ID == null) {
                        continue;
                    }

                    try {
                        satrecsRef.current.set(
                            record.NORAD_CAT_ID,
                            satellite.json2satrec(record)
                        );
                    } catch (satError) {
                        console.warn(
                            "SAT record skipped:",
                            record.OBJECT_NAME,
                            satError
                        );
                    }
                }

                setStatus(
                    `${data.satellites.length} OBJECTS ONLINE · ${data.source}`
                );

                updatePositions();
                timer = setInterval(updatePositions, 1000);
            } catch (initializeError) {
                console.error("SAT initialize error:", initializeError);
                setError(
                    initializeError instanceof Error
                        ? initializeError.message
                        : "SAT initialization failed"
                );
                setStatus("SAT NETWORK OFFLINE");
            }
        }

        initialize();

        return () => {
            cancelled = true;

            if (timer) {
                clearInterval(timer);
            }

            orbitLayerRef.current?.remove();
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [updatePositions]);

    function runSearch() {
        const query = search.trim().toUpperCase();
        setSearchError("");

        if (!query) {
            return;
        }

        const match = records.find((record) => {
            const name = (record.OBJECT_NAME ?? "").toUpperCase();
            const objectId = (record.OBJECT_ID ?? "").toUpperCase();
            const norad = String(record.NORAD_CAT_ID ?? "");

            return (
                name.includes(query) ||
                objectId.includes(query) ||
                norad === query
            );
        });

        if (!match) {
            setSearchError("SATELLITE NOT FOUND");
            return;
        }

        selectSatellite(match);
    }

    function fullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    const stationCount = records.filter(
        (record) => record.category === "station"
    ).length;
    const navigationCount = records.filter(
        (record) => record.category === "navigation"
    ).length;

    return (
        <main className="radar-shell sat-shell">
            <header className="radar-header">
                <a href="/" className="radar-brand">
                    <div>
                        LuMa<span>RADAR</span>
                    </div>
                    <small>LIVE SATELLITE NETWORK</small>
                </a>

                <div className="radar-search-wrapper">
                    <div className="radar-search">
                        <input
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setSearchError("");
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    runSearch();
                                }
                            }}
                            placeholder="Satellit / NORAD / Object ID suchen..."
                        />
                        <button onClick={runSearch}>SEARCH</button>
                    </div>
                    {searchError && (
                        <div className="radar-search-error">
                            {searchError}
                        </div>
                    )}
                </div>

                <a href="/" className="back-button">
                    ← LUMA LABS
                </a>
                <button
                    className="fullscreen-button"
                    onClick={fullscreen}
                >
                    FULLSCREEN
                </button>
            </header>

            <section className="radar-main sat-main">
                <div ref={mapContainer} className="radar-map" />

                <aside className="radar-panel sat-panel">
                    <div className="live-status">
                        <span />
                        SAT LIVE
                    </div>

                    <div className="radar-count">
                        <small>SATELLITES TRACKED</small>
                        <strong>{records.length}</strong>
                    </div>

                    <div className="sat-network-stats">
                        <div>
                            <small>STATIONS</small>
                            <strong>{stationCount}</strong>
                        </div>
                        <div>
                            <small>GPS OPS</small>
                            <strong>{navigationCount}</strong>
                        </div>
                    </div>

                    {selected ? (
                        <div className="sat-details">
                            <div className="sat-selected-header">
                                <div>
                                    <small>
                                        {selected.category === "station"
                                            ? "ORBITAL STATION"
                                            : "NAVIGATION SATELLITE"}
                                    </small>
                                    <h2>
                                        {selected.OBJECT_NAME ??
                                            `NORAD ${selected.NORAD_CAT_ID}`}
                                    </h2>
                                    <p>
                                        NORAD {selected.NORAD_CAT_ID ?? "---"}
                                    </p>
                                </div>
                                <b>◉</b>
                            </div>

                            <div className="sat-grid">
                                <div>
                                    <small>ALTITUDE</small>
                                    <strong>
                                        {selectedPosition
                                            ? `${Math.round(
                                                  selectedPosition.altitudeKm
                                              ).toLocaleString("de-CH")} km`
                                            : "---"}
                                    </strong>
                                </div>
                                <div>
                                    <small>SPEED</small>
                                    <strong>
                                        {selectedPosition
                                            ? `${selectedPosition.speedKmS.toFixed(
                                                  2
                                              )} km/s`
                                            : "---"}
                                    </strong>
                                </div>
                                <div>
                                    <small>LATITUDE</small>
                                    <strong>
                                        {selectedPosition
                                            ? `${selectedPosition.latitude.toFixed(
                                                  3
                                              )}°`
                                            : "---"}
                                    </strong>
                                </div>
                                <div>
                                    <small>LONGITUDE</small>
                                    <strong>
                                        {selectedPosition
                                            ? `${selectedPosition.longitude.toFixed(
                                                  3
                                              )}°`
                                            : "---"}
                                    </strong>
                                </div>
                                <div>
                                    <small>INCLINATION</small>
                                    <strong>
                                        {selected.INCLINATION != null
                                            ? `${selected.INCLINATION.toFixed(2)}°`
                                            : "---"}
                                    </strong>
                                </div>
                                <div>
                                    <small>ORBIT PERIOD</small>
                                    <strong>
                                        {selected.MEAN_MOTION
                                            ? `${(
                                                  1440 /
                                                  selected.MEAN_MOTION
                                              ).toFixed(1)} min`
                                            : "---"}
                                    </strong>
                                </div>
                            </div>

                            <div className="sat-meta">
                                <div>
                                    <small>OBJECT ID</small>
                                    <span>{selected.OBJECT_ID ?? "---"}</span>
                                </div>
                                <div>
                                    <small>ELEMENT EPOCH</small>
                                    <span>{formatEpoch(selected.EPOCH)}</span>
                                </div>
                            </div>

                            <p className="sat-orbit-note">
                                Das gestrichelte Band zeigt ca. 90 Minuten
                                Vergangenheit und 90 Minuten Zukunft auf Basis
                                der aktuellen OMM/SGP4-Orbitdaten.
                            </p>
                        </div>
                    ) : (
                        <div className="sat-empty-state">
                            <b>◎</b>
                            <h3>SATELLITE SELECT</h3>
                            <p>
                                Klicke einen Satelliten auf der Weltkarte oder
                                suche nach Name bzw. NORAD-ID.
                            </p>
                        </div>
                    )}

                    <div className="sat-status-line">
                        <span>{status}</span>
                        {updatedAt && <small>POS {updatedAt}</small>}
                    </div>

                    {error && (
                        <div className="sat-error">{error}</div>
                    )}
                </aside>
            </section>
        </main>
    );
}
