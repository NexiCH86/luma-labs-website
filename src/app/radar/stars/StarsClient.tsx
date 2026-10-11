"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SkyObject } from "./stars-data";
import { fallbackCatalog, loadSkyCatalog, solarSystemObjects, type Observer, type SkyCatalog } from "./sky-catalog";

type ViewState = { zoom: number; offsetX: number; offsetY: number };
type ViewMode = "sky" | "catalog";
type Point = { x: number; y: number };

const DEFAULT_VIEW: ViewState = { zoom: 1, offsetX: 0, offsetY: 0 };
const DEFAULT_OBSERVER: Observer = { lat: 47.3769, lon: 8.5417 };
const CARDINALS: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function hoursLabel(hours: number) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatDistance(object: SkyObject) {
    if (object.kind === "planet") return `${object.distanceAu < 0.1 ? (object.distanceAu * 149_597_871).toLocaleString("de-CH", { maximumFractionDigits: 0 }) + " km" : object.distanceAu.toFixed(2) + " AU"}`;
    const distance = object.distanceLy;
    if (!distance) return "Unknown";
    if (distance >= 1_000_000) return `${(distance / 1_000_000).toFixed(2)} M ly`;
    if (distance >= 1_000) return `${(distance / 1_000).toFixed(1)} k ly`;
    return `${distance.toLocaleString("de-CH")} ly`;
}

function objectSubtitle(object: SkyObject) {
    if (object.kind === "dso") return [object.catalog, object.constellation].filter(Boolean).join(" · ");
    if (object.kind === "planet") return object.name === "Sun" ? "Star · Solar system" : object.name === "Moon" ? "Moon · Solar system" : "Planet · Solar system";
    return `${object.designation ?? "Star"} · ${object.constellation}`;
}

function julianDate(date: Date) {
    return date.getTime() / 86400000 + 2440587.5;
}

function localSiderealTime(date: Date, lon: number) {
    const jd = julianDate(date);
    const d = jd - 2451545.0;
    const gmst = 18.697374558 + 24.06570982441908 * d;
    return ((gmst + lon / 15) % 24 + 24) % 24;
}

/*
 * Hoehe/Azimut aus Rektaszension (h) und Deklination (Grad).
 * Die Ortssternzeit wird einmal pro Zeichnung berechnet.
 */
function horizontal(ra: number, decDeg: number, lst: number, latDeg: number) {
    let hourAngle = (lst - ra) * 15;
    if (hourAngle > 180) hourAngle -= 360;
    if (hourAngle < -180) hourAngle += 360;

    const ha = (hourAngle * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    const lat = (latDeg * Math.PI) / 180;

    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const altitude = Math.asin(clamp(sinAlt, -1, 1));
    const cosAz = (Math.sin(dec) - Math.sin(altitude) * Math.sin(lat)) / (Math.cos(altitude) * Math.cos(lat));
    let azimuth = Math.acos(clamp(cosAz, -1, 1));
    if (Math.sin(ha) > 0) azimuth = 2 * Math.PI - azimuth;

    return { altitude: (altitude * 180) / Math.PI, azimuth: (azimuth * 180) / Math.PI };
}

function applyView(x: number, y: number, width: number, height: number, view: ViewState): Point {
    return {
        x: (x - width / 2) * view.zoom + width / 2 + view.offsetX,
        y: (y - height / 2) * view.zoom + height / 2 + view.offsetY,
    };
}

/*
 * Katalogansicht: Rektaszension waagrecht, Deklination senkrecht.
 */
function projectCatalog(ra: number, dec: number, width: number, height: number, view: ViewState): Point {
    return applyView(((ra % 24) / 24) * width, ((90 - dec) / 180) * height, width, height, view);
}

/*
 * Himmelsansicht: Blick nach oben, Zenit in der Mitte, Horizont als
 * Kreis, Norden oben und Osten links (wie auf drehbaren Sternkarten).
 */
function projectSkyDome(altitude: number, azimuth: number, width: number, height: number, view: ViewState): Point {
    const radius = (Math.min(width, height) / 2) * 0.92;
    const r = ((90 - altitude) / 90) * radius;
    const az = (azimuth * Math.PI) / 180;
    return applyView(width / 2 - r * Math.sin(az), height / 2 - r * Math.cos(az), width, height, view);
}

export default function StarsClient() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    const [catalog, setCatalog] = useState<SkyCatalog>(fallbackCatalog);
    const [catalogError, setCatalogError] = useState("");
    const [mode, setMode] = useState<ViewMode>("sky");
    const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [showStars, setShowStars] = useState(true);
    const [showPlanets, setShowPlanets] = useState(true);
    const [showDso, setShowDso] = useState(true);
    const [showConstellations, setShowConstellations] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [magnitudeLimit, setMagnitudeLimit] = useState(5.5);
    const [observer, setObserver] = useState<Observer>(DEFAULT_OBSERVER);
    const [skyTime, setSkyTime] = useState(() => new Date());
    const [liveTime, setLiveTime] = useState(true);

    useEffect(() => {
        let active = true;
        loadSkyCatalog()
            .then((loaded) => { if (active) setCatalog(loaded); })
            .catch((error: unknown) => { if (active) setCatalogError(error instanceof Error ? error.message : "Sky catalog unavailable"); });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!liveTime) return;
        const timer = window.setInterval(() => setSkyTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, [liveTime]);

    const planets = useMemo(() => solarSystemObjects(skyTime, observer), [skyTime, observer]);

    const allObjects = useMemo<SkyObject[]>(() => [...planets, ...catalog.dsos, ...catalog.stars], [planets, catalog]);

    const selected = useMemo(() => allObjects.find((item) => item.id === selectedId) ?? null, [allObjects, selectedId]);

    const visibleStars = useMemo(() => catalog.stars.filter((star) => star.magnitude <= magnitudeLimit), [catalog, magnitudeLimit]);

    const lst = useMemo(() => localSiderealTime(skyTime, observer.lon), [skyTime, observer.lon]);

    const sunAltitude = useMemo(() => {
        const sun = planets.find((planet) => planet.id === "sun");
        return sun ? horizontal(sun.ra, sun.dec, lst, observer.lat).altitude : -90;
    }, [planets, lst, observer.lat]);

    const filteredResults = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];
        return allObjects.filter((item) => {
            if (item.kind === "star" && item.name.startsWith("HIP ")) return false;
            const extra = item.kind === "dso" ? item.catalog : item.kind === "star" ? item.designation ?? "" : "";
            return `${item.name} ${extra} ${item.constellation}`.toLowerCase().includes(needle);
        }).slice(0, 8);
    }, [allObjects, query]);

    const selectedHorizontal = useMemo(
        () => (selected ? horizontal(selected.ra, selected.dec, lst, observer.lat) : null),
        [selected, lst, observer.lat]
    );

    /*
     * Bildschirmposition fuer die aktuelle Ansicht, null = unter dem Horizont.
     */
    const project = useCallback((ra: number, dec: number, width: number, height: number, state: ViewState = view): Point | null => {
        if (mode === "catalog") return projectCatalog(ra, dec, width, height, state);
        const { altitude, azimuth } = horizontal(ra, dec, lst, observer.lat);
        if (altitude < -1) return null;
        return projectSkyDome(altitude, azimuth, width, height, state);
    }, [mode, view, lst, observer.lat]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const width = rect.width;
        const height = rect.height;
        const inView = (p: Point | null, margin = 30): p is Point => !!p && p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;

        const bg = ctx.createRadialGradient(width * 0.46, height * 0.48, 0, width * 0.46, height * 0.48, Math.max(width, height) * 0.8);
        bg.addColorStop(0, "#08142c");
        bg.addColorStop(0.48, "#030b1b");
        bg.addColorStop(1, "#01030b");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.strokeStyle = "rgba(110,160,255,.18)";
        ctx.lineWidth = 1;
        if (mode === "catalog") {
            ctx.globalAlpha = 0.35;
            for (let ra = 0; ra <= 24; ra += 2) {
                const a = projectCatalog(ra, 90, width, height, view);
                const b = projectCatalog(ra, -90, width, height, view);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            for (let dec = -60; dec <= 60; dec += 30) {
                const a = projectCatalog(0, dec, width, height, view);
                const b = projectCatalog(24, dec, width, height, view);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
        } else {
            const center = applyView(width / 2, height / 2, width, height, view);
            const horizonRadius = (Math.min(width, height) / 2) * 0.92 * view.zoom;
            for (const altitude of [60, 30]) {
                ctx.beginPath(); ctx.arc(center.x, center.y, horizonRadius * ((90 - altitude) / 90), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.strokeStyle = "rgba(99,255,227,.55)";
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(center.x, center.y, horizonRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "rgba(99,255,227,.85)";
            ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (const [label, azimuth] of CARDINALS) {
                const p = projectSkyDome(-6, azimuth, width, height, view);
                ctx.fillText(label, p.x, p.y);
            }
        }
        ctx.restore();

        if (showConstellations) {
            ctx.save();
            ctx.strokeStyle = "rgba(112,169,255,.32)";
            ctx.lineWidth = 1;
            for (const constellation of catalog.constellations) {
                for (const line of constellation.lines) {
                    let previous: Point | null = null;
                    let previousRa = 0;
                    for (const [ra, dec] of line) {
                        const point = project(ra, dec, width, height);
                        // In der Katalogansicht nicht ueber den RA-Rand (0h/24h) zeichnen.
                        const wraps = mode === "catalog" && Math.abs(ra - previousRa) > 12;
                        if (previous && point && !wraps) {
                            ctx.beginPath(); ctx.moveTo(previous.x, previous.y); ctx.lineTo(point.x, point.y); ctx.stroke();
                        }
                        previous = point;
                        previousRa = ra;
                    }
                }
            }
            if (showLabels && catalog.complete) {
                ctx.fillStyle = "rgba(140,180,255,.42)";
                ctx.font = "10px ui-sans-serif, system-ui";
                ctx.textAlign = "center";
                for (const constellation of catalog.constellations) {
                    const p = project(constellation.ra, constellation.dec, width, height);
                    if (inView(p)) ctx.fillText(constellation.name.toUpperCase(), p.x, p.y);
                }
            }
            ctx.restore();
        }

        if (showDso) {
            for (const object of catalog.dsos) {
                if (object.magnitude > magnitudeLimit + 4) continue;
                const p = project(object.ra, object.dec, width, height);
                if (!inView(p)) continue;
                const selectedObject = object.id === selectedId;
                ctx.save();
                ctx.strokeStyle = selectedObject ? "#f7c768" : "rgba(112,224,255,.75)";
                ctx.fillStyle = selectedObject ? "rgba(247,199,104,.22)" : "rgba(112,224,255,.08)";
                ctx.lineWidth = selectedObject ? 2 : 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedObject ? 7 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (showLabels && (selectedObject || object.magnitude <= 6 || view.zoom >= 2)) {
                    ctx.fillStyle = selectedObject ? "#ffe3a6" : "rgba(184,232,255,.7)";
                    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
                    ctx.fillText(object.catalog, p.x + 8, p.y - 6);
                }
                ctx.restore();
            }
        }

        if (showStars) {
            const labelLimit = view.zoom >= 2.5 ? 3 : 1.8;
            for (const star of visibleStars) {
                const p = project(star.ra, star.dec, width, height);
                if (!inView(p)) continue;
                const selectedStar = star.id === selectedId;
                const radius = clamp((6.2 - star.magnitude) * 0.55, 0.55, 5.3) * Math.sqrt(view.zoom);
                ctx.save();
                // Glow nur fuer helle Sterne, sonst wird das Zeichnen von 5000 Sternen traege.
                ctx.shadowBlur = selectedStar ? 22 : star.magnitude < 2 ? radius * 3 : 0;
                ctx.shadowColor = star.color ?? "#ffffff";
                ctx.fillStyle = star.color ?? "#ffffff";
                ctx.globalAlpha = clamp(1.1 - star.magnitude * 0.11, 0.4, 1);
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedStar ? radius + 2.4 : radius, 0, Math.PI * 2); ctx.fill();
                if (selectedStar) {
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = "rgba(255,213,124,.9)";
                    ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.stroke();
                }
                if (showLabels && (selectedStar || (star.magnitude <= labelLimit && !star.name.startsWith("HIP ")))) {
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = selectedStar ? "#ffe3a6" : "rgba(238,244,255,.8)";
                    ctx.font = selectedStar ? "600 12px ui-sans-serif, system-ui" : "11px ui-sans-serif, system-ui";
                    ctx.fillText(star.name, p.x + radius + 6, p.y - radius - 2);
                }
                ctx.restore();
            }
        }

        if (showPlanets) {
            for (const planet of planets) {
                const p = project(planet.ra, planet.dec, width, height);
                if (!inView(p)) continue;
                const selectedPlanet = planet.id === selectedId;
                const radius = planet.id === "sun" || planet.id === "moon" ? 9 : 5;
                const color = planet.id === "sun" ? "#ffd27a" : planet.id === "moon" ? "#e8ecf4" : planet.id === "mars" ? "#ff9b6b" : "#f7e3a3";
                ctx.save();
                ctx.shadowBlur = 16;
                ctx.shadowColor = color;
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
                if (selectedPlanet) {
                    ctx.strokeStyle = "rgba(255,213,124,.9)";
                    ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 7, 0, Math.PI * 2); ctx.stroke();
                }
                if (showLabels) {
                    ctx.fillStyle = selectedPlanet ? "#ffe3a6" : "rgba(255,236,190,.92)";
                    ctx.font = "600 11px ui-sans-serif, system-ui";
                    ctx.fillText(planet.name, p.x + radius + 6, p.y - radius);
                }
                ctx.restore();
            }
        }

        ctx.fillStyle = "rgba(255,255,255,.48)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "left";
        if (mode === "catalog") {
            ctx.fillText("RA 00h", 14, height - 16);
            ctx.fillText("RA 12h", width / 2 - 20 + view.offsetX, height - 16);
            ctx.fillText("RA 24h", width - 54, height - 16);
        } else {
            ctx.fillText(`LAT ${observer.lat.toFixed(2)}° · LON ${observer.lon.toFixed(2)}° · LST ${hoursLabel(lst)}`, 14, height - 16);
        }
    }, [catalog, magnitudeLimit, mode, observer, lst, planets, project, selectedId, showConstellations, showDso, showLabels, showPlanets, showStars, view, visibleStars]);

    useEffect(() => {
        draw();
        const resize = () => draw();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [draw]);

    function pickObject(clientX: number, clientY: number) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: { id: string; distance: number } | null = null;
        for (const object of allObjects) {
            if (object.kind === "star" && (!showStars || object.magnitude > magnitudeLimit)) continue;
            if (object.kind === "dso" && !showDso) continue;
            if (object.kind === "planet" && !showPlanets) continue;
            const p = project(object.ra, object.dec, rect.width, rect.height);
            if (!p) continue;
            const distance = Math.hypot(p.x - x, p.y - y);
            if (distance <= 14 && (!best || distance < best.distance)) best = { id: object.id, distance };
        }
        if (best) setSelectedId(best.id);
    }

    function focusObject(object: SkyObject) {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        const zoomed = { zoom: 1.9, offsetX: 0, offsetY: 0 };
        let base = project(object.ra, object.dec, rect.width, rect.height, zoomed);
        if (!base) {
            // Unter dem Horizont: in der Katalogansicht zeigen.
            setMode("catalog");
            base = projectCatalog(object.ra, object.dec, rect.width, rect.height, zoomed);
        }
        setView({ zoom: 1.9, offsetX: rect.width / 2 - base.x, offsetY: rect.height / 2 - base.y });
        setSelectedId(object.id);
        setQuery("");
    }

    function switchMode(next: ViewMode) {
        setMode(next);
        setView(DEFAULT_VIEW);
    }

    const visibleNow = selectedHorizontal ? selectedHorizontal.altitude > 0 : false;

    return (
        <main className="stars-workspace">
            <header className="stars-topbar">
                <div>
                    <div className="stars-kicker">LuMa RADAR · STARS</div>
                    <h1>Celestial Operations</h1>
                </div>
                <div className="stars-status-row">
                    <span className="stars-live-dot" />
                    <span>{liveTime ? "LIVE SKY" : "TIME SHIFT"}</span>
                    <span className="stars-separator">•</span>
                    <span>{visibleStars.length.toLocaleString("de-CH")} stars</span>
                    <span className="stars-separator">•</span>
                    <span>{catalog.constellations.length} constellations</span>
                    <span className="stars-separator">•</span>
                    <span>{catalog.dsos.length} deep-sky</span>
                </div>
            </header>

            <section className="stars-layout">
                <aside className="stars-panel stars-left-panel">
                    <div className="stars-panel-title">Sky Navigator</div>
                    <div className="stars-search-wrap">
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Sirius, Jupiter, M31, Orion…" />
                        {filteredResults.length > 0 && (
                            <div className="stars-search-results">
                                {filteredResults.map((item) => (
                                    <button key={item.id} onClick={() => focusObject(item)}>
                                        <strong>{item.kind === "dso" ? item.catalog : item.name}</strong>
                                        <span>{item.kind === "dso" ? item.name : item.constellation}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="stars-section-label">View</div>
                    <div className="stars-time-controls">
                        <button onClick={() => switchMode("sky")} style={mode === "sky" ? activeModeStyle : undefined}>Sky now</button>
                        <button onClick={() => switchMode("catalog")} style={mode === "catalog" ? activeModeStyle : undefined}>Catalog</button>
                    </div>

                    <div className="stars-section-label">Layers</div>
                    <label className="stars-toggle"><input type="checkbox" checked={showStars} onChange={(e) => setShowStars(e.target.checked)} /><span>Stars</span><b>{visibleStars.length.toLocaleString("de-CH")}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showPlanets} onChange={(e) => setShowPlanets(e.target.checked)} /><span>Sun, Moon & planets</span><b>{planets.length}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showConstellations} onChange={(e) => setShowConstellations(e.target.checked)} /><span>Constellations</span><b>{catalog.constellations.length}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showDso} onChange={(e) => setShowDso(e.target.checked)} /><span>Deep sky</span><b>{catalog.dsos.length}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /><span>Labels</span><b>Auto</b></label>

                    <div className="stars-section-label">Magnitude limit</div>
                    <div className="stars-range-row">
                        <input type="range" min="1" max="6.5" step="0.25" value={magnitudeLimit} onChange={(e) => setMagnitudeLimit(Number(e.target.value))} />
                        <span>{magnitudeLimit.toFixed(2)}</span>
                    </div>

                    <div className="stars-section-label">Observer</div>
                    <div className="stars-coordinate-grid">
                        <label>LAT<input type="number" step="0.0001" value={observer.lat} onChange={(e) => setObserver((v) => ({ ...v, lat: Number(e.target.value) }))} /></label>
                        <label>LON<input type="number" step="0.0001" value={observer.lon} onChange={(e) => setObserver((v) => ({ ...v, lon: Number(e.target.value) }))} /></label>
                    </div>
                    <button className="stars-secondary-button" onClick={() => setObserver(DEFAULT_OBSERVER)}>Zürich preset</button>
                    {catalogError && <p className="stars-muted">{catalogError} – showing starter catalog.</p>}
                </aside>

                <div ref={wrapperRef} className="stars-canvas-wrap">
                    <canvas
                        ref={canvasRef}
                        onWheel={(event) => {
                            event.preventDefault();
                            setView((v) => ({ ...v, zoom: clamp(v.zoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.8, 8) }));
                        }}
                        onMouseDown={(event) => {
                            draggingRef.current = { x: event.clientX, y: event.clientY, offsetX: view.offsetX, offsetY: view.offsetY };
                        }}
                        onMouseMove={(event) => {
                            const drag = draggingRef.current;
                            if (!drag) return;
                            setView((v) => ({ ...v, offsetX: drag.offsetX + event.clientX - drag.x, offsetY: drag.offsetY + event.clientY - drag.y }));
                        }}
                        onMouseUp={(event) => {
                            const drag = draggingRef.current;
                            draggingRef.current = null;
                            if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) pickObject(event.clientX, event.clientY);
                        }}
                        onMouseLeave={() => { draggingRef.current = null; }}
                    />
                    <div className="stars-canvas-badge">
                        {mode === "sky"
                            ? sunAltitude > -6 ? "SKY NOW · DAYLIGHT – STARS NOT VISIBLE TO THE EYE" : "SKY NOW · ZENITH CENTER · NORTH UP, EAST LEFT"
                            : "EQUATORIAL · J2000 CATALOG VIEW"}
                    </div>
                    <div className="stars-canvas-controls">
                        <button onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom * 1.25, 0.8, 8) }))}>+</button>
                        <button onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom / 1.25, 0.8, 8) }))}>−</button>
                        <button onClick={() => setView(DEFAULT_VIEW)}>⌂</button>
                    </div>
                </div>

                <aside className="stars-panel stars-right-panel">
                    <div className="stars-panel-title">Object Intelligence</div>
                    {selected ? (
                        <>
                            <div className="stars-object-heading">
                                <div className={`stars-object-icon ${selected.kind}`}>{selected.kind === "star" ? "✦" : selected.kind === "planet" ? "●" : "◎"}</div>
                                <div><h2>{selected.name}</h2><p>{objectSubtitle(selected)}</p></div>
                            </div>
                            <div className={`stars-visibility ${visibleNow ? "is-visible" : "is-below"}`}>
                                <span />{visibleNow ? "ABOVE HORIZON" : "BELOW HORIZON"}
                            </div>
                            <dl className="stars-data-grid">
                                <div><dt>Right ascension</dt><dd>{hoursLabel(selected.ra)}</dd></div>
                                <div><dt>Declination</dt><dd>{selected.dec.toFixed(2)}°</dd></div>
                                <div><dt>Magnitude</dt><dd>{selected.magnitude < 50 ? selected.magnitude.toFixed(2) : "—"}</dd></div>
                                <div><dt>Distance</dt><dd>{formatDistance(selected)}</dd></div>
                                {selected.kind === "star" && <div><dt>Spectral class</dt><dd>{selected.spectral ?? "—"}</dd></div>}
                                {selected.kind === "dso" && <div><dt>Object type</dt><dd>{selected.objectType}</dd></div>}
                                {selectedHorizontal && <div><dt>Altitude</dt><dd>{selectedHorizontal.altitude.toFixed(1)}°</dd></div>}
                                {selectedHorizontal && <div><dt>Azimuth</dt><dd>{selectedHorizontal.azimuth.toFixed(1)}°</dd></div>}
                                <div><dt>Local sidereal</dt><dd>{hoursLabel(lst)}</dd></div>
                            </dl>
                            <button className="stars-primary-button" onClick={() => focusObject(selected)}>Center object</button>
                        </>
                    ) : <p className="stars-muted">Click a star, planet or deep-sky object, or search for one.</p>}

                    <div className="stars-section-label">Observation time</div>
                    <div className="stars-time-card">
                        <strong>{skyTime.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}</strong>
                        <span>{skyTime.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    <div className="stars-time-controls">
                        <button onClick={() => { setLiveTime(false); setSkyTime((d) => new Date(d.getTime() - 3600000)); }}>−1h</button>
                        <button onClick={() => { setSkyTime(new Date()); setLiveTime(true); }}>Now</button>
                        <button onClick={() => { setLiveTime(false); setSkyTime((d) => new Date(d.getTime() + 3600000)); }}>+1h</button>
                    </div>
                </aside>
            </section>

            <footer className="stars-footer">
                <span>Drag to pan · Wheel to zoom · Click objects to inspect</span>
                <span>Stars, constellations & Messier: d3-celestial (Hipparcos, mag ≤ 6) · Sun, Moon & planets: astronomy-engine</span>
            </footer>
        </main>
    );
}

const activeModeStyle: React.CSSProperties = { borderColor: "rgba(99,255,227,.55)", color: "#63ffe3", background: "rgba(99,255,227,.08)" };
