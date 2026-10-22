import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Weltkarte fuer die Erdansicht im STARS-Modus (/radar/stars).
 *
 * Quelle: Natural Earth 1:110m (Public Domain),
 * https://github.com/nvkelso/natural-earth-vector
 *   - ne_110m_land.geojson                        Landflaechen
 *   - ne_110m_admin_0_boundary_lines_land.geojson Landesgrenzen
 *
 * Ausgabe /data/sky/earth.json, Koordinaten auf 0,1° gerundet und
 * flach gespeichert: je Ring bzw. Linie [lon, lat, lon, lat, ...]
 */
const BASE =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

const OUTPUT_FILE = path.join(process.cwd(), "public", "data", "sky", "earth.json");
const FALLBACK_FILE = path.join(process.cwd(), "scripts", "data", "earth-map.fallback.json");

async function download(name) {
    const response = await fetch(`${BASE}/${name}`, {
        signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
        throw new Error(`Earth map download failed ${response.status}: ${name}`);
    }

    return response.json();
}

/*
 * Wie beim Sternkatalog: ohne Download bleibt die vorhandene Datei,
 * sonst kommt die eingecheckte Kopie in scripts/data zum Einsatz.
 */
async function keepExistingMap(error) {
    console.warn(`Earth map download failed: ${error.message}`);

    try {
        await access(OUTPUT_FILE);
        console.warn("Keeping the existing public/data/sky/earth.json.");
        return;
    } catch {
        // Noch keine Karte vorhanden, Fallback kopieren.
    }

    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await copyFile(FALLBACK_FILE, OUTPUT_FILE);
    console.warn("Using the bundled fallback earth map (scripts/data).");
}

const round = (value) => Math.round(value * 10) / 10;

function flatten(coordinates) {
    const flat = [];
    let previous = "";

    for (const [lon, lat] of coordinates) {
        const point = `${round(lon)},${round(lat)}`;

        // Nach dem Runden doppelte Punkte weglassen.
        if (point === previous) {
            continue;
        }

        previous = point;
        flat.push(round(lon), round(lat));
    }

    return flat;
}

console.log("Downloading earth map (Natural Earth 110m)...");

let sources;

try {
    sources = await Promise.all([
        download("ne_110m_land.geojson"),
        download("ne_110m_admin_0_boundary_lines_land.geojson"),
    ]);
} catch (error) {
    await keepExistingMap(error);
    process.exit(0);
}

const [land, borders] = sources;

const landRings = land.features.flatMap((feature) => {
    const polygons = feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates : [feature.geometry.coordinates];
    return polygons.map((polygon) => flatten(polygon[0])).filter((ring) => ring.length >= 6);
});

const borderLines = borders.features.flatMap((feature) => {
    const lines = feature.geometry.type === "MultiLineString" ? feature.geometry.coordinates : [feature.geometry.coordinates];
    return lines.map(flatten).filter((line) => line.length >= 4);
});

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(
    OUTPUT_FILE,
    JSON.stringify({
        source: "Natural Earth 1:110m (public domain)",
        generatedAt: new Date().toISOString(),
        land: landRings,
        borders: borderLines,
    }),
    "utf8"
);

console.log(`Earth map ready: ${landRings.length} land polygons, ${borderLines.length} border lines.`);
