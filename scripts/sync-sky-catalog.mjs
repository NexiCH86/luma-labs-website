import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Sternkatalog fuer den STARS-Modus (/radar/stars).
 *
 * Quelle: d3-celestial von Olaf Frohn (BSD-3-Clause),
 * https://github.com/ofrohn/d3-celestial
 *   - stars.6.json              Sterne bis Helligkeit 6 (Hipparcos)
 *   - starnames.json            Eigennamen und Bayer-Bezeichnungen
 *   - constellations.json       88 Sternbilder mit Namen
 *   - constellations.lines.json Sternbild-Linien
 *   - messier.json / dsos.bright.json  Deep-Sky-Objekte
 *
 * Koordinaten: d3-celestial speichert die Rektaszension als
 * Laenge in Grad (-180..180); hier umgerechnet in Stunden (0..24).
 */
const BASE =
    "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data";

const OUTPUT_FILE = path.join(
    process.cwd(),
    "public",
    "data",
    "sky",
    "catalog.json"
);

async function download(name) {
    const response = await fetch(`${BASE}/${name}`, {
        signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
        throw new Error(`Sky catalog download failed ${response.status}: ${name}`);
    }

    return response.json();
}

const round = (value, digits) =>
    Math.round(value * 10 ** digits) / 10 ** digits;

const raHours = (lon) =>
    round((((lon % 360) + 360) % 360) / 15, 4);

/*
 * Ist d3-celestial nicht erreichbar, soll der Build trotzdem laufen:
 * Eine vorhandene catalog.json bleibt stehen, sonst kommt die
 * eingecheckte Kopie in scripts/data zum Einsatz.
 */
const FALLBACK_FILE = path.join(
    process.cwd(),
    "scripts",
    "data",
    "sky-catalog.fallback.json"
);

async function keepExistingCatalog(error) {
    console.warn(`Sky catalog download failed: ${error.message}`);

    try {
        await access(OUTPUT_FILE);
        console.warn("Keeping the existing public/data/sky/catalog.json.");
        return;
    } catch {
        // Noch kein Katalog vorhanden, Fallback kopieren.
    }

    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await copyFile(FALLBACK_FILE, OUTPUT_FILE);
    console.warn("Using the bundled fallback catalog (scripts/data).");
}

console.log("Downloading sky catalog (d3-celestial)...");

let sources;

try {
    sources = await Promise.all([
        download("stars.6.json"),
        download("starnames.json"),
        download("constellations.json"),
        download("constellations.lines.json"),
        download("messier.json"),
        download("dsos.bright.json"),
        download("mw.json"),
        download("constellations.bounds.json"),
    ]);
} catch (error) {
    await keepExistingCatalog(error);
    process.exit(0);
}

const [stars, starNames, constellations, lines, messier, brightDsos, milkyWay, bounds] = sources;

/*
 * [hip, ra (h), dec (deg), magnitude, B-V-Farbindex]
 */
const starRows = stars.features.map((feature) => [
    Number(feature.id),
    raHours(feature.geometry.coordinates[0]),
    round(feature.geometry.coordinates[1], 4),
    round(Number(feature.properties.mag), 2),
    round(Number(feature.properties.bv) || 0, 2),
]);

const starIds = new Set(starRows.map((row) => String(row[0])));

/*
 * hip -> [Eigenname, Bayer-Buchstabe, Flamsteed-Nr., Sternbild-Kuerzel]
 * nur fuer Sterne im Katalog, die einen Namen oder Bayer-Buchstaben haben
 */
const names = {};

for (const [hip, entry] of Object.entries(starNames)) {
    if (!starIds.has(hip) || (!entry.name && !entry.bayer)) {
        continue;
    }

    names[hip] = [
        entry.name || "",
        entry.bayer || "",
        entry.flam || "",
        entry.c || "",
    ];
}

const linesById = new Map(
    lines.features.map((feature) => [
        feature.id,
        feature.geometry.coordinates.map((line) =>
            line.map(([lon, lat]) => [raHours(lon), round(lat, 3)])
        ),
    ])
);

const constellationRows = constellations.features.map((feature) => ({
    id: feature.id,
    name: feature.properties.name,
    de: feature.properties.de || feature.properties.name,
    ra: raHours(feature.geometry.coordinates[0]),
    dec: round(feature.geometry.coordinates[1], 2),
    lines: linesById.get(feature.id) ?? [],
}));

const dsoRows = [];
const seenDso = new Set();

for (const feature of [...messier.features, ...brightDsos.features]) {
    const id = String(feature.id);

    if (seenDso.has(id)) {
        continue;
    }

    seenDso.add(id);

    const props = feature.properties;

    dsoRows.push({
        id,
        name: props.alt || props.name || id,
        desig: props.desig || "",
        type: props.type || "",
        mag: Number.isFinite(Number(props.mag)) ? Number(props.mag) : null,
        dim: props.dim || "",
        ra: raHours(feature.geometry.coordinates[0]),
        dec: round(feature.geometry.coordinates[1], 3),
    });
}

/*
 * Milchstrasse: d3-celestial liefert fuenf Helligkeitsstufen als
 * Polygone. Gerastert auf ein flaechentreues 1,5°-Raster, damit die
 * Karte sie in jeder Projektion als weiche Punkte zeichnen kann.
 * Flach gespeichert: [ra (h), dec, Stufe 1..5, ra, dec, Stufe, ...]
 */
const MILKY_WAY_STEP = 1.5;

function insideRing(x, y, ring) {
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
}

function insideMultiPolygon(x, y, geometry) {
    return geometry.coordinates.some((polygon) =>
        polygon.reduce((inside, ring) => (insideRing(x, y, ring) ? !inside : inside), false)
    );
}

const milkyWayPoints = [];

for (let lat = -90 + MILKY_WAY_STEP / 2; lat < 90; lat += MILKY_WAY_STEP) {
    const lonStep = MILKY_WAY_STEP / Math.max(0.25, Math.cos((lat * Math.PI) / 180));

    for (let lon = -180 + lonStep / 2; lon < 180; lon += lonStep) {
        const level = milkyWay.features.filter((feature) => insideMultiPolygon(lon, lat, feature.geometry)).length;

        if (level > 0) {
            milkyWayPoints.push(raHours(lon), round(lat, 2), level);
        }
    }
}

/*
 * Sternbildgrenzen: Kanten laufen entlang konstanter Rektaszension
 * oder Deklination. Lange Kanten werden unterteilt, damit sie in der
 * Himmelsansicht als Bogen erscheinen. Flach: [ra, dec, ra, dec, ...]
 */
const BOUNDARY_STEP = 1.5;

function densifyRing(ring) {
    const points = [];

    for (let i = 0; i < ring.length; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2Raw, lat2] = ring[(i + 1) % ring.length];
        let lon2 = lon2Raw;
        if (lon2 - lon1 > 180) lon2 -= 360;
        if (lon1 - lon2 > 180) lon2 += 360;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon2 - lon1), Math.abs(lat2 - lat1)) / BOUNDARY_STEP));

        for (let s = 0; s < steps; s++) {
            const t = s / steps;
            points.push(raHours(lon1 + (lon2 - lon1) * t), round(lat1 + (lat2 - lat1) * t, 2));
        }
    }

    points.push(points[0], points[1]);
    return points;
}

const boundaryRows = bounds.features.map((feature) => ({
    id: feature.id,
    rings: (feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates.flat() : feature.geometry.coordinates).map(densifyRing),
}));

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(
    OUTPUT_FILE,
    JSON.stringify({
        source: "d3-celestial by Olaf Frohn (BSD-3-Clause)",
        generatedAt: new Date().toISOString(),
        stars: starRows,
        names,
        constellations: constellationRows,
        dsos: dsoRows,
        milkyWay: milkyWayPoints,
        bounds: boundaryRows,
    }),
    "utf8"
);

console.log(
    `Sky catalog ready: ${starRows.length.toLocaleString("en-US")} stars, ` +
        `${Object.keys(names).length.toLocaleString("en-US")} named, ` +
        `${constellationRows.length} constellations, ${dsoRows.length} deep-sky objects, ` +
        `${milkyWayPoints.length / 3} Milky Way points, ${boundaryRows.length} boundaries.`
);
