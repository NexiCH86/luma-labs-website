import { clamp } from "./astro";
import { MAX_ZOOM, MIN_ZOOM, type Point, type Size, type ViewState } from "./types";

/*
 * Bildschirm-Projektionen der Sternkarte. Alle Funktionen sind rein,
 * damit sie sich testen lassen.
 */

export function applyView(x: number, y: number, width: number, height: number, view: ViewState): Point {
    return {
        x: (x - width / 2) * view.zoom + width / 2 + view.offsetX,
        y: (y - height / 2) * view.zoom + height / 2 + view.offsetY,
    };
}

/*
 * Zoomen um einen Bildschirmpunkt (Mauszeiger, Mitte zwischen zwei
 * Fingern): der Punkt unter dem Zeiger bleibt an seinem Platz.
 */
export function zoomAround(view: ViewState, factor: number, screenX: number, screenY: number, size: Size): ViewState {
    const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = zoom / view.zoom;
    return {
        zoom,
        offsetX: screenX - size.width / 2 - (screenX - size.width / 2 - view.offsetX) * k,
        offsetY: screenY - size.height / 2 - (screenY - size.height / 2 - view.offsetY) * k,
    };
}

/*
 * Katalogansicht: Rektaszension waagrecht, Deklination senkrecht.
 */
export function projectCatalog(ra: number, dec: number, width: number, height: number, view: ViewState): Point {
    return applyView(((ra % 24) / 24) * width, ((90 - dec) / 180) * height, width, height, view);
}

export function domeRadius(width: number, height: number) {
    return (Math.min(width, height) / 2) * 0.92;
}

/*
 * Himmelsansicht: Blick nach oben, Zenit in der Mitte, Horizont als
 * Kreis, Norden oben und Osten links (wie auf drehbaren Sternkarten).
 */
export function projectSkyDome(altitude: number, azimuth: number, width: number, height: number, view: ViewState): Point {
    const r = ((90 - altitude) / 90) * domeRadius(width, height);
    const az = (azimuth * Math.PI) / 180;
    return applyView(width / 2 - r * Math.sin(az), height / 2 - r * Math.cos(az), width, height, view);
}

/*
 * Rundblick: Blick in eine Richtung (Azimut, Hoehe), stereografisch
 * projiziert wie bei Planetariums-Apps. fov = horizontaler Bildwinkel
 * in Grad, roll dreht das Bild (AR-Modus, Handy schraeg gehalten).
 * Lokales System: x = Ost, y = Nord, z = Oben.
 */
export type HorizonView = { azimuth: number; altitude: number; fov: number; roll: number };

export function horizonProjector(look: HorizonView, width: number, height: number) {
    const rad = Math.PI / 180;
    const a0 = look.altitude * rad;
    const z0 = look.azimuth * rad;
    const forward = [Math.cos(a0) * Math.sin(z0), Math.cos(a0) * Math.cos(z0), Math.sin(a0)];
    const right = [Math.cos(z0), -Math.sin(z0), 0];
    // up = right x forward
    const up = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
    ];
    const scale = width / 2 / (2 * Math.tan((look.fov * rad) / 4));
    const cosRoll = Math.cos(look.roll * rad);
    const sinRoll = Math.sin(look.roll * rad);
    const cx = width / 2;
    const cy = height / 2;

    return {
        pixelsPerDegree: (width / look.fov),
        project: (altitude: number, azimuth: number, allowBehind = false): Point | null => {
            const h = altitude * rad;
            const z = azimuth * rad;
            const v = [Math.cos(h) * Math.sin(z), Math.cos(h) * Math.cos(z), Math.sin(h)];
            const depth = v[0] * forward[0] + v[1] * forward[1] + v[2] * forward[2];
            if (depth < -0.2 && !allowBehind) return null;
            const k = 2 / (1 + Math.max(depth, -0.95));
            const x = (v[0] * right[0] + v[1] * right[1] + v[2] * right[2]) * k * scale;
            const y = (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]) * k * scale;
            return { x: cx + x * cosRoll - y * sinRoll, y: cy - (x * sinRoll + y * cosRoll) };
        },
    };
}
