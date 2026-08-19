"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";
import { createPortal } from "react-dom";

type Aircraft = {
    icao24: string;
    callsign: string;
    longitude: number;
    latitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    verticalRate: number | null;
};

type RadarResponse = {
    aircraft?: Aircraft[];
};

type FlightInfo = {
    found: boolean;
    departure?: {
        iata: string | null;
        icao: string | null;
        airport: string | null;
    };
    arrival?: {
        iata: string | null;
        icao: string | null;
        airport: string | null;
    };
};

type AirportInfo = {
    found: boolean;
    latitude?: number;
    longitude?: number;
};

type Intelligence = {
    phase: string;
    phaseDetail: string;
    remainingKm: number | null;
    totalKm: number | null;
    progressPct: number | null;
    etaMinutes: number | null;
    destinationCode: string | null;
    departureCode: string | null;
};

const cardStyle: React.CSSProperties = {
    margin: "14px 0",
    padding: "14px",
    border: "1px solid rgba(184, 140, 255, 0.20)",
    borderRadius: "14px",
    background:
        "linear-gradient(180deg, rgba(25, 15, 38, 0.96), rgba(10, 9, 20, 0.96))",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.22)",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "4px",
    color: "rgba(255,255,255,0.38)",
    fontSize: "9px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
};

const valueStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.92)",
    fontSize: "12px",
    lineHeight: 1.35,
};

export default function LiveFlightIntelligence() {
    const [host, setHost] =
        useState<HTMLDivElement | null>(null);
    const [callsign, setCallsign] =
        useState("");
    const [icao24, setIcao24] =
        useState("");
    const [aircraft, setAircraft] =
        useState<Aircraft | null>(null);
    const [flightInfo, setFlightInfo] =
        useState<FlightInfo | null>(null);
    const [departure, setDeparture] =
        useState<AirportInfo | null>(null);
    const [arrival, setArrival] =
        useState<AirportInfo | null>(null);

    useEffect(() => {
        function syncSelection() {
            const details =
                document.querySelector(
                    ".aircraft-details"
                );

            if (!details) {
                setHost(null);
                return;
            }

            const heading =
                details.querySelector(
                    ".selected-aircraft-header h2"
                );

            const nextCallsign =
                heading?.textContent
                    ?.trim()
                    .toUpperCase() ??
                "";

            const rows = Array.from(
                details.querySelectorAll(
                    ".detail-row"
                )
            );

            const icaoRow = rows.find(
                (row) =>
                    row.querySelector("span")
                        ?.textContent
                        ?.trim()
                        .toUpperCase() ===
                    "ICAO"
            );

            const nextIcao =
                icaoRow
                    ?.querySelector("strong")
                    ?.textContent
                    ?.trim()
                    .toLowerCase() ??
                "";

            if (
                nextCallsign &&
                nextCallsign !== callsign
            ) {
                setCallsign(nextCallsign);
            }

            if (
                /^[0-9a-f]{6}$/.test(nextIcao) &&
                nextIcao !== icao24
            ) {
                setIcao24(nextIcao);
            }

            const aircraftHost =
                details.querySelector(
                    "#luma-aircraft-card-host"
                );

            const trackCard =
                details.querySelector(
                    ".track-card"
                );

            let liveHost =
                details.querySelector<HTMLDivElement>(
                    "#luma-live-flight-intelligence-host"
                );

            if (!liveHost) {
                liveHost =
                    document.createElement("div");
                liveHost.id =
                    "luma-live-flight-intelligence-host";

                if (aircraftHost) {
                    details.insertBefore(
                        liveHost,
                        aircraftHost
                    );
                } else if (trackCard) {
                    details.insertBefore(
                        liveHost,
                        trackCard
                    );
                } else {
                    details.appendChild(liveHost);
                }
            }

            setHost(liveHost);
        }

        syncSelection();

        const observer =
            new MutationObserver(
                syncSelection
            );

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                characterData: true,
            }
        );

        return () => {
            observer.disconnect();
            document
                .querySelector(
                    "#luma-live-flight-intelligence-host"
                )
                ?.remove();
        };
    }, [callsign, icao24]);

    useEffect(() => {
        if (!callsign && !icao24) {
            setAircraft(null);
            return;
        }

        let cancelled = false;

        async function loadAircraft() {
            try {
                const response = await fetch(
                    "/api/radar",
                    {
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    return;
                }

                const data:
                    RadarResponse =
                    await response.json();

                const match =
                    data.aircraft?.find(
                        (item) =>
                            item.icao24
                                ?.toLowerCase() ===
                                icao24 ||
                            item.callsign
                                ?.trim()
                                .toUpperCase() ===
                                callsign
                    ) ?? null;

                if (!cancelled) {
                    setAircraft(match);
                }
            } catch (error) {
                console.error(
                    "Live intelligence radar lookup:",
                    error
                );
            }
        }

        loadAircraft();
        const timer = setInterval(
            loadAircraft,
            5000
        );

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [callsign, icao24]);

    useEffect(() => {
        if (!callsign) {
            setFlightInfo(null);
            setDeparture(null);
            setArrival(null);
            return;
        }

        const controller =
            new AbortController();

        async function loadRoute() {
            try {
                const response = await fetch(
                    `/api/radar/flight?callsign=${encodeURIComponent(
                        callsign
                    )}`,
                    {
                        cache: "no-store",
                        signal:
                            controller.signal,
                    }
                );

                if (!response.ok) {
                    return;
                }

                const info:
                    FlightInfo =
                    await response.json();

                setFlightInfo(info);

                const depIcao =
                    info.departure?.icao;
                const arrIcao =
                    info.arrival?.icao;

                const [dep, arr] =
                    await Promise.all([
                        depIcao
                            ? loadAirport(
                                depIcao,
                                controller.signal
                            )
                            : Promise.resolve(null),
                        arrIcao
                            ? loadAirport(
                                arrIcao,
                                controller.signal
                            )
                            : Promise.resolve(null),
                    ]);

                setDeparture(dep);
                setArrival(arr);
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "Live intelligence route lookup:",
                    error
                );
            }
        }

        loadRoute();

        return () => {
            controller.abort();
        };
    }, [callsign]);

    const intelligence = useMemo(
        () =>
            buildIntelligence(
                aircraft,
                flightInfo,
                departure,
                arrival
            ),
        [
            aircraft,
            flightInfo,
            departure,
            arrival,
        ]
    );

    if (!host || !aircraft) {
        return null;
    }

    return createPortal(
        <section
            style={cardStyle}
            aria-label="Live flight intelligence"
        >
            <div
                style={{
                    display: "flex",
                    justifyContent:
                        "space-between",
                    alignItems:
                        "flex-start",
                    gap: "12px",
                    marginBottom: "14px",
                }}
            >
                <div>
                    <span style={labelStyle}>
                        LIVE FLIGHT INTELLIGENCE
                    </span>
                    <strong
                        style={{
                            display: "block",
                            color: "#b88cff",
                            fontSize: "16px",
                            lineHeight: 1.2,
                        }}
                    >
                        {intelligence.phase}
                    </strong>
                    <span
                        style={{
                            display: "block",
                            marginTop: "4px",
                            color: "rgba(255,255,255,0.42)",
                            fontSize: "10px",
                        }}
                    >
                        {intelligence.phaseDetail}
                    </span>
                </div>

                <span
                    style={{
                        border:
                            "1px solid rgba(184,140,255,0.22)",
                        borderRadius: "999px",
                        padding: "5px 8px",
                        color: "rgba(184,140,255,0.86)",
                        fontSize: "9px",
                        letterSpacing: "0.1em",
                    }}
                >
                    LIVE
                </span>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "1fr 1fr",
                    gap: "12px 14px",
                }}
            >
                <Metric
                    label="FROM"
                    value={
                        intelligence.departureCode
                    }
                />
                <Metric
                    label="TO"
                    value={
                        intelligence.destinationCode
                    }
                />
                <Metric
                    label="REMAINING"
                    value={
                        intelligence.remainingKm != null
                            ? `${Math.round(
                                intelligence.remainingKm
                            ).toLocaleString(
                                "de-CH"
                            )} km`
                            : null
                    }
                />
                <Metric
                    label="ETA"
                    value={
                        intelligence.etaMinutes != null
                            ? etaText(
                                intelligence.etaMinutes
                            )
                            : null
                    }
                />
            </div>

            {intelligence.progressPct != null && (
                <div
                    style={{
                        marginTop: "14px",
                        paddingTop: "12px",
                        borderTop:
                            "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent:
                                "space-between",
                            marginBottom: "7px",
                        }}
                    >
                        <span style={labelStyle}>
                            ROUTE PROGRESS
                        </span>
                        <strong
                            style={{
                                color: "rgba(255,255,255,0.75)",
                                fontSize: "10px",
                            }}
                        >
                            {intelligence.progressPct}%
                        </strong>
                    </div>

                    <div
                        style={{
                            height: "5px",
                            overflow: "hidden",
                            borderRadius: "999px",
                            background:
                                "rgba(255,255,255,0.07)",
                        }}
                    >
                        <div
                            style={{
                                width: `${intelligence.progressPct}%`,
                                height: "100%",
                                borderRadius: "999px",
                                background:
                                    "linear-gradient(90deg, rgba(99,255,227,0.8), rgba(184,140,255,0.9))",
                            }}
                        />
                    </div>
                </div>
            )}
        </section>,
        host
    );
}

async function loadAirport(
    icao: string,
    signal: AbortSignal
): Promise<AirportInfo | null> {
    const response = await fetch(
        `/api/radar/airport?icao=${encodeURIComponent(
            icao
        )}`,
        {
            cache: "no-store",
            signal,
        }
    );

    if (!response.ok) {
        return null;
    }

    const data:
        AirportInfo =
        await response.json();

    return data.found
        ? data
        : null;
}

function buildIntelligence(
    aircraft: Aircraft | null,
    flightInfo: FlightInfo | null,
    departure: AirportInfo | null,
    arrival: AirportInfo | null
): Intelligence {
    const phase =
        getFlightPhase(aircraft);

    const departureCode =
        flightInfo?.departure?.iata ??
        flightInfo?.departure?.icao ??
        null;

    const destinationCode =
        flightInfo?.arrival?.iata ??
        flightInfo?.arrival?.icao ??
        null;

    if (!aircraft) {
        return {
            ...phase,
            remainingKm: null,
            totalKm: null,
            progressPct: null,
            etaMinutes: null,
            destinationCode,
            departureCode,
        };
    }

    const current: [number, number] = [
        aircraft.latitude,
        aircraft.longitude,
    ];

    const departurePoint =
        departure?.latitude != null &&
        departure.longitude != null
            ? [
                departure.latitude,
                departure.longitude,
            ] as [number, number]
            : null;

    const arrivalPoint =
        arrival?.latitude != null &&
        arrival.longitude != null
            ? [
                arrival.latitude,
                arrival.longitude,
            ] as [number, number]
            : null;

    const remainingKm =
        arrivalPoint
            ? distanceKm(
                current,
                arrivalPoint
            )
            : null;

    const totalKm =
        departurePoint && arrivalPoint
            ? distanceKm(
                departurePoint,
                arrivalPoint
            )
            : null;

    const travelledKm =
        departurePoint
            ? distanceKm(
                departurePoint,
                current
            )
            : null;

    const progressPct =
        totalKm != null &&
        travelledKm != null &&
        totalKm > 0
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        (travelledKm /
                            totalKm) *
                            100
                    )
                )
            )
            : null;

    const speedKmh =
        aircraft.velocity != null
            ? aircraft.velocity * 3.6
            : null;

    const etaMinutes =
        remainingKm != null &&
        speedKmh != null &&
        speedKmh >= 120 &&
        !aircraft.onGround
            ? Math.max(
                1,
                Math.round(
                    (remainingKm /
                        speedKmh) *
                        60
                )
            )
            : null;

    return {
        ...phase,
        remainingKm,
        totalKm,
        progressPct,
        etaMinutes,
        destinationCode,
        departureCode,
    };
}

function getFlightPhase(
    aircraft: Aircraft | null
) {
    if (!aircraft) {
        return {
            phase: "UNKNOWN",
            phaseDetail:
                "Waiting for live telemetry",
        };
    }

    if (aircraft.onGround) {
        return {
            phase: "GROUND",
            phaseDetail:
                "Aircraft is on the ground",
        };
    }

    const altitudeFt =
        (aircraft.altitude ?? 0) *
        3.28084;

    const verticalFpm =
        (aircraft.verticalRate ?? 0) *
        196.85;

    const speedKt =
        (aircraft.velocity ?? 0) *
        1.94384;

    if (
        altitudeFt < 3000 &&
        verticalFpm < -300
    ) {
        return {
            phase: "APPROACH",
            phaseDetail:
                "Low altitude descent",
        };
    }

    if (
        verticalFpm > 350
    ) {
        return {
            phase:
                altitudeFt < 10000
                    ? "INITIAL CLIMB"
                    : "CLIMB",
            phaseDetail:
                `Climbing at ${Math.round(
                    verticalFpm
                ).toLocaleString(
                    "de-CH"
                )} ft/min`,
        };
    }

    if (
        verticalFpm < -350
    ) {
        return {
            phase:
                altitudeFt < 10000
                    ? "DESCENT / APPROACH"
                    : "DESCENT",
            phaseDetail:
                `Descending at ${Math.abs(
                    Math.round(verticalFpm)
                ).toLocaleString(
                    "de-CH"
                )} ft/min`,
        };
    }

    if (
        altitudeFt >= 20000 &&
        Math.abs(verticalFpm) <= 350
    ) {
        return {
            phase: "CRUISE",
            phaseDetail:
                `Stable at ${Math.round(
                    altitudeFt
                ).toLocaleString(
                    "de-CH"
                )} ft`,
        };
    }

    if (
        altitudeFt < 10000 &&
        speedKt < 250
    ) {
        return {
            phase: "LOW ALTITUDE",
            phaseDetail:
                "Terminal area flight",
        };
    }

    return {
        phase: "LEVEL FLIGHT",
        phaseDetail:
            "Altitude currently stable",
    };
}

function distanceKm(
    a: [number, number],
    b: [number, number]
) {
    const earthRadiusKm = 6371;

    const lat1 =
        (a[0] * Math.PI) / 180;
    const lat2 =
        (b[0] * Math.PI) / 180;
    const deltaLat =
        ((b[0] - a[0]) * Math.PI) /
        180;
    const deltaLon =
        ((b[1] - a[1]) * Math.PI) /
        180;

    const h =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    return (
        earthRadiusKm *
        2 *
        Math.atan2(
            Math.sqrt(h),
            Math.sqrt(1 - h)
        )
    );
}

function etaText(minutes: number) {
    const hours =
        Math.floor(minutes / 60);
    const rest =
        minutes % 60;

    if (hours <= 0) {
        return `${rest} min`;
    }

    return `${hours} h ${rest
        .toString()
        .padStart(2, "0")} min`;
}

function Metric({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    if (!value) {
        return null;
    }

    return (
        <div>
            <span style={labelStyle}>
                {label}
            </span>
            <span style={valueStyle}>
                {value}
            </span>
        </div>
    );
}
