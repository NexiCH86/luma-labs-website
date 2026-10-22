import { clamp, eclipticToEquatorial, type MoonInfo, type SkyFrame } from "./astro";
import { constellationName, hoursLabel, objectName } from "./format";
import { applyView, domeRadius, projectCatalog, projectSkyDome } from "./projection";
import { type SkyCatalog, type Observer } from "./sky-catalog";
import { drawDso, drawMoon, skyBrightness, skyColors } from "./sky-draw";
import { type DeepSkyObject, type PlanetObject, type StarObject } from "./stars-data";
import { DEEP_STAR_LIMIT, type Layers, type NameLanguage, type Point, type ViewState } from "./types";

/*
 * Zeichnet die Himmelsansicht (Kuppel ueber dem Standort) und die
 * Katalogansicht (RA/Dec). Die Komponente liefert alle Daten und die
 * Projektion; hier wird nur gemalt.
 */

const CARDINALS: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];

export const ECLIPTIC_POINTS: [number, number][] = Array.from({ length: 181 }, (_, i) => {
    const { ra, dec } = eclipticToEquatorial(i * 2);
    return [ra, dec];
});
export const EQUATOR_POINTS: [number, number][] = Array.from({ length: 241 }, (_, i) => [i * 0.1, 0]);

/*
 * Zusaetzliche Marker (Kometen, Satelliten, Flugzeuge, Jupitermonde):
 * entweder in Himmelskoordinaten (ra/dec, J2000) oder direkt als
 * Hoehe/Azimut am Standort.
 */
export type SkyMarker = {
    id: string;
    label: string;
    color: string;
    shape: "dot" | "diamond" | "plane" | "comet" | "ring";
    size: number;
    ra?: number;
    dec?: number;
    altitude?: number;
    azimuth?: number;
    // Richtung in Grad (Flugzeuge, Kometenschweif), 0 = Bildschirm oben
    heading?: number;
    highlighted?: boolean;
    // Spur als Hoehe/Azimut-Punkte (Satelliten)
    track?: { altitude: number; azimuth: number }[];
    // nur ab diesem Zoom zeigen (Jupitermonde)
    minZoom?: number;
};

export type SkySceneParams = {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    mode: "sky" | "catalog";
    view: ViewState;
    frame: SkyFrame;
    project: (ra: number, dec: number) => Point | null;
    catalog: SkyCatalog;
    layers: Layers;
    stars: StarObject[];
    planets: PlanetObject[];
    moon: MoonInfo;
    sunAltitude: number;
    selectedId: string | null;
    selectedConstellationId: string | null;
    dsoVisible: (object: DeepSkyObject) => boolean;
    names: NameLanguage;
    observer: Observer;
    observerLabel: string;
    markers: SkyMarker[];
};

export function drawSkyScene(params: SkySceneParams) {
    const { ctx, width, height, mode, view, frame, project, catalog, layers, planets, moon, sunAltitude, selectedId, selectedConstellationId, names } = params;
    const inView = (p: Point | null, margin = 30): p is Point => !!p && p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;
    const skyMode = mode === "sky";
    const domeCenter = applyView(width / 2, height / 2, width, height, view);
    const horizonRadius = domeRadius(width, height) * view.zoom;
    // Aufgehellter Himmel daempft Sterne und Milchstrasse (nur in der Himmelsansicht).
    const brightness = skyMode ? skyBrightness(sunAltitude) : 0;
    const pixelsPerDegree = skyMode ? horizonRadius / 90 : ((width / 360 + height / 180) / 2) * view.zoom;
    const projectHorizontal = (altitude: number, azimuth: number): Point | null => {
        if (skyMode) return altitude < -1 ? null : projectSkyDome(altitude, azimuth, width, height, view);
        const { ra, dec } = frame.fromHorizontal(altitude, azimuth);
        return projectCatalog(ra, dec, width, height, view);
    };

    // Linie durch Himmelskoordinaten, unterbrochen unter dem Horizont und am RA-Rand.
    const strokeSky = (points: ArrayLike<number> | [number, number][], stride = 2) => {
        const flat = Array.isArray(points) && Array.isArray(points[0]);
        const count = flat ? (points as [number, number][]).length : (points as ArrayLike<number>).length / stride;
        let previous: Point | null = null;
        let previousRa = 0;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const ra = flat ? (points as [number, number][])[i][0] : (points as ArrayLike<number>)[i * stride];
            const dec = flat ? (points as [number, number][])[i][1] : (points as ArrayLike<number>)[i * stride + 1];
            const point = project(ra, dec);
            const wraps = !skyMode && Math.abs(ra - previousRa) > 12;
            if (point && previous && !wraps) ctx.lineTo(point.x, point.y);
            else if (point) ctx.moveTo(point.x, point.y);
            previous = point;
            previousRa = ra;
        }
        ctx.stroke();
    };

    // Hintergrund: in der Himmelsansicht Farbe nach Sonnenstand, ausserhalb des Horizonts dunkel.
    if (skyMode) {
        ctx.fillStyle = "#01030b";
        ctx.fillRect(0, 0, width, height);
        const [zenith, middle, horizon] = skyColors(sunAltitude);
        const bg = ctx.createRadialGradient(domeCenter.x, domeCenter.y, 0, domeCenter.x, domeCenter.y, horizonRadius);
        bg.addColorStop(0, zenith);
        bg.addColorStop(0.6, middle);
        bg.addColorStop(1, horizon);
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius, 0, Math.PI * 2); ctx.fill();
    } else {
        const bg = ctx.createRadialGradient(width * 0.46, height * 0.48, 0, width * 0.46, height * 0.48, Math.max(width, height) * 0.8);
        bg.addColorStop(0, "#08142c");
        bg.addColorStop(0.48, "#030b1b");
        bg.addColorStop(1, "#01030b");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
    }

    if (layers.milkyWay && catalog.milkyWay.length > 0 && brightness < 1) {
        ctx.save();
        if (skyMode) {
            // Nicht ueber den Horizontkreis hinaus zeichnen.
            ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius, 0, Math.PI * 2); ctx.clip();
        }
        const points = catalog.milkyWay;
        // Grosse, blasse Punkte ueberlappen stark und ergeben ein weiches Band ohne Raster.
        const radius = Math.max(1.5, pixelsPerDegree * 1.75);
        const fade = 1 - brightness;
        for (let i = 0; i < points.length; i += 3) {
            const p = project(points[i], points[i + 1]);
            if (!inView(p, radius)) continue;
            ctx.fillStyle = `rgba(176,196,255,${(0.025 + points[i + 2] * 0.02) * fade})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = "rgba(110,160,255,.18)";
    ctx.lineWidth = 1;
    if (!skyMode) {
        if (layers.grid) {
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
        }
    } else {
        if (layers.grid) {
            ctx.strokeStyle = "rgba(110,160,255,.14)";
            for (let altitude = 15; altitude < 90; altitude += 15) {
                ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius * ((90 - altitude) / 90), 0, Math.PI * 2); ctx.stroke();
            }
            for (let azimuth = 0; azimuth < 360; azimuth += 30) {
                const a = projectSkyDome(0, azimuth, width, height, view);
                const b = projectSkyDome(75, azimuth, width, height, view);
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
        }
        if (layers.meridian) {
            const north = projectSkyDome(0, 0, width, height, view);
            const south = projectSkyDome(0, 180, width, height, view);
            ctx.strokeStyle = "rgba(255,140,160,.45)";
            ctx.setLineDash([6, 5]);
            ctx.beginPath(); ctx.moveTo(north.x, north.y); ctx.lineTo(south.x, south.y); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.strokeStyle = "rgba(99,255,227,.55)";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(domeCenter.x, domeCenter.y, horizonRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(99,255,227,.85)";
        ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const [label, azimuth] of CARDINALS) {
            const p = projectSkyDome(-6, azimuth, width, height, view);
            ctx.fillText(names === "de" ? { N: "N", E: "O", S: "S", W: "W" }[label] ?? label : label, p.x, p.y);
        }
    }
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 1;
    if (layers.equator) {
        ctx.strokeStyle = "rgba(120,220,255,.4)";
        ctx.setLineDash([2, 4]);
        strokeSky(EQUATOR_POINTS);
    }
    if (layers.ecliptic) {
        ctx.strokeStyle = "rgba(247,199,104,.45)";
        ctx.setLineDash([7, 5]);
        strokeSky(ECLIPTIC_POINTS);
    }
    if (layers.bounds) {
        ctx.strokeStyle = "rgba(150,170,230,.2)";
        ctx.setLineDash([3, 4]);
        for (const boundary of catalog.bounds) {
            for (const ring of boundary.rings) strokeSky(ring);
        }
    }
    ctx.restore();

    if (layers.constellations || selectedConstellationId) {
        ctx.save();
        ctx.lineWidth = 1;
        for (const constellation of catalog.constellations) {
            const highlighted = constellation.id === selectedConstellationId;
            if (!layers.constellations && !highlighted) continue;
            ctx.strokeStyle = highlighted ? "rgba(247,199,104,.85)" : `rgba(112,169,255,${0.32 * (1 - brightness * 0.6)})`;
            ctx.lineWidth = highlighted ? 1.8 : 1;
            for (const line of constellation.lines) strokeSky(line);
        }
        if (catalog.complete) {
            ctx.textAlign = "center";
            for (const constellation of catalog.constellations) {
                const highlighted = constellation.id === selectedConstellationId;
                if (!highlighted && !(layers.labels && layers.constellations)) continue;
                const p = project(constellation.ra, constellation.dec);
                if (!inView(p)) continue;
                ctx.fillStyle = highlighted ? "#ffe3a6" : "rgba(140,180,255,.42)";
                ctx.font = highlighted ? "600 12px ui-sans-serif, system-ui" : "10px ui-sans-serif, system-ui";
                ctx.fillText(constellationName(constellation, names).toUpperCase(), p.x, p.y);
            }
        }
        ctx.restore();
    }

    if (layers.dso) {
        for (const object of catalog.dsos) {
            const selectedObject = object.id === selectedId;
            if (!selectedObject && !params.dsoVisible(object)) continue;
            const p = project(object.ra, object.dec);
            if (!inView(p, 60)) continue;
            const [major, minor] = object.size ?? [0, 0];
            const radius = ((major / 60) / 2) * pixelsPerDegree;
            // Lage der grossen Achse: Positionswinkel von Nord ueber Ost, auf dem Bildschirm
            // aus den Richtungen nach Norden und Osten am Objekt bestimmt.
            let rotation: number | undefined;
            if (object.positionAngle !== undefined && radius > 3) {
                const north = project(object.ra, Math.min(89.9, object.dec + 0.2));
                const east = project(object.ra + 0.2 / 15 / Math.max(0.05, Math.cos((object.dec * Math.PI) / 180)), object.dec);
                if (north && east) {
                    const n = { x: north.x - p.x, y: north.y - p.y };
                    const e = { x: east.x - p.x, y: east.y - p.y };
                    const nl = Math.hypot(n.x, n.y) || 1;
                    const el = Math.hypot(e.x, e.y) || 1;
                    const pa = (object.positionAngle * Math.PI) / 180;
                    rotation = Math.atan2(Math.cos(pa) * n.y / nl + Math.sin(pa) * e.y / el, Math.cos(pa) * n.x / nl + Math.sin(pa) * e.x / el);
                }
            }
            ctx.save();
            ctx.globalAlpha = selectedObject ? 1 : 1 - brightness * 0.7;
            drawDso(ctx, p.x, p.y, radius, major > 0 ? minor / major : 1, object.typeCode, selectedObject, rotation);
            const messier = /^M\d+$/.test(object.catalog);
            if (layers.labels && (selectedObject || (messier && view.zoom >= 1.3) || object.magnitude <= 5 || view.zoom >= 2.5)) {
                ctx.fillStyle = selectedObject ? "#ffe3a6" : "rgba(184,232,255,.7)";
                ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
                ctx.fillText(object.catalog, p.x + Math.max(radius, 4) + 4, p.y - 6);
            }
            ctx.restore();
        }
    }

    if (layers.stars) {
        const labelLimit = view.zoom >= 2.5 ? 3 : 1.8;
        for (const star of params.stars) {
            const p = project(star.ra, star.dec);
            if (!inView(p)) continue;
            const selectedStar = star.id === selectedId;
            if (star.magnitude > DEEP_STAR_LIMIT && !selectedStar) {
                // Schneller Weg fuer die vielen lichtschwachen Sterne: ohne Glow und Beschriftung.
                ctx.globalAlpha = 0.45 * (1 - brightness * 0.75);
                ctx.fillStyle = star.color ?? "#ffffff";
                ctx.fillRect(p.x - 0.6, p.y - 0.6, 1.2 * Math.sqrt(view.zoom), 1.2 * Math.sqrt(view.zoom));
                ctx.globalAlpha = 1;
                continue;
            }
            const radius = clamp((6.2 - star.magnitude) * 0.55, 0.55, 5.3) * Math.sqrt(view.zoom);
            ctx.save();
            // Glow nur fuer helle Sterne, sonst wird das Zeichnen von 5000 Sternen traege.
            ctx.shadowBlur = selectedStar ? 22 : star.magnitude < 2 ? radius * 3 : 0;
            ctx.shadowColor = star.color ?? "#ffffff";
            ctx.fillStyle = star.color ?? "#ffffff";
            ctx.globalAlpha = selectedStar ? 1 : clamp(1.1 - star.magnitude * 0.11, 0.4, 1) * (1 - brightness * 0.75);
            ctx.beginPath(); ctx.arc(p.x, p.y, selectedStar ? radius + 2.4 : radius, 0, Math.PI * 2); ctx.fill();
            if (selectedStar) {
                ctx.shadowBlur = 0;
                ctx.strokeStyle = "rgba(255,213,124,.9)";
                ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.arc(p.x, p.y, radius + 8, 0, Math.PI * 2); ctx.stroke();
            }
            if (layers.labels && (selectedStar || (star.magnitude <= labelLimit && !star.name.startsWith("HIP ")))) {
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                ctx.fillStyle = selectedStar ? "#ffe3a6" : "rgba(238,244,255,.8)";
                ctx.font = selectedStar ? "600 12px ui-sans-serif, system-ui" : "11px ui-sans-serif, system-ui";
                ctx.fillText(star.name, p.x + radius + 6, p.y - radius - 2);
            }
            ctx.restore();
        }
    }

    if (layers.planets) {
        const sun = planets.find((planet) => planet.id === "sun");
        for (const planet of planets) {
            const p = project(planet.ra, planet.dec);
            if (!inView(p)) continue;
            const selectedPlanet = planet.id === selectedId;
            const radius = planet.id === "sun" || planet.id === "moon" ? 9 : 5;
            if (planet.id === "moon" && sun) {
                // Helle Seite zur Sonne; deren Bildschirmposition auch unter dem Horizont.
                const sunPoint = skyMode
                    ? (() => { const h = frame.toHorizontal(sun.ra, sun.dec); return projectSkyDome(h.altitude, h.azimuth, width, height, view); })()
                    : projectCatalog(sun.ra, sun.dec, width, height, view);
                drawMoon(ctx, p.x, p.y, radius, moon.illumination, Math.atan2(sunPoint.y - p.y, sunPoint.x - p.x), selectedPlanet);
            } else {
                const color = planet.id === "sun" ? "#ffd27a" : planet.id === "mars" ? "#ff9b6b" : "#f7e3a3";
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
                ctx.restore();
            }
            if (layers.labels) {
                ctx.save();
                ctx.fillStyle = selectedPlanet ? "#ffe3a6" : "rgba(255,236,190,.92)";
                ctx.font = "600 11px ui-sans-serif, system-ui";
                ctx.fillText(objectName(planet, names), p.x + radius + 6, p.y - radius);
                ctx.restore();
            }
        }
    }

    drawMarkers(ctx, params.markers, view.zoom, (marker) => {
        if (marker.altitude !== undefined && marker.azimuth !== undefined) return projectHorizontal(marker.altitude, marker.azimuth);
        if (marker.ra !== undefined && marker.dec !== undefined) return project(marker.ra, marker.dec);
        return null;
    }, projectHorizontal, inView, layers.labels);

    ctx.fillStyle = "rgba(255,255,255,.48)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    if (!skyMode) {
        // RA-Beschriftung an den Gitterlinien, wandert beim Verschieben und Zoomen mit.
        ctx.textAlign = "center";
        for (let ra = 0; ra <= 24; ra += 6) {
            const p = projectCatalog(ra, 0, width, height, view);
            if (p.x < 24 || p.x > width - 24) continue;
            ctx.fillText(`RA ${String(ra).padStart(2, "0")}h`, p.x, height - 16);
        }
    } else {
        ctx.textAlign = "left";
        const { observer, observerLabel } = params;
        ctx.fillText(`${observerLabel ? observerLabel.toUpperCase() + " · " : ""}LAT ${observer.lat.toFixed(2)}° · LON ${observer.lon.toFixed(2)}° · LST ${hoursLabel(frame.lst)}`, 14, height - 16);
    }
}

/*
 * Marker zeichnen: Punkt, Raute (Kleinplaneten), Flugzeug-Pfeil,
 * Komet mit Schweif, Ring. Satelliten bekommen ihre Spur.
 */
export function drawMarkers(
    ctx: CanvasRenderingContext2D,
    markers: SkyMarker[],
    zoom: number,
    position: (marker: SkyMarker) => Point | null,
    projectHorizontal: ((altitude: number, azimuth: number) => Point | null) | null,
    inView: (p: Point | null, margin?: number) => p is Point,
    labels: boolean
) {
    for (const marker of markers) {
        if (marker.minZoom && zoom < marker.minZoom) continue;

        if (marker.track && projectHorizontal) {
            ctx.save();
            ctx.strokeStyle = marker.color;
            ctx.globalAlpha = 0.45;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            let drawing = false;
            for (const point of marker.track) {
                const p = projectHorizontal(point.altitude, point.azimuth);
                if (!p) { drawing = false; continue; }
                if (drawing) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
                drawing = true;
            }
            ctx.stroke();
            ctx.restore();
        }

        const p = position(marker);
        if (!inView(p)) continue;
        const size = marker.size;
        ctx.save();
        ctx.fillStyle = marker.color;
        ctx.strokeStyle = marker.color;
        ctx.lineWidth = 1.3;
        ctx.translate(p.x, p.y);
        if (marker.shape === "diamond") {
            ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size, 0); ctx.lineTo(0, size); ctx.lineTo(-size, 0); ctx.closePath(); ctx.fill();
        } else if (marker.shape === "plane") {
            ctx.rotate(((marker.heading ?? 0) * Math.PI) / 180);
            ctx.beginPath(); ctx.moveTo(0, -size * 1.4); ctx.lineTo(size, size); ctx.lineTo(0, size * 0.4); ctx.lineTo(-size, size); ctx.closePath(); ctx.fill();
        } else if (marker.shape === "comet") {
            ctx.rotate(((marker.heading ?? 0) * Math.PI) / 180);
            const tail = ctx.createLinearGradient(0, 0, 0, size * 7);
            tail.addColorStop(0, marker.color);
            tail.addColorStop(1, "rgba(150,230,255,0)");
            ctx.fillStyle = tail;
            ctx.beginPath(); ctx.moveTo(-size * 0.8, 0); ctx.lineTo(size * 0.8, 0); ctx.lineTo(0, size * 7); ctx.closePath(); ctx.fill();
            ctx.fillStyle = marker.color;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
        } else if (marker.shape === "ring") {
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.shadowBlur = 8;
            ctx.shadowColor = marker.color;
            ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        if (marker.highlighted) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,213,124,.9)";
            ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(p.x, p.y, size + 7, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }
        if (labels || marker.highlighted) {
            ctx.save();
            ctx.fillStyle = marker.highlighted ? "#ffe3a6" : marker.color;
            ctx.font = "600 10px ui-sans-serif, system-ui";
            ctx.textAlign = "left";
            ctx.fillText(marker.label, p.x + size + 5, p.y - size - 1);
            ctx.restore();
        }
    }
}
