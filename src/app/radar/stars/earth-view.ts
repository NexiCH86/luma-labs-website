import { clamp } from "./astro";

/*
 * Erdansicht im STARS-Modus: Weltkarte (plattkarte) oder drehbarer
 * Globus (orthografisch). Gezeigt wird, ueber welchem Ort der Erde
 * ein Himmelsobjekt gerade im Zenit steht (Bildpunkt), dazu Tag und Nacht.
 */

export type EarthMap = { land: number[][]; borders: number[][] };
export type EarthKind = "map" | "globe";
export type GeoPoint = { lat: number; lon: number };
export type EarthView = { zoom: number; offsetX: number; offsetY: number };
type ScreenPoint = { x: number; y: number; visible: boolean };

const RAD = Math.PI / 180;

let earthMapPromise: Promise<EarthMap> | null = null;

export function loadEarthMap(): Promise<EarthMap> {
    earthMapPromise ??= fetch("/data/sky/earth.json", { cache: "no-cache" }).then((response) => {
        if (!response.ok) throw new Error(`Earth map unavailable (${response.status})`);
        return response.json() as Promise<EarthMap>;
    });
    earthMapPromise.catch(() => { earthMapPromise = null; });
    return earthMapPromise;
}

export function normalizeLon(lon: number) {
    return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/*
 * Bildpunkt: geografische Breite = Deklination, Laenge = RA minus
 * Greenwich-Sternzeit (beides in Grad).
 */
export function subpoint(ra: number, dec: number, gmstHours: number): GeoPoint {
    return { lat: dec, lon: normalizeLon((ra - gmstHours) * 15) };
}

export type EarthProjection = {
    kind: EarthKind;
    radius: number;
    center: { x: number; y: number };
    project: (lat: number, lon: number) => ScreenPoint;
    invert: (x: number, y: number) => GeoPoint | null;
    pixelsPerDegree: number;
};

export function earthProjection(kind: EarthKind, width: number, height: number, view: EarthView, globeCenter: GeoPoint): EarthProjection {
    const center = { x: width / 2 + view.offsetX, y: height / 2 + view.offsetY };

    if (kind === "map") {
        const mapWidth = Math.min(width * 0.96, height * 1.9) * view.zoom;
        const mapHeight = mapWidth / 2;
        const left = center.x - mapWidth / 2;
        const top = center.y - mapHeight / 2;
        return {
            kind,
            radius: mapWidth / 2,
            center,
            pixelsPerDegree: mapWidth / 360,
            project: (lat, lon) => ({ x: left + ((lon + 180) / 360) * mapWidth, y: top + ((90 - lat) / 180) * mapHeight, visible: true }),
            invert: (x, y) => {
                const lon = ((x - left) / mapWidth) * 360 - 180;
                const lat = 90 - ((y - top) / mapHeight) * 180;
                if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
                return { lat, lon };
            },
        };
    }

    const radius = Math.min(width, height) * 0.44 * view.zoom;
    const phi0 = globeCenter.lat * RAD;
    const lambda0 = globeCenter.lon * RAD;
    const sinPhi0 = Math.sin(phi0);
    const cosPhi0 = Math.cos(phi0);

    return {
        kind,
        radius,
        center,
        pixelsPerDegree: (radius * Math.PI) / 180,
        project: (lat, lon) => {
            const phi = lat * RAD;
            const dl = lon * RAD - lambda0;
            const cosPhi = Math.cos(phi);
            const x = radius * cosPhi * Math.sin(dl);
            const y = radius * (cosPhi0 * Math.sin(phi) - sinPhi0 * cosPhi * Math.cos(dl));
            const visible = sinPhi0 * Math.sin(phi) + cosPhi0 * cosPhi * Math.cos(dl) >= 0;
            return { x: center.x + x, y: center.y - y, visible };
        },
        invert: (sx, sy) => {
            const x = sx - center.x;
            const y = center.y - sy;
            const rho = Math.hypot(x, y);
            if (rho > radius) return null;
            if (rho === 0) return { ...globeCenter };
            const c = Math.asin(clamp(rho / radius, -1, 1));
            const lat = Math.asin(Math.cos(c) * sinPhi0 + (y * Math.sin(c) * cosPhi0) / rho) / RAD;
            const lon = (lambda0 + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * cosPhi0 - y * Math.sin(c) * sinPhi0)) / RAD;
            return { lat, lon: normalizeLon(lon) };
        },
    };
}

/*
 * Linie bzw. Flaeche aus flachen [lon, lat]-Paaren. Auf dem Globus
 * werden verdeckte Punkte an den Rand geschoben; der Clip auf die
 * Erdscheibe schneidet den Rest ab.
 */
function tracePath(ctx: CanvasRenderingContext2D, projection: EarthProjection, flat: number[], closed: boolean) {
    let previousLon = flat[0];
    let started = false;

    for (let i = 0; i < flat.length; i += 2) {
        const lon = flat[i];
        const lat = flat[i + 1];
        let point = projection.project(lat, lon);

        if (projection.kind === "globe" && !point.visible) {
            const dx = point.x - projection.center.x;
            const dy = point.y - projection.center.y;
            const length = Math.hypot(dx, dy) || 1;
            point = { x: projection.center.x + (dx / length) * projection.radius, y: projection.center.y + (dy / length) * projection.radius, visible: false };
        }

        // Auf der Karte nicht quer ueber die Datumsgrenze zeichnen.
        const jump = projection.kind === "map" && Math.abs(lon - previousLon) > 180;
        if (!started || (jump && !closed)) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
        started = true;
        previousLon = lon;
    }

    if (closed) ctx.closePath();
}

/*
 * Kreis auf der Erdkugel: alle Punkte im Winkelabstand radius (Grad)
 * um center, flach [lon, lat, ...].
 */
function capRing(center: GeoPoint, radius: number) {
    const phi1 = center.lat * RAD;
    const lambda1 = center.lon * RAD;
    const delta = radius * RAD;
    const flat: number[] = [];
    for (let bearing = 0; bearing <= 360; bearing += 3) {
        const theta = bearing * RAD;
        const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
        const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
        flat.push(normalizeLon(lambda2 / RAD), phi2 / RAD);
    }
    return flat;
}

function strokeGeoLine(ctx: CanvasRenderingContext2D, projection: EarthProjection, points: GeoPoint[]) {
    let drawing = false;
    let previousLon = points[0]?.lon ?? 0;
    ctx.beginPath();
    for (const { lat, lon } of points) {
        const point = projection.project(lat, lon);
        const jump = projection.kind === "map" && Math.abs(lon - previousLon) > 180;
        if (!point.visible || jump) {
            drawing = false;
        }
        if (point.visible) {
            if (drawing) ctx.lineTo(point.x, point.y);
            else ctx.moveTo(point.x, point.y);
            drawing = true;
        }
        previousLon = lon;
    }
    ctx.stroke();
}

export type EarthDrawOptions = {
    map: EarthMap | null;
    sun: GeoPoint | null;
    nightShade: boolean;
    // Ersetzt die Landflaechen (z. B. Satellitenfoto); Grenzen bleiben darueber.
    underlay?: () => void;
};

/*
 * Ozean, Gitter, Land, Grenzen und Nachtseite. Marker zeichnet die
 * Komponente danach selbst ueber projection.project().
 */
export function drawEarth(ctx: CanvasRenderingContext2D, projection: EarthProjection, width: number, height: number, options: EarthDrawOptions) {
    ctx.fillStyle = "#01030b";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    if (projection.kind === "globe") {
        ctx.arc(projection.center.x, projection.center.y, projection.radius, 0, Math.PI * 2);
    } else {
        const topLeft = projection.project(90, -180);
        const bottomRight = projection.project(-90, 180);
        ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }
    const ocean = projection.kind === "globe"
        ? ctx.createRadialGradient(projection.center.x - projection.radius * 0.3, projection.center.y - projection.radius * 0.3, projection.radius * 0.1, projection.center.x, projection.center.y, projection.radius)
        : ctx.createLinearGradient(0, projection.center.y - projection.radius / 2, 0, projection.center.y + projection.radius / 2);
    ocean.addColorStop(0, "#0d2547");
    ocean.addColorStop(1, "#06132a");
    ctx.fillStyle = ocean;
    ctx.fill();
    ctx.clip();

    // Gitter alle 30°
    ctx.strokeStyle = "rgba(120,170,255,.13)";
    ctx.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) {
        strokeGeoLine(ctx, projection, Array.from({ length: 73 }, (_, i) => ({ lat, lon: -180 + i * 5 })));
    }
    for (let lon = -180; lon < 180; lon += 30) {
        strokeGeoLine(ctx, projection, Array.from({ length: 37 }, (_, i) => ({ lat: -90 + i * 5, lon })));
    }

    if (options.underlay) options.underlay();

    if (options.map) {
        ctx.fillStyle = "#28546a";
        ctx.strokeStyle = options.underlay ? "rgba(220,240,255,.35)" : "rgba(150,230,240,.55)";
        ctx.lineWidth = 0.8;
        for (const ring of options.map.land) {
            ctx.beginPath();
            tracePath(ctx, projection, ring, true);
            if (!options.underlay) ctx.fill();
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(140,220,230,.22)";
        ctx.lineWidth = 0.6;
        for (const line of options.map.borders) {
            ctx.beginPath();
            tracePath(ctx, projection, line, false);
            ctx.stroke();
        }
    }

    // Globus: Nachtseite als Kugelkappen um den Gegenpunkt der Sonne
    // (Horizont, buergerliche, nautische, astronomische Daemmerung).
    if (options.nightShade && options.sun && projection.kind === "globe") {
        const anti = { lat: -options.sun.lat, lon: normalizeLon(options.sun.lon + 180) };
        ctx.fillStyle = "rgba(0,3,14,.16)";
        const antiVisible = projection.project(anti.lat, anti.lon).visible;
        for (const radius of [90, 84, 78, 72]) {
            const ring = capRing(anti, radius);
            let anyVisible = false;
            for (let i = 0; i < ring.length && !anyVisible; i += 2) anyVisible = projection.project(ring[i + 1], ring[i]).visible;
            // Rand ganz auf der Rueckseite: Kappe deckt entweder die ganze Scheibe oder nichts.
            if (!anyVisible && !antiVisible) continue;
            ctx.beginPath();
            if (anyVisible) tracePath(ctx, projection, ring, true);
            else ctx.arc(projection.center.x, projection.center.y, projection.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Karte: Raster mit Sonnenhoehe je Zelle, Daemmerung weich auslaufend.
    if (options.nightShade && options.sun && projection.kind === "map") {
        const step = 3;
        const sunLat = options.sun.lat * RAD;
        const sunLon = options.sun.lon * RAD;
        const cell = Math.max(2, projection.pixelsPerDegree * step * 1.08);
        for (let lat = -90 + step / 2; lat < 90; lat += step) {
            const phi = lat * RAD;
            for (let lon = -180 + step / 2; lon < 180; lon += step) {
                const sinAlt = Math.sin(phi) * Math.sin(sunLat) + Math.cos(phi) * Math.cos(sunLat) * Math.cos(lon * RAD - sunLon);
                const altitude = Math.asin(sinAlt) / RAD;
                if (altitude > 0) continue;
                const point = projection.project(lat, lon);
                ctx.fillStyle = `rgba(0,3,14,${0.18 + 0.42 * clamp(-altitude / 18, 0, 1)})`;
                ctx.fillRect(point.x - cell / 2, point.y - cell / 2, cell, cell);
            }
        }
    }
    ctx.restore();

    if (projection.kind === "globe") {
        ctx.strokeStyle = "rgba(99,255,227,.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(projection.center.x, projection.center.y, projection.radius, 0, Math.PI * 2); ctx.stroke();
    }
}
