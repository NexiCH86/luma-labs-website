"use client";

import {
    useEffect,
    useState,
} from "react";
import { createPortal } from "react-dom";

type AirframeInfo = {
    found: boolean;
    icao24?: string;
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
    border: "1px solid rgba(78, 187, 255, 0.18)",
    borderRadius: "14px",
    background:
        "linear-gradient(180deg, rgba(8, 25, 38, 0.96), rgba(5, 15, 22, 0.96))",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.20)",
    padding: "14px",
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

export default function OpenSkyAirframeDetails() {
    const [host, setHost] =
        useState<HTMLDivElement | null>(null);
    const [icao24, setIcao24] =
        useState("");
    const [info, setInfo] =
        useState<AirframeInfo | null>(null);

    useEffect(() => {
        function sync() {
            const aircraftHost =
                document.querySelector<HTMLDivElement>(
                    "#luma-aircraft-card-host"
                );

            const details =
                document.querySelector(
                    ".aircraft-details"
                );

            if (!aircraftHost || !details) {
                setHost(null);
                return;
            }

            const rows =
                Array.from(
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
                /^[0-9a-f]{6}$/.test(nextIcao) &&
                nextIcao !== icao24
            ) {
                setIcao24(nextIcao);
            }

            let detailsHost =
                details.querySelector<HTMLDivElement>(
                    "#luma-opensky-airframe-host"
                );

            if (!detailsHost) {
                detailsHost =
                    document.createElement("div");
                detailsHost.id =
                    "luma-opensky-airframe-host";
                aircraftHost.insertAdjacentElement(
                    "afterend",
                    detailsHost
                );
            }

            setHost(detailsHost);
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
                    "#luma-opensky-airframe-host"
                )
                ?.remove();
        };
    }, [icao24]);

    useEffect(() => {
        if (!icao24) {
            setInfo(null);
            return;
        }

        const controller =
            new AbortController();

        async function load() {
            try {
                const response =
                    await fetch(
                        `/api/radar/airframe?icao24=${encodeURIComponent(
                            icao24
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
                    AirframeInfo =
                    await response.json();

                setInfo(
                    data.found
                        ? data
                        : null
                );
            } catch (error) {
                if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                console.error(
                    "OpenSky airframe card error:",
                    error
                );
                setInfo(null);
            }
        }

        load();

        return () => {
            controller.abort();
        };
    }, [icao24]);

    if (!host || !info) {
        return null;
    }

    return createPortal(
        <section
            style={cardStyle}
            aria-label="OpenSky airframe history"
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    marginBottom: "14px",
                }}
            >
                <div>
                    <span style={labelStyle}>
                        AIRFRAME HISTORY
                    </span>
                    <strong
                        style={{
                            display: "block",
                            color: "#4ebbff",
                            fontSize: "15px",
                            lineHeight: 1.25,
                        }}
                    >
                        {info.model ||
                            info.typeCode ||
                            "OpenSky Metadata"}
                    </strong>
                </div>

                <span
                    style={{
                        flexShrink: 0,
                        border:
                            "1px solid rgba(78,187,255,0.18)",
                        borderRadius: "999px",
                        padding: "5px 8px",
                        color: "rgba(78,187,255,0.8)",
                        fontSize: "9px",
                        letterSpacing: "0.1em",
                    }}
                >
                    OPENSKY
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
                <AirframeValue
                    label="MSN / SERIAL"
                    value={info.serialNumber}
                />
                <AirframeValue
                    label="LINE NUMBER"
                    value={info.lineNumber}
                />
                <AirframeValue
                    label="BUILT"
                    value={info.built}
                />
                <AirframeValue
                    label="YEAR BUILT"
                    value={
                        info.yearBuilt != null
                            ? String(info.yearBuilt)
                            : null
                    }
                />
                <AirframeValue
                    label="AIRFRAME AGE"
                    value={
                        info.ageYears != null
                            ? `${info.ageYears} years`
                            : null
                    }
                />
                <AirframeValue
                    label="FIRST FLIGHT"
                    value={
                        info.firstFlightDate
                    }
                />
                <AirframeValue
                    label="ENGINES"
                    value={info.engines}
                />
                <AirframeValue
                    label="SEAT CONFIG"
                    value={
                        info.seatConfiguration
                    }
                />
                <AirframeValue
                    label="OPERATOR"
                    value={info.operator}
                />
                <AirframeValue
                    label="OPERATOR ICAO / IATA"
                    value={
                        [
                            info.operatorIcao,
                            info.operatorIata,
                        ]
                            .filter(Boolean)
                            .join(" / ") || null
                    }
                />
                <AirframeValue
                    label="OPERATOR CALLSIGN"
                    value={
                        info.operatorCallsign
                    }
                />
                <AirframeValue
                    label="OWNER"
                    value={info.owner}
                />
                <AirframeValue
                    label="REGISTERED SINCE"
                    value={info.registered}
                />
                <AirframeValue
                    label="REGISTERED UNTIL"
                    value={info.regUntil}
                />
                <AirframeValue
                    label="STATUS"
                    value={info.status}
                />
                <AirframeValue
                    label="ICAO TYPE"
                    value={info.typeCode}
                />
            </div>

            {info.categoryDescription && (
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
                        {info.categoryDescription}
                    </span>
                </div>
            )}
        </section>,
        host
    );
}

function AirframeValue({
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
