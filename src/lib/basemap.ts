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
