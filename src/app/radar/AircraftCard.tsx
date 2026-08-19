"use client";

import {
    useEffect,
    useState,
} from "react";
import { createPortal } from "react-dom";

type AircraftInfo = {
    registration: string | null;
    iata: string | null;
    icao: string | null;
    type?: string | null;
    icaoType?: string | null;
    manufacturer?: string | null;
    owner?: string | null;
    ownerCountry?: string | null;
    ownerCountryIso?: string | null;
    operatorFlagCode?: string | null;
    modeS?: string | null;
    photo?: string | null;
    thumbnail?: string | null;
    yearBuilt?: number | null;
    ageYears?: number | null;
    isMilitary?: boolean | null;
    metadataSources?: string[];
};

type FlightInfo = {
    found: boolean;
    callsign: string;
    aircraft?: AircraftInfo;
};

type AirframeInfo = {
    found: boolean;
    source?: string;
    registration?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    typeCode?: string | null;
    serialNumber?: string | null;
    lineNumber?: string | null;
    icaoAircraftType?: string | null;
    operator?: string | null;
    operatorCallsign?: string | null;
    operatorIcao?: string | null;
    operatorIata?: string | null;
    owner?: string | null;
    registered?: string | null;
    regUntil?: string | null;
    status?: string | null;
    built?: string | null;
    yearBuilt?: number | null;
    ageYears?: number | null;
    firstFlightDate?: string | null;
    seatConfiguration?: string | null;
    engines?: string | null;
    categoryDescription?: string | null;
};

const cardStyle: React.CSSProperties = {
    margin: "14px 0",
    overflow: "hidden",
    border: "1px solid rgba(99, 255, 227, 0.18)",
    borderRadius: "14px",
    background:
        "linear-gradient(180deg, rgba(12, 33, 36, 0.96), rgba(5, 17, 20, 0.96))",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.24)",
};

const imageStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "180px",
    objectFit: "cover",
    background: "rgba(255,255,255,0.03)",
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
    color: "rgba(255,255,255,0.9)",
    fontSize: "12px",
    lineHeight: 1.35,
};

export default function AircraftCard() {
    const [host, setHost] =
        useState<HTMLDivElement | null>(null);
    const [callsign, setCallsign] =
        useState("");
    const [icao24, setIcao24] =
        useState("");
    const [flightInfo, setFlightInfo] =
        useState<FlightInfo | null>(null);
    const [airframeInfo, setAirframeInfo] =
        useState<AirframeInfo | null>(null);

    useEffect(() => {
        function sync() {
            const details =
                document.querySelector(
                    ".aircraft-details"
                );
            const trackCard =
                details?.querySelector(
                    ".track-card"
                );
            const heading =
                details?.querySelector(
                    ".selected-aircraft-header h2"
                );

            const nextCallsign =
                heading?.textContent
                    ?.trim()
                    .toUpperCase() ?? "";

            if (
                nextCallsign &&
                nextCallsign !== callsign
            ) {
                setCallsign(nextCallsign);
            }

            const rows = details
                ? Array.from(
                    details.querySelectorAll(
                        ".detail-row"
                    )
                )
                : [];

            const icaoRow = rows.find(
                (row) =>
                    row.querySelector("span")
                        ?.textContent
                        ?.trim()
                        .toUpperCase() === "ICAO"
            );

            const nextIcao =
                icaoRow
                    ?.querySelector("strong")
                    ?.textContent
                    ?.trim()
                    .toLowerCase() ?? "";

            if (
                /^[0-9a-f]{6}$/.test(nextIcao) &&
                nextIcao !== icao24
            ) {
                setIcao24(nextIcao);
            }

            if (details && trackCard) {
                let cardHost =
                    details.querySelector<HTMLDivElement>(
                        "#luma-aircraft-card-host"
                    );

                if (!cardHost) {
                    cardHost =
                        document.createElement("div");
                    cardHost.id =
                        "luma-aircraft-card-host";
                    details.insertBefore(
                        cardHost,
                        trackCard
                    );
                }

                setHost(cardHost);
            } else {
                setHost(null);
            }
        }

        sync();

        const observer =
            new MutationObserver(sync);

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
                    "#luma-aircraft-card-host"
                )
                ?.remove();
        };
    }, [callsign, icao24]);

    useEffect(() => {
        if (!callsign) {
            setFlightInfo(null);
            return;
        }

        const controller =
            new AbortController();

        async function load() {
            try {
                const response = await fetch(
                    `/api/radar/flight?callsign=${encodeURIComponent(
                        callsign
                    )}`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    setFlightInfo(null);
                    return;
                }

                setFlightInfo(
                    await response.json()
                );
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "Aircraft lookup error:",
                    error
                );
                setFlightInfo(null);
            }
        }

        load();
        return () => controller.abort();
    }, [callsign]);

    useEffect(() => {
        if (!icao24) {
            setAirframeInfo(null);
            return;
        }

        const controller =
            new AbortController();

        async function load() {
            try {
                const response = await fetch(
                    `/api/radar/airframe?icao24=${encodeURIComponent(
                        icao24
                    )}`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    setAirframeInfo(null);
                    return;
                }

                const data: AirframeInfo =
                    await response.json();

                setAirframeInfo(
                    data.found ? data : null
                );
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "OpenSky lookup error:",
                    error
                );
                setAirframeInfo(null);
            }
        }

        load();
        return () => controller.abort();
    }, [icao24]);

    if (!host) {
        return null;
    }

    const aircraft =
        flightInfo?.aircraft;
    const openSky =
        airframeInfo;

    if (!aircraft && !openSky) {
        return null;
    }

    const registration =
        aircraft?.registration ??
        openSky?.registration ?? null;
    const manufacturer =
        aircraft?.manufacturer ??
        openSky?.manufacturer ?? null;
    const model =
        aircraft?.type ??
        openSky?.model ?? null;
    const icaoType =
        aircraft?.icaoType ??
        openSky?.typeCode ??
        openSky?.icaoAircraftType ?? null;
    const owner =
        aircraft?.owner ??
        openSky?.owner ?? null;
    const operator =
        openSky?.operator ??
        aircraft?.owner ?? null;
    const yearBuilt =
        openSky?.yearBuilt ??
        aircraft?.yearBuilt ?? null;
    const ageYears =
        openSky?.ageYears ??
        aircraft?.ageYears ?? null;
    const photo =
        aircraft?.thumbnail ??
        aircraft?.photo ?? null;

    const manufacturerAndType =
        [manufacturer, model]
            .filter(Boolean)
            .join(" ");

    const typeName =
        manufacturerAndType ||
        aircraft?.icao ||
        icaoType ||
        "Aircraft";

    const wikipediaUrl =
        `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
            model || typeName
        )}`;

    const sources = Array.from(
        new Set([
            ...(aircraft?.metadataSources ?? []),
            ...(openSky ? ["OpenSky"] : []),
        ])
    );

    const values = [
        ["REGISTRATION", registration],
        [
            "MODE-S / ICAO24",
            aircraft?.modeS ??
            (icao24 ? icao24.toUpperCase() : null),
        ],
        ["MANUFACTURER", manufacturer],
        ["TYPE / MODEL", model],
        ["ICAO TYPE", icaoType],
        ["MSN / SERIAL", openSky?.serialNumber],
        ["LINE NUMBER", openSky?.lineNumber],
        [
            "YEAR BUILT",
            yearBuilt != null
                ? String(yearBuilt)
                : null,
        ],
        ["BUILT", openSky?.built],
        [
            "AIRFRAME AGE",
            ageYears != null
                ? `${ageYears} years`
                : null,
        ],
        ["FIRST FLIGHT", openSky?.firstFlightDate],
        ["ENGINES", openSky?.engines],
        ["SEAT CONFIG", openSky?.seatConfiguration],
        ["OPERATOR", operator],
        [
            "OPERATOR ICAO / IATA",
            [
                openSky?.operatorIcao,
                openSky?.operatorIata,
            ]
                .filter(Boolean)
                .join(" / ") || null,
        ],
        ["OPERATOR CALLSIGN", openSky?.operatorCallsign],
        ["REGISTERED OWNER", owner],
        [
            "REGISTERED IN",
            [
                aircraft?.ownerCountry,
                aircraft?.ownerCountryIso,
            ]
                .filter(Boolean)
                .join(" · ") || null,
        ],
        ["REGISTERED SINCE", openSky?.registered],
        ["REGISTERED UNTIL", openSky?.regUntil],
        ["STATUS", openSky?.status],
        ["OPERATOR FLAG", aircraft?.operatorFlagCode],
        [
            "MILITARY",
            aircraft?.isMilitary == null
                ? null
                : aircraft.isMilitary
                    ? "YES"
                    : "NO",
        ],
    ] as const;

    const visibleValues =
        values.filter(([, value]) =>
            value != null &&
            String(value).trim() !== ""
        );

    return createPortal(
        <section
            style={cardStyle}
            aria-label="Aircraft intelligence"
        >
            {photo && (
                <img
                    src={photo}
                    alt={typeName}
                    style={imageStyle}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />
            )}

            <div style={{ padding: "14px" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "14px",
                    }}
                >
                    <div>
                        <span style={labelStyle}>
                            AIRCRAFT INTELLIGENCE
                        </span>
                        <strong
                            style={{
                                display: "block",
                                color: "#63ffe3",
                                fontSize: "15px",
                                lineHeight: 1.25,
                            }}
                        >
                            {typeName}
                        </strong>
                    </div>

                    {icaoType && (
                        <span
                            style={{
                                flexShrink: 0,
                                border:
                                    "1px solid rgba(99,255,227,0.18)",
                                borderRadius: "999px",
                                padding: "5px 8px",
                                color: "rgba(99,255,227,0.8)",
                                fontSize: "9px",
                                letterSpacing: "0.1em",
                            }}
                        >
                            {icaoType}
                        </span>
                    )}
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px 14px",
                    }}
                >
                    {visibleValues.map(
                        ([label, value]) => (
                            <AircraftValue
                                key={label}
                                label={label}
                                value={String(value)}
                            />
                        )
                    )}
                </div>

                {openSky?.categoryDescription && (
                    <div
                        style={{
                            marginTop: "14px",
                            paddingTop: "12px",
                            borderTop:
                                "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <span style={labelStyle}>
                            CATEGORY
                        </span>
                        <span style={valueStyle}>
                            {openSky.categoryDescription}
                        </span>
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginTop: "14px",
                        paddingTop: "12px",
                        borderTop:
                            "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <a
                        href={wikipediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            color: "rgba(99,255,227,0.82)",
                            fontSize: "10px",
                            letterSpacing: "0.08em",
                            textDecoration: "none",
                        }}
                    >
                        TYPE INFO ↗
                    </a>

                    {sources.length > 0 && (
                        <span
                            style={{
                                color: "rgba(255,255,255,0.28)",
                                fontSize: "8px",
                                letterSpacing: "0.08em",
                                textAlign: "right",
                            }}
                        >
                            DATA: {sources.join(" + ")}
                        </span>
                    )}
                </div>
            </div>
        </section>,
        host
    );
}

function AircraftValue({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
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
