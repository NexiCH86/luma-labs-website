/*
 * CARTO-Basemaps brauchen seit September 2026 einen API-Schluessel
 * (gratis bis 5 Mio. Kacheln/Monat, carto.com/basemaps/apikey). Ohne
 * Schluessel liefert CARTO Kacheln mit "API KEY REQUIRED"-Wasserzeichen.
 *
 * Der Schluessel kommt aus der Vercel-Umgebungsvariable
 * NEXT_PUBLIC_CARTO_API_KEY und wird beim Build eingesetzt.
 */
const CARTO_API_KEY =
    process.env.NEXT_PUBLIC_CARTO_API_KEY;

export const CARTO_DARK_TILES =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" +
    (CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : "");

/*
 * Von CARTO vorgeschrieben, muss sichtbar bleiben.
 */
export const CARTO_ATTRIBUTION =
    "© OpenStreetMap contributors, © CARTO";

/*
 * Ländergrenzen (/api/radar/airspace?layer=borders) über der dunklen
 * Karte, deren eigene Grenzen kaum sichtbar sind.
 */
export const COUNTRY_BORDERS_URL =
    "/api/radar/airspace?layer=borders";

export const COUNTRY_BORDER_STYLE = {
    color: "#63ffe3",
    weight: 1.2,
    opacity: 0.6,
};

/*
 * Die 1:10-Mio.-Linien weichen ab Zoom 12 sichtbar (einige 100 m) von
 * der Karte ab. Dort zeigt die Karte die Grenzen selbst, also ausblenden.
 */
export function countryBorderStyleForZoom(zoom: number) {
    const opacity =
        zoom >= 12 ? 0 : zoom >= 11 ? 0.3 : COUNTRY_BORDER_STYLE.opacity;

    return { ...COUNTRY_BORDER_STYLE, opacity };
}
