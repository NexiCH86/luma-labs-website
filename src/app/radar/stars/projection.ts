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
