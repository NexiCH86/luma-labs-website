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
    photo?: string | null;
    thumbnail?: string | null;
};

type FlightInfo = {
    found: boolean;
    callsign: string;
    aircraft?: AircraftInfo;
};

const cardStyle: React.CSSProperties = {
    margin: "14px 0",
    overflow: "hidden",
    border: "1px solid rgba(99, 255, 227, 0.18)",
    borderRadius: "14px",
    background: "linear-gradient(180deg, rgba(12, 33, 36, 0.96), rgba(5, 17, 20, 0.96))",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.24)",
};

const imageStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "150px",
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
        useState<HTMLDivElement | null>(
            null
        );

    const [callsign, setCallsign] =
        useState("");

    const [info, setInfo] =
        useState<FlightInfo | null>(
            null
        );

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
                    .toUpperCase() ??
                "";

            if (
                nextCallsign &&
                nextCallsign !== callsign
            ) {
                setCallsign(
                    nextCallsign
                );
            }

            if (
                details &&
                trackCard
            ) {
                let cardHost =
                    details.querySelector<HTMLDivElement>(
                        "#luma-aircraft-card-host"
                    );

                if (!cardHost) {
                    cardHost =
                        document.createElement(
                            "div"
                        );

                    cardHost.id =
                        "luma-aircraft-card-host";

                    details.insertBefore(
                        cardHost,
                        trackCard
                    );
                }

                setHost(
                    cardHost
                );
            } else {
                setHost(
                    null
                );
            }
        }

        sync();

        const observer =
            new MutationObserver(
                sync
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
                    "#luma-aircraft-card-host"
                )
                ?.remove();
        };
    }, [callsign]);

    useEffect(() => {
        if (!callsign) {
            setInfo(null);
            return;
        }

        const controller =
            new AbortController();

        async function load() {
            try {
                const response =
                    await fetch(
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
                    setInfo(null);
                    return;
                }

                const data:
                    FlightInfo =
                    await response.json();

                setInfo(data);
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name ===
                        "AbortError"
                ) {
                    return;
                }

                console.error(
                    "Aircraft card lookup error:",
                    error
                );

                setInfo(null);
            }
        }

        load();

        return () => {
            controller.abort();
        };
    }, [callsign]);

    const aircraft =
        info?.aircraft;

    if (
        !host ||
        !aircraft ||
        !(
            aircraft.type ||
            aircraft.manufacturer ||
            aircraft.registration ||
            aircraft.owner ||
            aircraft.thumbnail ||
            aircraft.photo
        )
    ) {
        return null;
    }

    const photo =
        aircraft.thumbnail ??
        aircraft.photo ??
        null;

    const manufacturerAndType =
        [
            aircraft.manufacturer,
            aircraft.type,
        ]
            .filter(Boolean)
            .join(" ");

    const typeName =
        manufacturerAndType ||
        aircraft.icao ||
        aircraft.icaoType ||
        "Aircraft";

    return createPortal(
        <section
            style={cardStyle}
            aria-label="Aircraft information"
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

            <div
                style={{
                    padding: "14px",
                }}
            >
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
                        <span
                            style={labelStyle}
                        >
                            AIRCRAFT
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

                    {aircraft.icaoType && (
                        <span
                            style={{
                                flexShrink: 0,
                                border: "1px solid rgba(99,255,227,0.18)",
                                borderRadius: "999px",
                                padding: "5px 8px",
                                color: "rgba(99,255,227,0.8)",
                                fontSize: "9px",
                                letterSpacing: "0.1em",
                            }}
                        >
                            {aircraft.icaoType}
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
                    <AircraftValue
                        label="REGISTRATION"
                        value={
                            aircraft.registration
                        }
                    />

                    <AircraftValue
                        label="MANUFACTURER"
                        value={
                            aircraft.manufacturer
                        }
                    />

                    <AircraftValue
                        label="OPERATOR / OWNER"
                        value={
                            aircraft.owner
                        }
                    />

                    <AircraftValue
                        label="REGISTERED IN"
                        value={
                            aircraft.ownerCountry
                        }
                    />
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
    value?: string | null;
}) {
    return (
        <div>
            <span style={labelStyle}>
                {label}
            </span>

            <span style={valueStyle}>
                {value ?? "---"}
            </span>
        </div>
    );
}
