"use client";

import {
    useState,
} from "react";

type AirportInfo = {
    found: boolean;
    icao?: string | null;
    iata?: string | null;
    name?: string | null;
    latitude?: number;
    longitude?: number;
    country?: string | null;
    city?: string | null;
    timezone?: string | null;
    gmt?: string | null;
};

export default function AirportExplorer() {
    const [open, setOpen] =
        useState(false);
    const [code, setCode] =
        useState("");
    const [loading, setLoading] =
        useState(false);
    const [error, setError] =
        useState("");
    const [airport, setAirport] =
        useState<AirportInfo | null>(
            null
        );

    async function searchAirport() {
        const query =
            code
                .trim()
                .toUpperCase();

        setError("");
        setAirport(null);

        if (
            !/^[A-Z0-9]{3,4}$/.test(
                query
            )
        ) {
            setError(
                "Enter a 3-letter IATA or 4-letter ICAO code."
            );
            return;
        }

        setLoading(true);

        try {
            const response =
                await fetch(
                    `/api/radar/airport?code=${encodeURIComponent(
                        query
                    )}`,
                    {
                        cache:
                            "no-store",
                    }
                );

            const data:
                AirportInfo & {
                    error?: string;
                } =
                await response.json();

            if (!response.ok) {
                setError(
                    data.error ??
                        "Airport lookup failed."
                );
                return;
            }

            if (!data.found) {
                setError(
                    "Airport not found."
                );
                return;
            }

            setAirport(data);
        } catch {
            setError(
                "Airport lookup failed."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            style={{
                position: "fixed",
                left: 18,
                bottom: 56,
                zIndex: 1500,
                fontFamily:
                    "inherit",
            }}
        >
            {!open ? (
                <button
                    type="button"
                    onClick={() =>
                        setOpen(true)
                    }
                    style={buttonStyle}
                >
                    ◉ AIRPORTS
                </button>
            ) : (
                <section
                    style={{
                        width: "min(360px, calc(100vw - 36px))",
                        border:
                            "1px solid rgba(99,255,227,0.22)",
                        borderRadius: 16,
                        background:
                            "rgba(5,17,20,0.96)",
                        boxShadow:
                            "0 22px 60px rgba(0,0,0,0.42)",
                        overflow:
                            "hidden",
                        backdropFilter:
                            "blur(14px)",
                    }}
                >
                    <div
                        style={{
                            display:
                                "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center",
                            gap: 12,
                            padding:
                                "14px 14px 10px",
                            borderBottom:
                                "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        <div>
                            <small
                                style={{
                                    display:
                                        "block",
                                    color:
                                        "rgba(99,255,227,0.68)",
                                    fontSize: 9,
                                    letterSpacing:
                                        "0.16em",
                                }}
                            >
                                WORLDWIDE
                            </small>
                            <strong
                                style={{
                                    color:
                                        "rgba(255,255,255,0.94)",
                                    fontSize: 14,
                                }}
                            >
                                Airport Explorer
                            </strong>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setOpen(false)
                            }
                            aria-label="Close airport explorer"
                            style={iconButtonStyle}
                        >
                            ×
                        </button>
                    </div>

                    <div
                        style={{
                            padding: 14,
                        }}
                    >
                        <div
                            style={{
                                display:
                                    "flex",
                                gap: 8,
                            }}
                        >
                            <input
                                value={code}
                                onChange={(
                                    event
                                ) =>
                                    setCode(
                                        event.target.value.toUpperCase()
                                    )
                                }
                                onKeyDown={(
                                    event
                                ) => {
                                    if (
                                        event.key ===
                                        "Enter"
                                    ) {
                                        searchAirport();
                                    }
                                }}
                                placeholder="ZRH / LSZH / JFK / KJFK"
                                maxLength={4}
                                style={inputStyle}
                            />

                            <button
                                type="button"
                                onClick={
                                    searchAirport
                                }
                                disabled={
                                    loading
                                }
                                style={searchButtonStyle}
                            >
                                {loading
                                    ? "..."
                                    : "SEARCH"}
                            </button>
                        </div>

                        <p
                            style={{
                                margin:
                                    "8px 0 0",
                                color:
                                    "rgba(255,255,255,0.32)",
                                fontSize: 9,
                                lineHeight:
                                    1.45,
                            }}
                        >
                            Search by IATA or ICAO airport code.
                        </p>

                        {error && (
                            <div
                                style={{
                                    marginTop:
                                        12,
                                    padding: 10,
                                    borderRadius:
                                        10,
                                    background:
                                        "rgba(255,90,90,0.08)",
                                    color:
                                        "rgba(255,150,150,0.9)",
                                    fontSize: 11,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {airport && (
                            <div
                                style={{
                                    marginTop:
                                        14,
                                    paddingTop:
                                        14,
                                    borderTop:
                                        "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    style={{
                                        display:
                                            "flex",
                                        justifyContent:
                                            "space-between",
                                        alignItems:
                                            "flex-start",
                                        gap: 12,
                                    }}
                                >
                                    <div>
                                        <strong
                                            style={{
                                                display:
                                                    "block",
                                                color:
                                                    "#63ffe3",
                                                fontSize:
                                                    24,
                                                letterSpacing:
                                                    "0.04em",
                                            }}
                                        >
                                            {airport.iata ??
                                                airport.icao ??
                                                "---"}
                                        </strong>
                                        <span
                                            style={{
                                                color:
                                                    "rgba(255,255,255,0.88)",
                                                fontSize:
                                                    12,
                                                lineHeight:
                                                    1.4,
                                            }}
                                        >
                                            {airport.name ??
                                                "Unknown airport"}
                                        </span>
                                    </div>

                                    <span
                                        style={{
                                            color:
                                                "rgba(255,255,255,0.4)",
                                            fontSize:
                                                10,
                                        }}
                                    >
                                        {airport.icao ??
                                            "---"}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        display:
                                            "grid",
                                        gridTemplateColumns:
                                            "1fr 1fr",
                                        gap:
                                            "12px 14px",
                                        marginTop:
                                            16,
                                    }}
                                >
                                    <AirportValue
                                        label="COUNTRY"
                                        value={
                                            airport.country
                                        }
                                    />
                                    <AirportValue
                                        label="CITY CODE"
                                        value={
                                            airport.city
                                        }
                                    />
                                    <AirportValue
                                        label="LATITUDE"
                                        value={
                                            airport.latitude !=
                                            null
                                                ? airport.latitude.toFixed(
                                                      4
                                                  )
                                                : null
                                        }
                                    />
                                    <AirportValue
                                        label="LONGITUDE"
                                        value={
                                            airport.longitude !=
                                            null
                                                ? airport.longitude.toFixed(
                                                      4
                                                  )
                                                : null
                                        }
                                    />
                                    <AirportValue
                                        label="TIMEZONE"
                                        value={
                                            airport.timezone
                                        }
                                    />
                                    <AirportValue
                                        label="GMT"
                                        value={
                                            airport.gmt
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

function AirportValue({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <small
                style={{
                    display: "block",
                    marginBottom: 4,
                    color:
                        "rgba(255,255,255,0.34)",
                    fontSize: 8,
                    letterSpacing:
                        "0.12em",
                }}
            >
                {label}
            </small>
            <span
                style={{
                    color:
                        "rgba(255,255,255,0.9)",
                    fontSize: 11,
                }}
            >
                {value ?? "---"}
            </span>
        </div>
    );
}

const buttonStyle: React.CSSProperties = {
    border: "1px solid rgba(99,255,227,0.22)",
    borderRadius: 999,
    padding: "10px 14px",
    background: "rgba(5,17,20,0.90)",
    color: "rgba(99,255,227,0.92)",
    boxShadow: "0 10px 34px rgba(0,0,0,0.28)",
    cursor: "pointer",
    fontSize: 10,
    letterSpacing: "0.12em",
};

const iconButtonStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    fontSize: 18,
};

const inputStyle: React.CSSProperties = {
    minWidth: 0,
    flex: 1,
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10,
    padding: "10px 11px",
    outline: "none",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontSize: 11,
    textTransform: "uppercase",
};

const searchButtonStyle: React.CSSProperties = {
    border: "1px solid rgba(99,255,227,0.20)",
    borderRadius: 10,
    padding: "0 12px",
    background: "rgba(99,255,227,0.08)",
    color: "rgba(99,255,227,0.9)",
    cursor: "pointer",
    fontSize: 9,
    letterSpacing: "0.10em",
};
