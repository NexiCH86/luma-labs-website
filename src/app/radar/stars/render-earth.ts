import { type MoonInfo, type SkyFrame } from "./astro";
import { drawEarth, subpoint, type EarthMap, type EarthProjection } from "./earth-view";
import { constellationName, hoursLabel, objectName } from "./format";
import { drawMarkers, ECLIPTIC_POINTS, EQUATOR_POINTS, type SkyMarker } from "./render-sky";
import { type Observer, type SkyCatalog } from "./sky-catalog";
import { drawDso, drawMoon } from "./sky-draw";
import { type DeepSkyObject, type PlanetObject, type SkyObject, type StarObject } from "./stars-data";
import { DEEP_STAR_LIMIT, type Layers, type NameLanguage, type Point } from "./types";

/*
 * Erdansicht: Weltkarte bzw. Globus, darueber der ganze Himmel als
 * "Abbild" auf der Erde. Jedes Objekt steht ueber dem Ort, an dem es
 * gerade im Zenit steht (Bildpunkt). Sterne, Sternbilder, Deep-Sky,
 * Milchstrasse und Linien folgen denselben Ebenen-Schaltern wie am Himmel.
 */

export type EarthSceneParams = {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    projection: EarthProjection;
    frame: SkyFrame;
    map: EarthMap | null;
    catalog: SkyCatalog;
    layers: Layers;
    stars: StarObject[];
    planets: PlanetObject[];
    moon: MoonInfo;
    selected: SkyObject | null;
    selectedConstellationId: string | null;
    dsoVisible: (object: DeepSkyObject) => boolean;
    names: NameLanguage;
    observer: Observer;
    observerLabel: string;
    zoom: number;
    markers: SkyMarker[];
};

export function drawEarthScene(params: EarthSceneParams) {
    const { ctx, width, height, projection, frame, catalog, layers, planets, moon, selected, names, observer, observerLabel } = params;
    const inView = (p: Point | null, margin = 30): p is Point => !!p && p.x > -margin && p.x < width + margin && p.y > -margin && p.y < height + margin;

    // Bildpunkt eines J2000-Objekts; null = Rueckseite des Globus.
    const groundPoint = (ra: number, dec: number) => {
        const date = frame.toDate(ra, dec);
        return subpoint(date.ra, date.dec, frame.gast);
    };
    const project = (ra: number, dec: number): Point | null => {
        const ground = groundPoint(ra, dec);
        const point = projection.project(ground.lat, ground.lon);
        return point.visible ? { x: point.x, y: point.y } : null;
    };
    // Linie aus Himmelskoordinaten; auf der Karte nicht ueber die Datumsgrenze ziehen.
    const strokeSky = (points: ArrayLike<number> | [number, number][], stride = 2) => {
        const nested = Array.isArray(points) && Array.isArray(points[0]);
        const count = nested ? (points as [number, number][]).length : (points as ArrayLike<number>).length / stride;
        let previous: Point | null = null;
        let previousLon = 0;
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const ra = nested ? (points as [number, number][])[i][0] : (points as ArrayLike<number>)[i * stride];
            const dec = nested ? (points as [number, number][])[i][1] : (points as ArrayLike<number>)[i * stride + 1];
            const ground = groundPoint(ra, dec);
            const projected = projection.project(ground.lat, ground.lon);
            const point = projected.visible ? { x: projected.x, y: projected.y } : null;
            const jump = projection.kind === "map" && Math.abs(ground.lon - previousLon) > 180;
            if (point && previous && !jump) ctx.lineTo(point.x, point.y);
            else if (point) ctx.moveTo(point.x, point.y);
            previous = point;
            previousLon = ground.lon;
        }
        ctx.stroke();
    };

    const sun = planets.find((planet) => planet.id === "sun");
    drawEarth(ctx, projection, width, height, { map: params.map, sun: sun ? groundPoint(sun.ra, sun.dec) : null, nightShade: true });

    // Der Himmel liegt halbtransparent ueber der Karte, damit die Laender lesbar bleiben.
    ctx.save();
    if (projection.kind === "globe") {
        ctx.beginPath(); ctx.arc(projection.center.x, projection.center.y, projection.radius, 0, Math.PI * 2); ctx.clip();
    }

    if (layers.milkyWay && catalog.milkyWay.length > 0) {
        const points = catalog.milkyWay;
        const radius = Math.max(1.5, projection.pixelsPerDegree * 1.75);
        for (let i = 0; i < points.length; i += 3) {
            const p = project(points[i], points[i + 1]);
            if (!inView(p, radius)) continue;
            ctx.fillStyle = `rgba(190,205,255,${0.018 + points[i + 2] * 0.014})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
        }
    }

    ctx.lineWidth = 1;
    if (layers.equator) {
        ctx.strokeStyle = "rgba(120,220,255,.45)";
        ctx.setLineDash([2, 4]);
        strokeSky(EQUATOR_POINTS);
    }
    if (layers.ecliptic) {
        ctx.strokeStyle = "rgba(247,199,104,.55)";
        ctx.setLineDash([7, 5]);
        strokeSky(ECLIPTIC_POINTS);
    }
    if (layers.bounds) {
        ctx.strokeStyle = "rgba(170,190,240,.22)";
        ctx.setLineDash([3, 4]);
        for (const boundary of catalog.bounds) for (const ring of boundary.rings) strokeSky(ring);
    }
    ctx.setLineDash([]);

    if (layers.constellations || params.selectedConstellationId) {
        for (const constellation of catalog.constellations) {
            const highlighted = constellation.id === params.selectedConstellationId;
            if (!layers.constellations && !highlighted) continue;
            ctx.strokeStyle = highlighted ? "rgba(247,199,104,.9)" : "rgba(150,195,255,.42)";
            ctx.lineWidth = highlighted ? 1.8 : 1;
            for (const line of constellation.lines) strokeSky(line);
        }
        if (catalog.complete) {
            ctx.textAlign = "center";
            for (const constellation of catalog.constellations) {
                const highlighted = constellation.id === params.selectedConstellationId;
                if (!highlighted && !(layers.labels && layers.constellations)) continue;
                const p = project(constellation.ra, constellation.dec);
                if (!inView(p)) continue;
                ctx.fillStyle = highlighted ? "#ffe3a6" : "rgba(170,200,255,.6)";
                ctx.font = highlighted ? "600 12px ui-sans-serif, system-ui" : "9px ui-sans-serif, system-ui";
                ctx.fillText(constellationName(constellation, names).toUpperCase(), p.x, p.y);
            }
        }
    }

    if (layers.dso) {
        for (const object of catalog.dsos) {
            const selectedObject = object.id === selected?.id;
            if (!selectedObject && !params.dsoVisible(object)) continue;
            const p = project(object.ra, object.dec);
            if (!inView(p, 40)) continue;
            const [major, minor] = object.size ?? [0, 0];
            drawDso(ctx, p.x, p.y, ((major / 60) / 2) * projection.pixelsPerDegree, major > 0 ? minor / major : 1, object.typeCode, selectedObject);
            if (layers.labels && (selectedObject || /^M\d+$/.test(object.catalog) && params.zoom >= 1.5)) {
                ctx.fillStyle = "rgba(184,232,255,.75)";
                ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
                ctx.textAlign = "left";
                ctx.fillText(object.catalog, p.x + 6, p.y - 5);
            }
        }
    }

    if (layers.stars) {
        const labelLimit = params.zoom >= 2 ? 2.5 : 1.2;
        ctx.textAlign = "left";
        for (const star of params.stars) {
            const p = project(star.ra, star.dec);
            if (!inView(p)) continue;
            ctx.fillStyle = star.color ?? "#ffffff";
            if (star.magnitude > DEEP_STAR_LIMIT) {
                ctx.globalAlpha = 0.5;
                ctx.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
                ctx.globalAlpha = 1;
                continue;
            }
            const radius = Math.max(0.6, (6.4 - star.magnitude) * 0.45);
            ctx.globalAlpha = Math.max(0.45, Math.min(1, 1.1 - star.magnitude * 0.1));
            ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            if (layers.labels && star.magnitude <= labelLimit && !star.name.startsWith("HIP ")) {
                ctx.fillStyle = "rgba(238,244,255,.78)";
                ctx.font = "10px ui-sans-serif, system-ui";
                ctx.fillText(star.name, p.x + radius + 4, p.y - radius - 1);
            }
        }
    }
    ctx.restore();

    const label = (text: string, p: Point, offset: number, color: string, font = "600 11px ui-sans-serif, system-ui") => {
        if (!layers.labels) return;
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = "left";
        ctx.fillText(text, p.x + offset, p.y - offset);
    };

    if (layers.planets) {
        for (const planet of planets) {
            const p = project(planet.ra, planet.dec);
            if (!inView(p)) continue;
            if (planet.id === "moon" && sun) {
                const sunPoint = project(sun.ra, sun.dec);
                const angle = sunPoint ? Math.atan2(sunPoint.y - p.y, sunPoint.x - p.x) : moon.phaseAngle < 180 ? 0 : Math.PI;
                drawMoon(ctx, p.x, p.y, 7, moon.illumination, angle, planet.id === selected?.id);
            } else {
                const color = planet.id === "sun" ? "#ffd27a" : planet.id === "mars" ? "#ff9b6b" : "#f7e3a3";
                ctx.save();
                ctx.shadowBlur = planet.id === "sun" ? 22 : 10;
                ctx.shadowColor = color;
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(p.x, p.y, planet.id === "sun" ? 8 : 4.5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            label(objectName(planet, names), p, planet.id === "sun" || planet.id === "moon" ? 10 : 7, "rgba(255,236,190,.95)");
        }
    }

    drawMarkers(ctx, params.markers, params.zoom, (marker) => {
        if (marker.ra !== undefined && marker.dec !== undefined) return project(marker.ra, marker.dec);
        return null;
    }, null, inView, layers.labels);

    if (selected) {
        const p = project(selected.ra, selected.dec);
        if (inView(p)) {
            if (selected.kind !== "planet") {
                ctx.fillStyle = "#ffe3a6";
                ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
                label(selected.kind === "dso" ? selected.catalog : selected.name, p, 8, "#ffe3a6");
            }
            ctx.strokeStyle = "rgba(255,213,124,.9)";
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
        }
    }

    // Eigener Standort
    const home = projection.project(observer.lat, observer.lon);
    if (home.visible) {
        ctx.save();
        ctx.fillStyle = "#63ffe3";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#63ffe3";
        ctx.beginPath(); ctx.arc(home.x, home.y, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(99,255,227,.6)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(home.x, home.y, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#63ffe3";
        ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${names === "de" ? "DU" : "YOU"}${observerLabel ? " · " + observerLabel.toUpperCase() : ""}`, home.x + 13, home.y + 4);
        ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,.48)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${observerLabel ? observerLabel.toUpperCase() + " · " : ""}LAT ${observer.lat.toFixed(2)}° · LON ${observer.lon.toFixed(2)}° · GAST ${hoursLabel(frame.gast)}`, 14, height - 16);
}

/*
 * Bildschirmposition eines Objekts in der Erdansicht (fuer Klicks und Zentrieren).
 */
export function earthObjectPoint(projection: EarthProjection, frame: SkyFrame, ra: number, dec: number): Point | null {
    const date = frame.toDate(ra, dec);
    const ground = subpoint(date.ra, date.dec, frame.gast);
    const point = projection.project(ground.lat, ground.lon);
    return point.visible ? { x: point.x, y: point.y } : null;
}
