"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

type Aircraft = {
    icao24: string;
    callsign: string;
    country: string;
    longitude: number;
    latitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    verticalRate: number | null;
    geoAltitude: number | null;
    squawk: string | null;
};

type FlightInfo = {
    found: boolean;
    callsign: string;

    airline?: {
        name: string | null;
        iata: string | null;
        icao: string | null;
    };

    flight?: {
        number: string | null;
        iata: string | null;
        icao: string | null;
    };

    departure?: {
        airport: string | null;
        iata: string | null;
        icao: string | null;
    };

    arrival?: {
        airport: string | null;
        iata: string | null;
        icao: string | null;
    };

    aircraft?: {
        registration: string | null;
        iata: string | null;
        icao: string | null;
    };

    status?: string | null;

    reason?: string;
};

type AirportInfo = {
    found: boolean;

    icao?: string;
    iata?: string | null;
    name?: string | null;

    latitude?: number;
    longitude?: number;
};

type TrackStats = {
    points: number;
    distanceKm: number;
    durationMinutes: number;
};

type PersistentTrackPoint = {
    latitude: number;
    longitude: number;
    altitude?: number | null;
    heading?: number | null;
    velocity?: number | null;
    timestamp?: number | null;
};

type PersistentTrackResponse = {
    icao24: string;
    count: number;
    points: PersistentTrackPoint[];
};

const airports = [
    {
        code: "ZRH",
        name: "Zürich Airport",
        lat: 47.458,
        lon: 8.555,
    },
    {
        code: "BSL",
        name: "EuroAirport Basel",
        lat: 47.59,
        lon: 7.529,
    },
    {
        code: "GVA",
        name: "Geneva Airport",
        lat: 46.238,
        lon: 6.109,
    },
];

const airlineMap: Record<string, string> = {
    SWR: "SWISS",
    EZS: "easyJet Switzerland",
    EJU: "easyJet Europe",
    RYR: "Ryanair",
    DLH: "Lufthansa",
    AFR: "Air France",
    BAW: "British Airways",
    KLM: "KLM",
    UAE: "Emirates",
    QTR: "Qatar Airways",
    THY: "Turkish Airlines",
    AUA: "Austrian Airlines",
    BEL: "Brussels Airlines",
    ITY: "ITA Airways",
    VLG: "Vueling",
    WZZ: "Wizz Air",
    SAS: "SAS",
    TAP: "TAP Air Portugal",
    IBE: "Iberia",
};

function getAirline(
    callsign: string
) {
    if (!callsign) {
        return "Unknown Operator";
    }

    const prefix =
        callsign
            .slice(0, 3)
            .toUpperCase();

    return (
        airlineMap[prefix] ??
        prefix
    );
}

function feet(
    meters: number | null
) {
    if (meters == null) {
        return "---";
    }

    return Math.round(
        meters * 3.28084
    ).toLocaleString("de-CH");
}

function knots(
    ms: number | null
) {
    if (ms == null) {
        return "---";
    }

    return Math.round(
        ms * 1.94384
    ).toString();
}

function verticalRateText(
    value: number | null
) {
    if (value == null) {
        return "---";
    }

    const ftPerMinute =
        Math.round(
            value * 196.85
        );

    return `${ftPerMinute > 0 ? "+" : ""
        }${ftPerMinute.toLocaleString(
            "de-CH"
        )} ft/min`;
}

function altitudeColor(
    altitude: number | null
) {
    if (altitude == null) {
        return "#ffffff";
    }

    const altitudeFt =
        altitude * 3.28084;

    if (altitudeFt < 5000) {
        return "#7cff6b";
    }

    if (altitudeFt < 10000) {
        return "#4fffe0";
    }

    if (altitudeFt < 20000) {
        return "#4ebbff";
    }

    if (altitudeFt < 30000) {
        return "#b88cff";
    }

    return "#ff74d4";
}

function distanceKm(
    a: [number, number],
    b: [number, number]
) {
    const earthRadiusKm =
        6371;

    const lat1 =
        (a[0] * Math.PI) /
        180;

    const lat2 =
        (b[0] * Math.PI) /
        180;

    const deltaLat =
        ((b[0] - a[0]) *
            Math.PI) /
        180;

    const deltaLon =
        ((b[1] - a[1]) *
            Math.PI) /
        180;

    const h =
        Math.sin(
            deltaLat / 2
        ) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(
            deltaLon / 2
        ) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(h),
            Math.sqrt(1 - h)
        );

    return (
        earthRadiusKm * c
    );
}

function getPlaneSvg(
    color: string,
    heading: number,
    selected: boolean
) {
    return `
        <div
            class="plane-marker ${selected
            ? "plane-marker-selected"
            : ""
        }"
            style="
                transform: rotate(${heading}deg);
                filter: drop-shadow(
                    0 0 ${selected
            ? "10px"
            : "4px"
        } ${color}
                );
            "
        >
            <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="
                        M12 2
                        L14 9
                        L21 13
                        L21 15
                        L14 13
                        L14 18
                        L17 20
                        L17 22
                        L12 21
                        L7 22
                        L7 20
                        L10 18
                        L10 13
                        L3 15
                        L3 13
                        L10 9
                        Z
                    "
                    fill="${color}"
                />
            </svg>
        </div>
    `;
}

export default function RadarClient() {
    const mapContainer =
        useRef<HTMLDivElement | null>(
            null
        );

    const mapRef =
        useRef<any>(null);

    const markers =
        useRef<
            Record<string, any>
        >({});

    const trails =
        useRef<
            Record<
                string,
                [number, number][]
            >
        >({});

    const trailLayers =
        useRef<
            Record<string, any>
        >({});

    const aircraftData =
        useRef<
            Record<string, Aircraft>
        >({});

    const selectedRef =
        useRef<string | null>(
            null
        );

    const trackStartedAt =
        useRef<
            Record<string, number>
        >({});

    const persistentTrackLoaded =
        useRef<
            Record<string, boolean>
        >({});

    const plannedRouteLayer =
        useRef<any>(null);

    const departureMarker =
        useRef<any>(null);

    const arrivalMarker =
        useRef<any>(null);

    const flightCache =
        useRef<
            Record<
                string,
                FlightInfo
            >
        >({});

    const [selected, setSelected] =
        useState<Aircraft | null>(
            null
        );

    const [flightInfo, setFlightInfo] =
        useState<FlightInfo | null>(
            null
        );

    const [
        loadingFlight,
        setLoadingFlight,
    ] =
        useState(false);

    const [count, setCount] =
        useState(0);

    const [search, setSearch] =
        useState("");

    const [
        searchError,
        setSearchError,
    ] =
        useState("");

    const [updated, setUpdated] =
        useState("");

    const [
        trackStats,
        setTrackStats,
    ] =
        useState<TrackStats>({
            points: 0,
            distanceKm: 0,
            durationMinutes: 0,
        });

    useEffect(() => {
        async function initializeMap() {
            const L =
                await import("leaflet");

            await import(
                "leaflet/dist/leaflet.css"
            );

            if (
                !mapContainer.current ||
                mapRef.current
            ) {
                return;
            }

            const map =
                L.map(
                    mapContainer.current,
                    {
                        zoomControl:
                            true,

                        minZoom:
                            5,

                        maxZoom:
                            15,
                    }
                ).setView(
                    [46.8, 8.25],
                    8
                );

            L.tileLayer(
                "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
                {
                    maxZoom:
                        20,

                    attribution:
                        "© OpenStreetMap © CARTO",
                }
            ).addTo(map);

            airports.forEach(
                (airport) => {
                    const icon =
                        L.divIcon({
                            className:
                                "airport-marker-wrapper",

                            html: `
                                <div class="airport-marker">
                                    <div class="airport-dot"></div>

                                    <div>
                                        <strong>
                                            ${airport.code}
                                        </strong>

                                        <small>
                                            ${airport.name}
                                        </small>
                                    </div>
                                </div>
                            `,

                            iconSize: [
                                120,
                                35,
                            ],

                            iconAnchor: [
                                10,
                                18,
                            ],
                        });

                    L.marker(
                        [
                            airport.lat,
                            airport.lon,
                        ],
                        {
                            icon,
                        }
                    ).addTo(
                        map
                    );
                }
            );

            mapRef.current =
                map;

            setTimeout(
                () => {
                    map.invalidateSize();
                },
                100
            );
        }

        initializeMap();

        return () => {
            if (
                mapRef.current
            ) {
                mapRef.current.remove();

                mapRef.current =
                    null;
            }
        };
    }, []);

    useEffect(() => {
        loadAircraft();

        const timer =
            setInterval(
                loadAircraft,
                5000
            );

        return () => {
            clearInterval(
                timer
            );
        };
    }, []);

    async function loadAircraft() {
        if (!mapRef.current) {
            return;
        }

        try {
            const L =
                await import(
                    "leaflet"
                );

            const response =
                await fetch(
                    "/api/radar",
                    {
                        cache:
                            "no-store",
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                console.error(
                    data
                );

                return;
            }

            setCount(
                data.count
            );

            setUpdated(
                new Date()
                    .toLocaleTimeString(
                        "de-CH"
                    )
            );

            const active =
                new Set<string>();

            const lookup:
                Record<
                    string,
                    Aircraft
                > = {};

            for (
                const aircraft of
                data.aircraft as Aircraft[]
            ) {
                active.add(
                    aircraft.icao24
                );

                lookup[
                    aircraft.icao24
                ] =
                    aircraft;

                const position:
                    [number, number] =
                    [
                        aircraft.latitude,
                        aircraft.longitude,
                    ];

                const selectedNow =
                    selectedRef.current ===
                    aircraft.icao24;

                const color =
                    altitudeColor(
                        aircraft.altitude
                    );

                const icon =
                    L.divIcon({
                        className:
                            "plane-icon-wrapper",

                        html:
                            getPlaneSvg(
                                color,
                                aircraft.heading ??
                                0,
                                selectedNow
                            ),

                        iconSize: [
                            30,
                            30,
                        ],

                        iconAnchor: [
                            15,
                            15,
                        ],
                    });

                if (
                    markers.current[
                    aircraft.icao24
                    ]
                ) {
                    markers.current[
                        aircraft.icao24
                    ]
                        .setLatLng(
                            position
                        )
                        .setIcon(
                            icon
                        );
                } else {
                    const marker =
                        L.marker(
                            position,
                            {
                                icon,
                            }
                        );

                    marker.on(
                        "click",
                        () => {
                            selectAircraft(
                                aircraft.icao24
                            );
                        }
                    );

                    marker.addTo(
                        mapRef.current
                    );

                    markers.current[
                        aircraft.icao24
                    ] =
                        marker;
                }

                updateTrail(
                    L,
                    aircraft,
                    position,
                    selectedNow
                );
            }

            aircraftData.current =
                lookup;

            cleanupInactiveAircraft(
                active
            );

            if (
                selectedRef.current &&
                lookup[
                selectedRef.current
                ]
            ) {
                setSelected(
                    lookup[
                    selectedRef.current
                    ]
                );

                updateTrackStats(
                    selectedRef.current
                );
            }
        } catch (error) {
            console.error(
                "Radar fetch error:",
                error
            );
        }
    }

    function updateTrail(
        L: any,
        aircraft: Aircraft,
        position: [number, number],
        selectedNow: boolean
    ) {
        const id =
            aircraft.icao24;

        if (
            !trails.current[
            id
            ]
        ) {
            trails.current[
                id
            ] = [];

            trackStartedAt.current[
                id
            ] =
                Date.now();
        }

        const previous =
            trails.current[
                id
            ].at(-1);

        if (previous) {
            const deltaLat =
                Math.abs(
                    previous[0] -
                    position[0]
                );

            const deltaLon =
                Math.abs(
                    previous[1] -
                    position[1]
                );

            if (
                deltaLat > 0.2 ||
                deltaLon > 0.2
            ) {
                trails.current[
                    id
                ] = [
                        position,
                    ];

                trackStartedAt.current[
                    id
                ] =
                    Date.now();
            } else {
                const samePosition =
                    previous[0] ===
                    position[0] &&
                    previous[1] ===
                    position[1];

                if (
                    !samePosition
                ) {
                    trails.current[
                        id
                    ].push(
                        position
                    );
                }
            }
        } else {
            trails.current[
                id
            ].push(
                position
            );
        }

        trails.current[
            id
        ] =
            trails.current[
                id
            ].slice(
                -300
            );

        if (
            trailLayers.current[
            id
            ]
        ) {
            trailLayers.current[
                id
            ].setLatLngs(
                trails.current[
                id
                ]
            );

            trailLayers.current[
                id
            ].setStyle({
                color:
                    selectedNow
                        ? "#63ffe3"
                        : "#238bd2",

                weight:
                    selectedNow
                        ? 3
                        : 1,

                opacity:
                    selectedNow
                        ? 0.95
                        : 0.12,
            });
        } else {
            trailLayers.current[
                id
            ] =
                L.polyline(
                    trails.current[
                    id
                    ],
                    {
                        color:
                            selectedNow
                                ? "#63ffe3"
                                : "#238bd2",

                        weight:
                            selectedNow
                                ? 3
                                : 1,

                        opacity:
                            selectedNow
                                ? 0.95
                                : 0.12,
                    }
                ).addTo(
                    mapRef.current
                );
        }
    }

    function cleanupInactiveAircraft(
        active: Set<string>
    ) {
        Object.keys(
            markers.current
        ).forEach(
            (icao) => {
                if (
                    active.has(
                        icao
                    )
                ) {
                    return;
                }

                markers.current[
                    icao
                ]?.remove();

                trailLayers.current[
                    icao
                ]?.remove();

                delete markers.current[
                    icao
                ];

                delete trailLayers.current[
                    icao
                ];

                // Keep the in-memory trail. If the aircraft reappears during this
                // browser session, its already loaded Redis history remains available.
            }
        );
    }

    async function loadPersistentTrack(
        icao: string
    ) {
        if (persistentTrackLoaded.current[icao]) {
            return;
        }

        try {
            const response =
                await fetch(
                    `/api/radar/track?icao24=${encodeURIComponent(
                        icao
                    )}`,
                    {
                        cache: "no-store",
                    }
                );

            if (!response.ok) {
                return;
            }

            const data:
                PersistentTrackResponse =
                await response.json();

            const storedPoints =
                Array.isArray(data.points)
                    ? data.points
                        .filter(
                            (point) =>
                                Number.isFinite(point.latitude) &&
                                Number.isFinite(point.longitude)
                        )
                        .map(
                            (point) =>
                                [
                                    point.latitude,
                                    point.longitude,
                                ] as [number, number]
                        )
                    : [];

            const livePoints =
                trails.current[icao] ?? [];

            const merged:
                [number, number][] = [];

            for (
                const point of
                [...storedPoints, ...livePoints]
            ) {
                const previous =
                    merged.at(-1);

                if (
                    !previous ||
                    previous[0] !== point[0] ||
                    previous[1] !== point[1]
                ) {
                    merged.push(point);
                }
            }

            trails.current[icao] =
                merged.slice(-300);

            const timestamps =
                (data.points ?? [])
                    .map(
                        (point) =>
                            point.timestamp ?? null
                    )
                    .filter(
                        (timestamp):
                            timestamp is number =>
                            typeof timestamp === "number" &&
                            Number.isFinite(timestamp)
                    );

            if (timestamps.length > 0) {
                const oldestTimestamp =
                    Math.min(...timestamps);

                trackStartedAt.current[icao] =
                    oldestTimestamp < 10_000_000_000
                        ? oldestTimestamp * 1000
                        : oldestTimestamp;
            }

            const L =
                await import("leaflet");

            const selectedNow =
                selectedRef.current ===
                icao;

            if (
                trailLayers.current[icao]
            ) {
                trailLayers.current[
                    icao
                ].setLatLngs(
                    trails.current[icao]
                );

                trailLayers.current[
                    icao
                ].setStyle({
                    color:
                        selectedNow
                            ? "#63ffe3"
                            : "#238bd2",
                    weight:
                        selectedNow
                            ? 3
                            : 1,
                    opacity:
                        selectedNow
                            ? 0.95
                            : 0.12,
                });
            } else if (
                mapRef.current &&
                trails.current[icao].length > 0
            ) {
                trailLayers.current[icao] =
                    L.polyline(
                        trails.current[icao],
                        {
                            color:
                                selectedNow
                                    ? "#63ffe3"
                                    : "#238bd2",
                            weight:
                                selectedNow
                                    ? 3
                                    : 1,
                            opacity:
                                selectedNow
                                    ? 0.95
                                    : 0.12,
                        }
                    ).addTo(
                        mapRef.current
                    );
            }

            persistentTrackLoaded.current[
                icao
            ] = true;

            updateTrackStats(icao);
        } catch (error) {
            console.error(
                "Persistent track fetch error:",
                error
            );
        }
    }

    function updateTrackStats(
        icao: string
    ) {
        const points =
            trails.current[
            icao
            ] ?? [];

        let totalDistance =
            0;

        for (
            let index = 1;
            index <
            points.length;
            index++
        ) {
            totalDistance +=
                distanceKm(
                    points[
                    index -
                    1
                    ],
                    points[
                    index
                    ]
                );
        }

        const started =
            trackStartedAt.current[
            icao
            ];

        const durationMinutes =
            started
                ? Math.max(
                    0,
                    Math.floor(
                        (Date.now() -
                            started) /
                        60000
                    )
                )
                : 0;

        setTrackStats({
            points:
                points.length,

            distanceKm:
                Math.round(
                    totalDistance *
                    10
                ) / 10,

            durationMinutes,
        });
    }

    async function selectAircraft(
        icao: string
    ) {
        const aircraft =
            aircraftData.current[
            icao
            ];

        if (!aircraft) {
            return;
        }

        selectedRef.current =
            icao;

        setSelected(
            aircraft
        );

        await loadPersistentTrack(
            icao
        );

        updateTrackStats(
            icao
        );

        await refreshSelection(
            icao
        );

        await loadFlightInfo(
            aircraft
        );
    }

    async function refreshSelection(
        selectedId: string
    ) {
        const L =
            await import(
                "leaflet"
            );

        Object.entries(
            aircraftData.current
        ).forEach(
            ([
                icao,
                aircraft,
            ]) => {
                const selectedNow =
                    icao ===
                    selectedId;

                const color =
                    altitudeColor(
                        aircraft.altitude
                    );

                markers.current[
                    icao
                ]?.setIcon(
                    L.divIcon({
                        className:
                            "plane-icon-wrapper",

                        html:
                            getPlaneSvg(
                                color,
                                aircraft.heading ??
                                0,
                                selectedNow
                            ),

                        iconSize: [
                            30,
                            30,
                        ],

                        iconAnchor: [
                            15,
                            15,
                        ],
                    })
                );

                trailLayers.current[
                    icao
                ]?.setStyle({
                    color:
                        selectedNow
                            ? "#63ffe3"
                            : "#238bd2",

                    weight:
                        selectedNow
                            ? 3
                            : 1,

                    opacity:
                        selectedNow
                            ? 0.95
                            : 0.12,
                });
            }
        );
    }

    async function loadFlightInfo(
        aircraft: Aircraft
    ) {
        clearPlannedRoute();

        setFlightInfo(
            null
        );

        if (
            !aircraft.callsign
        ) {
            return;
        }

        const callsign =
            aircraft.callsign
                .trim()
                .toUpperCase();

        const cached =
            flightCache.current[
            callsign
            ];

        if (cached) {
            setFlightInfo(
                cached
            );

            if (
                cached.found
            ) {
                await drawPlannedRoute(
                    aircraft,
                    cached
                );
            }

            return;
        }

        setLoadingFlight(
            true
        );

        try {
            const response =
                await fetch(
                    `/api/radar/flight?callsign=${encodeURIComponent(
                        callsign
                    )}`
                );

            const info:
                FlightInfo =
                await response.json();

            flightCache.current[
                callsign
            ] =
                info;

            setFlightInfo(
                info
            );

            if (
                info.found
            ) {
                await drawPlannedRoute(
                    aircraft,
                    info
                );
            }
        } catch (error) {
            console.error(
                "Flight lookup error:",
                error
            );
        } finally {
            setLoadingFlight(
                false
            );
        }
    }

    function clearPlannedRoute() {
        plannedRouteLayer.current?.remove();

        departureMarker.current?.remove();

        arrivalMarker.current?.remove();

        plannedRouteLayer.current =
            null;

        departureMarker.current =
            null;

        arrivalMarker.current =
            null;
    }

    async function getAirport(
        icao: string
    ): Promise<AirportInfo | null> {
        try {
            const response =
                await fetch(
                    `/api/radar/airport?icao=${encodeURIComponent(
                        icao
                    )}`
                );

            if (
                !response.ok
            ) {
                return null;
            }

            return await response.json();
        } catch {
            return null;
        }
    }

    async function drawPlannedRoute(
        aircraft: Aircraft,
        info: FlightInfo
    ) {
        const departureICAO =
            info.departure
                ?.icao;

        const arrivalICAO =
            info.arrival
                ?.icao;

        if (
            !departureICAO ||
            !arrivalICAO
        ) {
            return;
        }

        const [
            departure,
            arrival,
        ] =
            await Promise.all([
                getAirport(
                    departureICAO
                ),
                getAirport(
                    arrivalICAO
                ),
            ]);

        if (
            !departure?.found ||
            !arrival?.found ||
            departure.latitude ==
            null ||
            departure.longitude ==
            null ||
            arrival.latitude ==
            null ||
            arrival.longitude ==
            null
        ) {
            return;
        }

        const L =
            await import(
                "leaflet"
            );

        clearPlannedRoute();

        plannedRouteLayer.current =
            L.polyline(
                [
                    [
                        departure.latitude,
                        departure.longitude,
                    ],

                    [
                        aircraft.latitude,
                        aircraft.longitude,
                    ],

                    [
                        arrival.latitude,
                        arrival.longitude,
                    ],
                ],
                {
                    color:
                        "#63ffe3",

                    weight:
                        2,

                    opacity:
                        0.55,

                    dashArray:
                        "10 12",
                }
            ).addTo(
                mapRef.current
            );

        const airportIcon = (
            code: string
        ) =>
            L.divIcon({
                className:
                    "route-airport-wrapper",

                html: `
                    <div class="route-airport-marker">
                        <span></span>

                        <strong>
                            ${code}
                        </strong>
                    </div>
                `,

                iconSize: [
                    65,
                    28,
                ],

                iconAnchor: [
                    10,
                    14,
                ],
            });

        departureMarker.current =
            L.marker(
                [
                    departure.latitude,
                    departure.longitude,
                ],
                {
                    icon:
                        airportIcon(
                            info.departure
                                ?.iata ??
                            departureICAO
                        ),
                }
            ).addTo(
                mapRef.current
            );

        arrivalMarker.current =
            L.marker(
                [
                    arrival.latitude,
                    arrival.longitude,
                ],
                {
                    icon:
                        airportIcon(
                            info.arrival
                                ?.iata ??
                            arrivalICAO
                        ),
                }
            ).addTo(
                mapRef.current
            );
    }

    function searchAircraft() {
        const query =
            search
                .trim()
                .toUpperCase();

        setSearchError(
            ""
        );

        if (!query) {
            return;
        }

        const aircraft =
            Object.values(
                aircraftData.current
            ).find(
                (item) => {
                    const callsign =
                        item.callsign
                            ?.trim()
                            .toUpperCase();

                    const icao =
                        item.icao24
                            .toUpperCase();

                    return (
                        callsign ===
                        query ||
                        callsign?.includes(
                            query
                        ) ||
                        icao ===
                        query ||
                        icao.includes(
                            query
                        )
                    );
                }
            );

        if (!aircraft) {
            setSearchError(
                "AIRCRAFT NOT FOUND"
            );

            return;
        }

        selectAircraft(
            aircraft.icao24
        );

        const marker =
            markers.current[
            aircraft.icao24
            ];

        if (marker) {
            mapRef.current.flyTo(
                marker.getLatLng(),
                10,
                {
                    duration:
                        1.2,
                }
            );
        }
    }

    function fullscreen() {
        if (
            !document.fullscreenElement
        ) {
            document
                .documentElement
                .requestFullscreen();
        } else {
            document
                .exitFullscreen();
        }
    }

    return (
        <main className="radar-shell">
            <header className="radar-header">

                <a
                    href="/"
                    className="radar-brand"
                >
                    <div>
                        LuMa
                        <span>
                            RADAR
                        </span>
                    </div>

                    <small>
                        LIVE AIRSPACE
                    </small>
                </a>

                <div className="radar-search-wrapper">

                    <div className="radar-search">

                        <input
                            value={search}
                            onChange={(event) => {
                                setSearch(
                                    event.target.value
                                );

                                setSearchError(
                                    ""
                                );
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key ===
                                    "Enter"
                                ) {
                                    searchAircraft();
                                }
                            }}
                            placeholder="Callsign / ICAO suchen..."
                        />

                        <button
                            onClick={
                                searchAircraft
                            }
                        >
                            SEARCH
                        </button>

                    </div>

                    {searchError && (
                        <div className="radar-search-error">
                            {searchError}
                        </div>
                    )}

                </div>

                <a
                    href="/"
                    className="back-button"
                >
                    ← LUMA LABS
                </a>

                <button
                    className="fullscreen-button"
                    onClick={
                        fullscreen
                    }
                >
                    FULLSCREEN
                </button>

            </header>

            <section className="radar-main">

                <div
                    ref={
                        mapContainer
                    }
                    className="radar-map"
                />

                <aside className="radar-panel">

                    <div className="live-status">
                        <span />
                        LIVE
                    </div>

                    <div className="radar-count">

                        <small>
                            AIRCRAFT TRACKED
                        </small>

                        <strong>
                            {count}
                        </strong>

                    </div>

                    {selected ? (
                        <div className="aircraft-details">

                            <div className="selected-aircraft-header">

                                <div>
                                    <h2>
                                        {selected.callsign ||
                                            selected.icao24.toUpperCase()}
                                    </h2>

                                    <p className="airline-name">
                                        {flightInfo?.found
                                            ? flightInfo.airline
                                                ?.name ??
                                            getAirline(
                                                selected.callsign
                                            )
                                            : getAirline(
                                                selected.callsign
                                            )}
                                    </p>

                                    <p className="country-name">
                                        {selected.country}
                                    </p>
                                </div>

                                <div className="selected-aircraft-icon">
                                    ✈
                                </div>

                            </div>

                            {loadingFlight && (
                                <div className="route-loading">
                                    ROUTE DATA LOADING...
                                </div>
                            )}

                            {!loadingFlight &&
                                flightInfo?.found && (
                                    <div className="flight-route-card">

                                        <div className="route-airports">

                                            <div>
                                                <strong>
                                                    {flightInfo
                                                        .departure
                                                        ?.iata ??
                                                        flightInfo
                                                            .departure
                                                            ?.icao ??
                                                        "---"}
                                                </strong>

                                                <small>
                                                    DEPARTURE
                                                </small>
                                            </div>

                                            <div className="route-line-ui">
                                                <span />
                                                <b>
                                                    ✈
                                                </b>
                                                <span />
                                            </div>

                                            <div>
                                                <strong>
                                                    {flightInfo
                                                        .arrival
                                                        ?.iata ??
                                                        flightInfo
                                                            .arrival
                                                            ?.icao ??
                                                        "---"}
                                                </strong>

                                                <small>
                                                    DESTINATION
                                                </small>
                                            </div>

                                        </div>

                                        <div className="route-names">

                                            <span>
                                                {flightInfo
                                                    .departure
                                                    ?.airport ??
                                                    ""}
                                            </span>

                                            <span>
                                                {flightInfo
                                                    .arrival
                                                    ?.airport ??
                                                    ""}
                                            </span>

                                        </div>

                                    </div>
                                )}

                            {!loadingFlight &&
                                flightInfo &&
                                !flightInfo.found && (
                                    <div className="route-unavailable">

                                        <small>
                                            ROUTE DATA
                                        </small>

                                        <strong>
                                            UNAVAILABLE
                                        </strong>

                                        <span>
                                            No verified flight match
                                        </span>

                                    </div>
                                )}

                            <div className="track-card">

                                <div className="track-card-header">

                                    <small>
                                        TRACK RECORDED
                                    </small>

                                    <span>
                                        LIVE
                                    </span>

                                </div>

                                <div className="track-grid">

                                    <div>
                                        <strong>
                                            {trackStats.points}
                                        </strong>

                                        <small>
                                            POSITIONS
                                        </small>
                                    </div>

                                    <div>
                                        <strong>
                                            {trackStats.distanceKm.toLocaleString(
                                                "de-CH"
                                            )} km
                                        </strong>

                                        <small>
                                            DISTANCE
                                        </small>
                                    </div>

                                    <div>
                                        <strong>
                                            {trackStats.durationMinutes} min
                                        </strong>

                                        <small>
                                            TRACKING
                                        </small>
                                    </div>

                                </div>

                            </div>

                            {flightInfo?.found &&
                                flightInfo.aircraft
                                    ?.registration && (
                                    <Detail
                                        name="REGISTRATION"
                                        value={
                                            flightInfo
                                                .aircraft
                                                .registration
                                        }
                                    />
                                )}

                            {flightInfo?.found &&
                                flightInfo.aircraft
                                    ?.icao && (
                                    <Detail
                                        name="AIRCRAFT"
                                        value={
                                            flightInfo
                                                .aircraft
                                                .icao
                                        }
                                    />
                                )}

                            <Detail
                                name="ICAO"
                                value={
                                    selected.icao24.toUpperCase()
                                }
                            />

                            <Detail
                                name="ALTITUDE"
                                value={`${feet(
                                    selected.altitude
                                )} ft`}
                            />

                            <Detail
                                name="SPEED"
                                value={`${knots(
                                    selected.velocity
                                )} kt`}
                            />

                            <Detail
                                name="HEADING"
                                value={
                                    selected.heading !=
                                        null
                                        ? `${Math.round(
                                            selected.heading
                                        )}°`
                                        : "---"
                                }
                            />

                            <Detail
                                name="VERTICAL"
                                value={
                                    verticalRateText(
                                        selected.verticalRate
                                    )
                                }
                            />

                            <Detail
                                name="SQUAWK"
                                value={
                                    selected.squawk ??
                                    "---"
                                }
                            />

                            <Detail
                                name="STATUS"
                                value={
                                    selected.onGround
                                        ? "GROUND"
                                        : "AIRBORNE"
                                }
                            />

                        </div>
                    ) : (
                        <div className="radar-empty">

                            <span>
                                ✈
                            </span>

                            <p>
                                SELECT AIRCRAFT
                            </p>

                        </div>
                    )}

                    <div className="altitude-legend">

                        <small>
                            ALTITUDE
                        </small>

                        <div>
                            <span>
                                ● &lt; 5k
                            </span>

                            <span>
                                ● 5–10k
                            </span>

                            <span>
                                ● 10–20k
                            </span>

                            <span>
                                ● 20–30k
                            </span>

                            <span>
                                ● 30k+
                            </span>
                        </div>

                    </div>

                </aside>

            </section>

            <footer className="radar-footer">

                <span>
                    LuMa Labs · Switzerland Airspace
                </span>

                <span>
                    ZRH · BSL · GVA
                </span>

                <span>
                    UPDATED {updated || "---"}
                </span>

            </footer>
        </main>
    );
}

function Detail({
    name,
    value,
}: {
    name: string;
    value: string;
}) {
    return (
        <div className="detail-row">

            <span>
                {name}
            </span>

            <strong>
                {value}
            </strong>

        </div>
    );
}