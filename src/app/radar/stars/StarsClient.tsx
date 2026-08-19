"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONSTELLATION_LINES, DEEP_SKY, SKY_OBJECTS, STARS, type SkyObject } from "./stars-data";

type ViewState = { zoom: number; offsetX: number; offsetY: number };
type Observer = { lat: number; lon: number };

const DEFAULT_VIEW: ViewState = { zoom: 1, offsetX: 0, offsetY: 0 };
const DEFAULT_OBSERVER: Observer = { lat: 47.3769, lon: 8.5417 };

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function hoursLabel(hours: number) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatDistance(distance?: number) {
    if (!distance) return "Unknown";
    if (distance >= 1_000_000) return `${(distance / 1_000_000).toFixed(2)} M ly`;
    if (distance >= 1_000) return `${(distance / 1_000).toFixed(1)} k ly`;
    return `${distance.toLocaleString("de-CH")} ly`;
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

function horizontalCoordinates(object: SkyObject, date: Date, observer: Observer) {
    const lst = localSiderealTime(date, observer.lon);
    let hourAngle = (lst - object.ra) * 15;
    if (hourAngle > 180) hourAngle -= 360;
    if (hourAngle < -180) hourAngle += 360;

    const ha = (hourAngle * Math.PI) / 180;
    const dec = (object.dec * Math.PI) / 180;
    const lat = (observer.lat * Math.PI) / 180;

    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const altitude = Math.asin(clamp(sinAlt, -1, 1));
    const cosAz = (Math.sin(dec) - Math.sin(altitude) * Math.sin(lat)) / (Math.cos(altitude) * Math.cos(lat));
    let azimuth = Math.acos(clamp(cosAz, -1, 1));
    if (Math.sin(ha) > 0) azimuth = 2 * Math.PI - azimuth;

    return {
        altitude: (altitude * 180) / Math.PI,
        azimuth: (azimuth * 180) / Math.PI,
        lst,
    };
}

function objectToScreen(object: SkyObject, width: number, height: number, view: ViewState) {
    const baseX = ((object.ra % 24) / 24) * width;
    const baseY = ((90 - object.dec) / 180) * height;
    return {
        x: (baseX - width / 2) * view.zoom + width / 2 + view.offsetX,
        y: (baseY - height / 2) * view.zoom + height / 2 + view.offsetY,
    };
}

export default function StarsClient() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
    const [selectedId, setSelectedId] = useState<string>("sirius");
    const [query, setQuery] = useState("");
    const [showStars, setShowStars] = useState(true);
    const [showDso, setShowDso] = useState(true);
    const [showConstellations, setShowConstellations] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [magnitudeLimit, setMagnitudeLimit] = useState(6);
    const [observer, setObserver] = useState<Observer>(DEFAULT_OBSERVER);
    const [skyTime, setSkyTime] = useState(() => new Date());
    const [liveTime, setLiveTime] = useState(true);

    const selected = useMemo(
        () => SKY_OBJECTS.find((item) => item.id === selectedId) ?? null,
        [selectedId]
    );

    const filteredResults = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [];
        return SKY_OBJECTS.filter((item) => {
            const extra = item.kind === "dso" ? item.catalog : item.designation ?? "";
            return `${item.name} ${extra} ${item.constellation}`.toLowerCase().includes(needle);
        }).slice(0, 8);
    }, [query]);

    const visibleStars = useMemo(
        () => STARS.filter((star) => star.magnitude <= magnitudeLimit),
        [magnitudeLimit]
    );

    const selectedHorizontal = useMemo(
        () => selected ? horizontalCoordinates(selected, skyTime, observer) : null,
        [selected, skyTime, observer]
    );

    useEffect(() => {
        if (!liveTime) return;
        const timer = window.setInterval(() => setSkyTime(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, [liveTime]);

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

        const bg = ctx.createRadialGradient(width * 0.46, height * 0.48, 0, width * 0.46, height * 0.48, Math.max(width, height) * 0.8);
        bg.addColorStop(0, "#08142c");
        bg.addColorStop(0.48, "#030b1b");
        bg.addColorStop(1, "#01030b");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "rgba(110,160,255,.18)";
        ctx.lineWidth = 1;
        for (let ra = 0; ra <= 24; ra += 2) {
            const p1 = objectToScreen({ ...STARS[0], ra, dec: 90 }, width, height, view);
            const p2 = objectToScreen({ ...STARS[0], ra, dec: -90 }, width, height, view);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        for (let dec = -60; dec <= 60; dec += 30) {
            const p1 = objectToScreen({ ...STARS[0], ra: 0, dec }, width, height, view);
            const p2 = objectToScreen({ ...STARS[0], ra: 24, dec }, width, height, view);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        ctx.restore();

        if (showConstellations) {
            ctx.strokeStyle = "rgba(112,169,255,.32)";
            ctx.lineWidth = 1.2;
            for (const lines of Object.values(CONSTELLATION_LINES)) {
                for (const [fromId, toId] of lines) {
                    const from = STARS.find((s) => s.id === fromId);
                    const to = STARS.find((s) => s.id === toId);
                    if (!from || !to) continue;
                    const a = objectToScreen(from, width, height, view);
                    const b = objectToScreen(to, width, height, view);
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
        }

        if (showDso) {
            for (const object of DEEP_SKY) {
                const p = objectToScreen(object, width, height, view);
                if (p.x < -40 || p.x > width + 40 || p.y < -40 || p.y > height + 40) continue;
                const selectedObject = object.id === selectedId;
                ctx.save();
                ctx.strokeStyle = selectedObject ? "#f7c768" : "#70e0ff";
                ctx.fillStyle = selectedObject ? "rgba(247,199,104,.22)" : "rgba(112,224,255,.12)";
                ctx.lineWidth = selectedObject ? 2 : 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedObject ? 8 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(p.x - 10, p.y); ctx.lineTo(p.x + 10, p.y); ctx.moveTo(p.x, p.y - 10); ctx.lineTo(p.x, p.y + 10); ctx.stroke();
                if (showLabels) {
                    ctx.fillStyle = selectedObject ? "#ffe3a6" : "rgba(184,232,255,.8)";
                    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
                    ctx.fillText(`${object.catalog} · ${object.name}`, p.x + 13, p.y - 8);
                }
                ctx.restore();
            }
        }

        if (showStars) {
            for (const star of visibleStars) {
                const p = objectToScreen(star, width, height, view);
                if (p.x < -30 || p.x > width + 30 || p.y < -30 || p.y > height + 30) continue;
                const selectedStar = star.id === selectedId;
                const radius = clamp((4.8 - star.magnitude) * 0.72, 1.2, 5.3) * Math.sqrt(view.zoom);
                ctx.save();
                ctx.shadowBlur = selectedStar ? 22 : Math.max(4, radius * 3);
                ctx.shadowColor = star.color ?? "#ffffff";
                ctx.fillStyle = star.color ?? "#ffffff";
                ctx.globalAlpha = clamp(1.08 - star.magnitude * 0.08, 0.52, 1);
                ctx.beginPath(); ctx.arc(p.x, p.y, selectedStar ? radius + 2.4 : radius, 0, Math.PI * 2); ctx.fill();
                if (selectedStar) {
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = "rgba(255,213,124,.9)";
                    ctx.lineWidth = 1.3;
                    ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.stroke();
                }
                if (showLabels && (star.magnitude <= 1.8 || selectedStar)) {
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = selectedStar ? "#ffe3a6" : "rgba(238,244,255,.84)";
                    ctx.font = selectedStar ? "600 12px ui-sans-serif, system-ui" : "11px ui-sans-serif, system-ui";
                    ctx.fillText(star.name, p.x + radius + 7, p.y - radius - 3);
                }
                ctx.restore();
            }
        }

        ctx.fillStyle = "rgba(255,255,255,.48)";
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("RA 00h", 14, height - 16);
        ctx.fillText("RA 12h", width / 2 - 20 + view.offsetX, height - 16);
        ctx.fillText("RA 24h", width - 54, height - 16);
    }, [magnitudeLimit, selectedId, showConstellations, showDso, showLabels, showStars, view, visibleStars]);

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
        for (const object of SKY_OBJECTS) {
            if (object.kind === "star" && (!showStars || object.magnitude > magnitudeLimit)) continue;
            if (object.kind === "dso" && !showDso) continue;
            const p = objectToScreen(object, rect.width, rect.height, view);
            const distance = Math.hypot(p.x - x, p.y - y);
            if (distance <= 18 && (!best || distance < best.distance)) best = { id: object.id, distance };
        }
        if (best) setSelectedId(best.id);
    }

    function focusObject(object: SkyObject) {
        const rect = wrapperRef.current?.getBoundingClientRect();
        if (!rect) return;
        const base = objectToScreen(object, rect.width, rect.height, { zoom: 1.9, offsetX: 0, offsetY: 0 });
        setView({ zoom: 1.9, offsetX: rect.width / 2 - base.x, offsetY: rect.height / 2 - base.y });
        setSelectedId(object.id);
        setQuery("");
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
                    <span>{visibleStars.length} stars</span>
                    <span className="stars-separator">•</span>
                    <span>{DEEP_SKY.length} deep-sky</span>
                </div>
            </header>

            <section className="stars-layout">
                <aside className="stars-panel stars-left-panel">
                    <div className="stars-panel-title">Sky Navigator</div>
                    <div className="stars-search-wrap">
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Sirius, M31, Orion…" />
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

                    <div className="stars-section-label">Layers</div>
                    <label className="stars-toggle"><input type="checkbox" checked={showStars} onChange={(e) => setShowStars(e.target.checked)} /><span>Stars</span><b>{visibleStars.length}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showConstellations} onChange={(e) => setShowConstellations(e.target.checked)} /><span>Constellations</span><b>2 mapped</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showDso} onChange={(e) => setShowDso(e.target.checked)} /><span>Deep sky</span><b>{DEEP_SKY.length}</b></label>
                    <label className="stars-toggle"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /><span>Labels</span><b>Auto</b></label>

                    <div className="stars-section-label">Magnitude limit</div>
                    <div className="stars-range-row">
                        <input type="range" min="1" max="9" step="0.25" value={magnitudeLimit} onChange={(e) => setMagnitudeLimit(Number(e.target.value))} />
                        <span>{magnitudeLimit.toFixed(2)}</span>
                    </div>

                    <div className="stars-section-label">Observer</div>
                    <div className="stars-coordinate-grid">
                        <label>LAT<input type="number" step="0.0001" value={observer.lat} onChange={(e) => setObserver((v) => ({ ...v, lat: Number(e.target.value) }))} /></label>
                        <label>LON<input type="number" step="0.0001" value={observer.lon} onChange={(e) => setObserver((v) => ({ ...v, lon: Number(e.target.value) }))} /></label>
                    </div>
                    <button className="stars-secondary-button" onClick={() => setObserver(DEFAULT_OBSERVER)}>Zürich preset</button>
                </aside>

                <div ref={wrapperRef} className="stars-canvas-wrap">
                    <canvas
                        ref={canvasRef}
                        onWheel={(event) => {
                            event.preventDefault();
                            setView((v) => ({ ...v, zoom: clamp(v.zoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.8, 5) }));
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
                    <div className="stars-canvas-badge">EQUATORIAL · J2000 CATALOG VIEW</div>
                    <div className="stars-canvas-controls">
                        <button onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom * 1.25, 0.8, 5) }))}>+</button>
                        <button onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom / 1.25, 0.8, 5) }))}>−</button>
                        <button onClick={() => setView(DEFAULT_VIEW)}>⌂</button>
                    </div>
                </div>

                <aside className="stars-panel stars-right-panel">
                    <div className="stars-panel-title">Object Intelligence</div>
                    {selected ? (
                        <>
                            <div className="stars-object-heading">
                                <div className={`stars-object-icon ${selected.kind}`}>{selected.kind === "star" ? "✦" : "◎"}</div>
                                <div><h2>{selected.name}</h2><p>{selected.kind === "dso" ? selected.catalog : selected.designation ?? "Star"} · {selected.constellation}</p></div>
                            </div>
                            <div className={`stars-visibility ${visibleNow ? "is-visible" : "is-below"}`}>
                                <span />{visibleNow ? "ABOVE HORIZON" : "BELOW HORIZON"}
                            </div>
                            <dl className="stars-data-grid">
                                <div><dt>Right ascension</dt><dd>{hoursLabel(selected.ra)}</dd></div>
                                <div><dt>Declination</dt><dd>{selected.dec.toFixed(2)}°</dd></div>
                                <div><dt>Magnitude</dt><dd>{selected.magnitude.toFixed(2)}</dd></div>
                                <div><dt>Distance</dt><dd>{formatDistance(selected.distanceLy)}</dd></div>
                                {selected.kind === "star" ? <div><dt>Spectral class</dt><dd>{selected.spectral ?? "—"}</dd></div> : <div><dt>Object type</dt><dd>{selected.objectType}</dd></div>}
                                {selectedHorizontal && <div><dt>Altitude</dt><dd>{selectedHorizontal.altitude.toFixed(1)}°</dd></div>}
                                {selectedHorizontal && <div><dt>Azimuth</dt><dd>{selectedHorizontal.azimuth.toFixed(1)}°</dd></div>}
                                {selectedHorizontal && <div><dt>Local sidereal</dt><dd>{hoursLabel(selectedHorizontal.lst)}</dd></div>}
                            </dl>
                            <button className="stars-primary-button" onClick={() => focusObject(selected)}>Center object</button>
                        </>
                    ) : <p className="stars-muted">Select a celestial object.</p>}

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
                <span>Catalog foundation: bright stars + Messier showcase · ready for full catalog sync</span>
            </footer>
        </main>
    );
}
