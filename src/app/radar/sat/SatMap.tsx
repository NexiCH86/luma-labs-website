"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { SatCategory } from "@/lib/satellite-source";
import { CARTO_ATTRIBUTION, CARTO_DARK_TILES, COUNTRY_BORDERS_URL, countryBorderStyleForZoom } from "@/lib/basemap";
import { ISS_NORAD, type LivePosition, type Observer, type SatEntry } from "./orbit";

/*
 * Weltkarte (Leaflet) mit allen Satelliten auf einer Canvas-Ebene.
 * Einzelne Leaflet-Marker waeren fuer Starlink (rund 9000 Objekte,
 * jede Sekunde neu) viel zu langsam. Klick und Hover suchen den
 * naechsten gezeichneten Punkt.
 */

export const CATEGORY_COLORS: Record<SatCategory, string> = {
    station: "#ffd166",
    navigation: "#8fa7ff",
    constellation: "#c084fc",
    weather: "#5be7e0",
    earth: "#7cff6b",
    science: "#ff9f6b",
    amateur: "#f472b6",
    geo: "#e2e8f0",
};

/* Quelle der Bahndaten, neben CARTO/OSM in der Kartenecke (auch auf dem Handy sichtbar). */
const CELESTRAK_ATTRIBUTION = 'Orbit data: <a href="https://celestrak.org" target="_blank" rel="noreferrer">CelesTrak</a>';

const SELECTED_COLOR = "#ff74d4";
const HIT_RADIUS_PX = 12;

/* Zu einem Ort oder zu einem Satelliten fliegen (sobald seine Position bekannt ist). */
export type MapFocus = { id: number; zoom: number; norad?: number; latitude?: number; longitude?: number };

type Props = {
    entries: SatEntry[];
    positions: Map<number, LivePosition>;
    selectedNorad: number | null;
    watched: Set<number>;
    track: [number, number][][];
    observer: Observer | null;
    showMarkers: boolean;
    showOrbit: boolean;
    focus: MapFocus | null;
    /* Pixel, um die das Ziel nach oben versetzt wird (offene Leiste auf dem Handy). */
    focusOffsetY?: number;
    onSelect: (norad: number) => void;
};

type ScreenPoint = { x: number; y: number; entry: SatEntry };

export default function SatMap(props: Props) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const mapElement = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const propsRef = useRef(props);
    const pointsRef = useRef<ScreenPoint[]>([]);
    const drawRef = useRef<() => void>(() => {});
    const trackLayer = useRef<L.Polyline | null>(null);
    const observerLayer = useRef<L.Marker | null>(null);
    const pendingFocus = useRef<MapFocus | null>(null);

    useLayoutEffect(() => {
        propsRef.current = props;
    });

    /* Offenes Fokus-Ziel anfliegen, sobald Karte und Position bereit sind. */
    const flyToPending = () => {
        const map = mapRef.current;
        const focus = pendingFocus.current;
        if (!map || !focus) return;
        let target: [number, number] | null = null;
        if (focus.norad != null) {
            const position = propsRef.current.positions.get(focus.norad);
            if (position) target = [position.latitude, position.longitude];
        } else if (focus.latitude != null && focus.longitude != null) {
            target = [focus.latitude, focus.longitude];
        }
        if (!target) return;
        pendingFocus.current = null;
        const zoom = Math.max(focus.zoom, map.getZoom());
        /* Ziel in den sichtbaren Teil ueber der Handy-Leiste setzen. */
        const center = map.unproject(map.project(target, zoom).add([0, propsRef.current.focusOffsetY ?? 0]), zoom);
        map.flyTo(center, zoom, { duration: 1.1 });
    };

    /* Karte einmal aufbauen. */
    useEffect(() => {
        const element = mapElement.current;
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!element || !canvas || !wrapper) return;

        const map = L.map(element, { zoomControl: true, minZoom: 2, maxZoom: 13, worldCopyJump: true }).setView([24, 8], 3);
        mapRef.current = map;
        map.attributionControl.addAttribution(CELESTRAK_ATTRIBUTION);

        const primary = L.tileLayer(CARTO_DARK_TILES, { maxZoom: 20, attribution: CARTO_ATTRIBUTION });
        let fallback = false;
        primary.on("tileerror", () => {
            if (fallback) return;
            fallback = true;
            primary.remove();
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        });
        primary.addTo(map);

        let cancelled = false;
        fetch(COUNTRY_BORDERS_URL, { cache: "force-cache" })
            .then((response) => (response.ok ? response.json() : null))
            .then((borders) => {
                if (!borders || cancelled) return;
                const layer = L.geoJSON(borders, { style: countryBorderStyleForZoom(map.getZoom()), interactive: false }).addTo(map);
                map.on("zoomend", () => layer.setStyle(countryBorderStyleForZoom(map.getZoom())));
            })
            .catch(() => {
                // Karte bleibt ohne zusaetzliche Grenzlinien nutzbar.
            });

        const context = canvas.getContext("2d");

        const draw = () => {
            if (!context) return;
            const { entries, positions, selectedNorad, watched, showMarkers } = propsRef.current;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            const ratio = window.devicePixelRatio || 1;
            if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
                canvas.width = Math.round(width * ratio);
                canvas.height = Math.round(height * ratio);
            }
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            context.clearRect(0, 0, width, height);
            const points: ScreenPoint[] = [];
            pointsRef.current = points;

            const crowded = entries.length > 3000;
            const zoom = map.getZoom();
            let selectedPoint: ScreenPoint | null = null;
            /* Stationsnamen nahe beim ausgewaehlten Objekt weglassen (z. B. angedockte Kapseln an der ISS). */
            const selectedPosition = selectedNorad != null ? positions.get(selectedNorad) : undefined;
            const selectedScreen = selectedPosition ? map.latLngToContainerPoint([selectedPosition.latitude, selectedPosition.longitude]) : null;
            const nearSelected = (x: number, y: number) => selectedScreen != null && Math.abs(x - selectedScreen.x) < 120 && Math.abs(y - selectedScreen.y) < 16;

            for (const entry of entries) {
                const position = positions.get(entry.norad);
                if (!position) continue;
                const isSelected = entry.norad === selectedNorad;
                if (!showMarkers && !isSelected) continue;

                for (const offset of [-360, 0, 360]) {
                    const point = map.latLngToContainerPoint([position.latitude, position.longitude + offset]);
                    if (point.x < -20 || point.y < -20 || point.x > width + 20 || point.y > height + 20) continue;
                    const screen = { x: point.x, y: point.y, entry };
                    points.push(screen);
                    if (isSelected) {
                        selectedPoint = screen;
                        continue;
                    }

                    const color = CATEGORY_COLORS[entry.category] ?? "#ffffff";
                    if (entry.norad === ISS_NORAD) {
                        context.fillStyle = color;
                        context.beginPath();
                        context.roundRect(point.x - 15, point.y - 8, 30, 16, 4);
                        context.fill();
                        context.fillStyle = "#061012";
                        context.font = "700 9px Inter, system-ui, sans-serif";
                        context.textAlign = "center";
                        context.textBaseline = "middle";
                        context.fillText("ISS", point.x, point.y + 0.5);
                        continue;
                    }

                    const radius = entry.category === "station" ? 4 : crowded ? 1.6 : 3;
                    context.fillStyle = color;
                    context.globalAlpha = crowded && entry.category === "constellation" ? 0.75 : 1;
                    context.beginPath();
                    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
                    context.fill();
                    context.globalAlpha = 1;

                    if (watched.has(entry.norad)) {
                        context.strokeStyle = "#ffd166";
                        context.lineWidth = 1.2;
                        context.beginPath();
                        context.arc(point.x, point.y, radius + 3, 0, Math.PI * 2);
                        context.stroke();
                    }
                    if (entry.category === "station" && zoom >= 3 && !nearSelected(point.x, point.y)) {
                        context.fillStyle = "rgba(255, 209, 102, 0.85)";
                        context.font = "600 9px Inter, system-ui, sans-serif";
                        context.textAlign = "left";
                        context.textBaseline = "middle";
                        context.fillText(entry.name, point.x + 7, point.y);
                    }
                }
            }

            /* Ausgewaehlter Satellit zuletzt, damit er oben liegt. */
            if (selectedPoint) {
                const { x, y, entry } = selectedPoint;
                context.strokeStyle = SELECTED_COLOR;
                context.fillStyle = SELECTED_COLOR;
                context.shadowColor = SELECTED_COLOR;
                context.shadowBlur = 14;
                context.lineWidth = 2;
                context.beginPath();
                context.arc(x, y, 9, 0, Math.PI * 2);
                context.stroke();
                context.beginPath();
                context.arc(x, y, 3.5, 0, Math.PI * 2);
                context.fill();
                context.shadowBlur = 0;
                context.font = "700 10px Inter, system-ui, sans-serif";
                context.textAlign = "left";
                context.textBaseline = "middle";
                context.fillText(entry.name, x + 13, y);
            }
        };
        drawRef.current = draw;

        const nearest = (event: L.LeafletMouseEvent) => {
            let best: ScreenPoint | null = null;
            let bestDistance = HIT_RADIUS_PX;
            for (const point of pointsRef.current) {
                const distance = Math.hypot(point.x - event.containerPoint.x, point.y - event.containerPoint.y);
                if (distance < bestDistance) {
                    best = point;
                    bestDistance = distance;
                }
            }
            return best;
        };

        map.on("click", (event: L.LeafletMouseEvent) => {
            const hit = nearest(event);
            if (hit) propsRef.current.onSelect(hit.entry.norad);
        });

        let hoverFrame = 0;
        map.on("mousemove", (event: L.LeafletMouseEvent) => {
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(() => {
                const tooltip = tooltipRef.current;
                if (!tooltip) return;
                const hit = nearest(event);
                element.style.cursor = hit ? "pointer" : "";
                if (!hit) {
                    tooltip.hidden = true;
                    return;
                }
                tooltip.hidden = false;
                tooltip.style.transform = `translate(${hit.x}px, ${hit.y - 14}px)`;
                tooltip.replaceChildren();
                const name = document.createElement("strong");
                name.textContent = hit.entry.name;
                const meta = document.createElement("span");
                meta.textContent = `${hit.entry.groupLabel} · NORAD ${hit.entry.norad}`;
                tooltip.append(name, meta);
            });
        });
        map.on("mouseout", () => {
            if (tooltipRef.current) tooltipRef.current.hidden = true;
        });

        map.on("move", draw);
        map.on("zoomstart", () => {
            canvas.style.opacity = "0";
        });
        map.on("zoomend", () => {
            draw();
            canvas.style.opacity = "1";
        });

        const resize = new ResizeObserver(() => {
            map.invalidateSize();
            draw();
        });
        resize.observe(wrapper);

        return () => {
            cancelled = true;
            cancelAnimationFrame(hoverFrame);
            resize.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, []);

    /* Neu zeichnen, wenn sich Positionen oder Auswahl aendern. */
    useEffect(() => {
        drawRef.current();
        flyToPending();
    }, [props.entries, props.positions, props.selectedNorad, props.watched, props.showMarkers]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        trackLayer.current?.remove();
        trackLayer.current = null;
        if (!props.showOrbit || props.track.length === 0) return;
        const iss = props.selectedNorad === ISS_NORAD;
        trackLayer.current = L.polyline(props.track, {
            color: iss ? "#ffd166" : "#5be7e0",
            weight: iss ? 3 : 2,
            opacity: 0.72,
            dashArray: "8 8",
            interactive: false,
        }).addTo(map);
    }, [props.track, props.showOrbit, props.selectedNorad]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        observerLayer.current?.remove();
        observerLayer.current = null;
        if (!props.observer) return;
        observerLayer.current = L.marker([props.observer.latitude, props.observer.longitude], {
            icon: L.divIcon({ className: "sat-observer-wrapper", html: '<div class="sat-observer"><span></span><b>YOU</b></div>', iconSize: [50, 24], iconAnchor: [8, 12] }),
            zIndexOffset: 2000,
            interactive: false,
            keyboard: false,
        }).addTo(map);
    }, [props.observer]);

    useEffect(() => {
        pendingFocus.current = props.focus;
        flyToPending();
    }, [props.focus]);

    return (
        <div ref={wrapperRef} className="sat-map">
            <div ref={mapElement} className="sat-map-leaflet" />
            <canvas ref={canvasRef} className="sat-map-canvas" aria-hidden="true" />
            <div ref={tooltipRef} className="sat-map-tooltip" hidden />
        </div>
    );
}
