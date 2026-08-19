"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GeoJsonFeature = {
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: unknown;
};

type GeoJsonCollection = {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

export default function AirspaceLayers() {
    const [open, setOpen] = useState(false);
    const [countriesOn, setCountriesOn] = useState(false);
    const [firOn, setFirOn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const countryLayer = useRef<any>(null);
    const firLayer = useRef<any>(null);
    const dataRef = useRef<{ countries?: GeoJsonCollection; fir?: GeoJsonCollection }>({});

    const activeCount = useMemo(
        () => Number(countriesOn) + Number(firOn),
        [countriesOn, firOn]
    );

    useEffect(() => {
        void renderLayers();
    }, [countriesOn, firOn]);

    useEffect(() => {
        return () => {
            countryLayer.current?.remove();
            firLayer.current?.remove();
        };
    }, []);

    async function ensureData(kind: "countries" | "fir") {
        if (dataRef.current[kind]) return dataRef.current[kind];

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/radar/airspace?layer=${kind}`, {
                cache: "force-cache",
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string } | null;
                throw new Error(payload?.error ?? "Airspace data unavailable");
            }

            const data = (await response.json()) as GeoJsonCollection;
            dataRef.current[kind] = data;
            return data;
        } catch (caught) {
            const message = caught instanceof Error ? caught.message : "Airspace data unavailable.";
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }

    async function renderLayers() {
        const map = window.__lumaRadarMap;
        if (!map) {
            window.setTimeout(renderLayers, 150);
            return;
        }

        const L = await import("leaflet");

        if (!countriesOn) {
            countryLayer.current?.remove();
            countryLayer.current = null;
        } else if (!countryLayer.current) {
            const data = await ensureData("countries");
            if (data) {
                countryLayer.current = L.geoJSON(data as any, {
                    style: {
                        color: "#63ffe3",
                        weight: 1,
                        opacity: 0.34,
                        fillOpacity: 0,
                        dashArray: "4 6",
                    },
                    interactive: false,
                }).addTo(map);
            }
        }

        if (!firOn) {
            firLayer.current?.remove();
            firLayer.current = null;
        } else if (!firLayer.current) {
            const data = await ensureData("fir");
            if (data) {
                firLayer.current = L.geoJSON(data as any, {
                    style: {
                        color: "#b88cff",
                        weight: 1.3,
                        opacity: 0.64,
                        fillColor: "#b88cff",
                        fillOpacity: 0.025,
                        dashArray: "8 6",
                    },
                    onEachFeature(feature: any, layer: any) {
                        const label = firLabel(feature?.properties ?? {});
                        if (label) {
                            layer.bindTooltip(label, {
                                sticky: true,
                                direction: "top",
                                opacity: 0.92,
                            });
                        }
                    },
                }).addTo(map);
            }
        }
    }

    return (
        <div style={{ position: "fixed", left: 138, bottom: 56, zIndex: 1495, fontFamily: "inherit" }}>
            {!open ? (
                <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
                    ◫ AIRSPACE{activeCount ? ` · ${activeCount}` : ""}
                </button>
            ) : (
                <section style={panelStyle}>
                    <div style={headerStyle}>
                        <div>
                            <small style={eyebrowStyle}>AIRSPACE INTELLIGENCE</small>
                            <strong style={{ color: "rgba(255,255,255,0.94)", fontSize: 14 }}>
                                Reference Layers
                            </strong>
                        </div>
                        <button type="button" onClick={() => setOpen(false)} style={closeStyle}>×</button>
                    </div>

                    <div style={{ padding: 14 }}>
                        <LayerToggle
                            label="COUNTRY BORDERS"
                            description="Natural Earth reference boundaries"
                            checked={countriesOn}
                            onChange={setCountriesOn}
                        />
                        <LayerToggle
                            label="FIR BOUNDARIES"
                            description="Worldwide flight information regions"
                            checked={firOn}
                            onChange={setFirOn}
                        />

                        {loading && <div style={statusStyle}>LOADING LAYER DATA...</div>}
                        {error && <div style={errorStyle}>{error}</div>}

                        <div style={noticeStyle}>
                            FIR geometry is a reference layer for situational awareness only. It is not an official aeronautical chart and must not be used for navigation.
                        </div>

                        <div style={legendStyle}>
                            <div><span style={{ ...lineSampleStyle, borderColor: "#63ffe3" }} />COUNTRY</div>
                            <div><span style={{ ...lineSampleStyle, borderColor: "#b88cff" }} />FIR</div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

function LayerToggle({ label, description, checked, onChange }: {
    label: string;
    description: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <button type="button" onClick={() => onChange(!checked)} style={{ ...layerButtonStyle, borderColor: checked ? "rgba(184,140,255,0.30)" : "rgba(255,255,255,0.07)" }}>
            <div>
                <strong style={{ display: "block", color: checked ? "rgba(220,205,255,0.96)" : "rgba(255,255,255,0.78)", fontSize: 10, letterSpacing: "0.08em" }}>{label}</strong>
                <small style={{ color: "rgba(255,255,255,0.34)", fontSize: 8 }}>{description}</small>
            </div>
            <span style={{ ...switchStyle, background: checked ? "rgba(184,140,255,0.26)" : "rgba(255,255,255,0.05)", color: checked ? "#d8c7ff" : "rgba(255,255,255,0.32)" }}>{checked ? "ON" : "OFF"}</span>
        </button>
    );
}

function firLabel(properties: Record<string, unknown>) {
    const keys = ["name", "NAME", "FIRname", "FIR_NAME", "fir_name", "AV_NAME", "NAME_LONG"];
    const codeKeys = ["id", "IDENT", "ICAOCODE", "ICAO", "icao", "AV_AIRSPAC", "designator"];
    const name = keys.map((key) => properties[key]).find((value) => typeof value === "string" && value.trim());
    const code = codeKeys.map((key) => properties[key]).find((value) => typeof value === "string" && value.trim());
    return [code, name].filter(Boolean).join(" · ") || "FIR";
}

const triggerStyle: React.CSSProperties = { border: "1px solid rgba(184,140,255,0.22)", borderRadius: 999, padding: "10px 14px", background: "rgba(5,17,20,0.90)", color: "rgba(205,186,255,0.94)", boxShadow: "0 10px 34px rgba(0,0,0,0.28)", cursor: "pointer", fontSize: 10, letterSpacing: "0.12em" };
const panelStyle: React.CSSProperties = { width: "min(360px, calc(100vw - 36px))", border: "1px solid rgba(184,140,255,0.22)", borderRadius: 16, background: "rgba(5,17,20,0.96)", boxShadow: "0 22px 60px rgba(0,0,0,0.42)", overflow: "hidden", backdropFilter: "blur(14px)" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" };
const eyebrowStyle: React.CSSProperties = { display: "block", color: "rgba(184,140,255,0.72)", fontSize: 8, letterSpacing: "0.15em" };
const closeStyle: React.CSSProperties = { width: 30, height: 30, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18 };
const layerButtonStyle: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8, padding: "11px 11px", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, background: "rgba(255,255,255,0.025)", textAlign: "left", cursor: "pointer" };
const switchStyle: React.CSSProperties = { minWidth: 38, padding: "5px 7px", borderRadius: 999, textAlign: "center", fontSize: 8, letterSpacing: "0.08em" };
const statusStyle: React.CSSProperties = { marginTop: 10, color: "rgba(184,140,255,0.72)", fontSize: 8, letterSpacing: "0.08em" };
const errorStyle: React.CSSProperties = { marginTop: 10, padding: 9, borderRadius: 9, background: "rgba(255,90,90,0.08)", color: "rgba(255,150,150,0.9)", fontSize: 9 };
const noticeStyle: React.CSSProperties = { marginTop: 12, padding: "10px 11px", borderRadius: 10, background: "rgba(255,190,80,0.05)", border: "1px solid rgba(255,190,80,0.10)", color: "rgba(255,220,155,0.54)", fontSize: 8, lineHeight: 1.5 };
const legendStyle: React.CSSProperties = { display: "flex", gap: 14, marginTop: 12, color: "rgba(255,255,255,0.34)", fontSize: 8 };
const lineSampleStyle: React.CSSProperties = { display: "inline-block", width: 18, marginRight: 6, borderTop: "1px dashed", verticalAlign: "middle" };
