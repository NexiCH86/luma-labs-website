import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Kometen und grosse Kleinplaneten fuer den STARS-Modus (/radar/stars).
 *
 * Quellen:
 *   - Kometen: Bahnelemente des Minor Planet Center (CometEls.txt),
 *     https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt
 *   - Kleinplaneten: JPL Small-Body Database API (1 Ceres bis 10 Hygiea)
 *
 * Gespeichert werden nur Elemente; Position und Helligkeit rechnet der
 * Browser fuer den gewaehlten Zeitpunkt (kepler.ts). Kometen werden auf
 * die interessanten eingegrenzt: Perihel innerhalb von 18 Monaten,
 * Periheldistanz unter 4 AE und absolute Helligkeit unter 13.
 */
const COMETS_URL = "https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt";
const SBDB_URL = "https://ssd-api.jpl.nasa.gov/sbdb.api";
const ASTEROIDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const OUTPUT_FILE = path.join(process.cwd(), "public", "data", "sky", "small-bodies.json");
const FALLBACK_FILE = path.join(process.cwd(), "scripts", "data", "small-bodies.fallback.json");
const DAY_MS = 86_400_000;

async function keepExisting(error) {
    console.warn(`Small bodies download failed: ${error.message}`);
    try {
        await access(OUTPUT_FILE);
        console.warn("Keeping the existing public/data/sky/small-bodies.json.");
        return;
    } catch {
        // Noch keine Datei vorhanden, Fallback kopieren.
    }
    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await copyFile(FALLBACK_FILE, OUTPUT_FILE);
    console.warn("Using the bundled fallback (scripts/data).");
}

const julianDay = (ms) => ms / DAY_MS + 2440587.5;

/*
 * Ein-Zeilen-Format des MPC fuer Kometen (Spalten laut MPC-Dokumentation):
 * Perihelzeit, q, e, Argument des Perihels, Knoten, Neigung, H, G, Name.
 */
function parseComet(line) {
    const year = Number(line.slice(14, 18));
    const month = Number(line.slice(19, 21));
    const day = Number(line.slice(22, 29));
    const q = Number(line.slice(30, 39));
    const e = Number(line.slice(41, 49));
    const w = Number(line.slice(51, 59));
    const node = Number(line.slice(61, 69));
    const i = Number(line.slice(71, 79));
    const H = Number(line.slice(91, 95));
    const G = Number(line.slice(96, 100));
    const name = line.slice(102, 158).trim();
    if (![year, month, day, q, e, w, node, i].every(Number.isFinite) || !name) return null;
    const tp = julianDay(Date.UTC(year, month - 1, 1)) + day - 1;
    return { id: name.replace(/\s*\(.*$/, ""), name, q, e, w, node, i, tp: Math.round(tp * 1e4) / 1e4, H: Number.isFinite(H) ? H : 15, G: Number.isFinite(G) ? G : 4 };
}

async function loadComets() {
    const response = await fetch(COMETS_URL, { signal: AbortSignal.timeout(60_000), headers: { "User-Agent": "LuMa-RADAR/1.0 (+https://lumalabs.ch)" } });
    if (!response.ok) throw new Error(`MPC comets ${response.status}`);
    const now = julianDay(Date.now());
    const comets = (await response.text())
        .split(/\r?\n/)
        .map(parseComet)
        .filter((comet) => comet && Math.abs(comet.tp - now) < 548 && comet.q < 4 && comet.H < 13);
    if (comets.length === 0) throw new Error("MPC comets: nothing parsed");
    return comets;
}

/*
 * JPL liefert Elemente als Liste {name, value}; full-prec=1 fuer volle Genauigkeit.
 */
async function loadAsteroid(number) {
    // JPL drosselt parallele Anfragen (503): nacheinander, mit kurzer Pause und Wiederholung.
    let response;
    for (let attempt = 0; attempt < 4; attempt++) {
        response = await fetch(`${SBDB_URL}?sstr=${number}&phys-par=1&full-prec=1`, { signal: AbortSignal.timeout(30_000) });
        if (response.ok) break;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
    if (!response.ok) throw new Error(`JPL SBDB ${number}: ${response.status}`);
    const data = await response.json();
    const element = (name) => Number(data.orbit.elements.find((item) => item.name === name)?.value);
    const physical = (name) => Number(data.phys_par?.find((item) => item.name === name)?.value);
    const H = physical("H");
    const G = physical("G");
    return {
        id: `${number}`,
        name: data.object.fullname.replace(/^\s*\d+\s*/, "").replace(/\s*\(.*$/, ""),
        a: element("a"),
        e: element("e"),
        i: element("i"),
        node: element("om"),
        w: element("w"),
        M: element("ma"),
        epoch: Number(data.orbit.epoch),
        H: Number.isFinite(H) ? H : 7,
        G: Number.isFinite(G) ? G : 0.15,
    };
}

console.log("Downloading comet and asteroid elements (MPC, JPL)...");

let comets;
let asteroids = [];

try {
    comets = await loadComets();
} catch (error) {
    await keepExisting(error);
    process.exit(0);
}

try {
    for (const number of ASTEROIDS) asteroids.push(await loadAsteroid(number));
} catch (error) {
    // Die Bahnen der Kleinplaneten aendern sich kaum: vorhandene Daten weiterverwenden.
    console.warn(`JPL asteroids failed (${error.message}), reusing previous elements.`);
    for (const file of [OUTPUT_FILE, FALLBACK_FILE]) {
        try {
            asteroids = JSON.parse(await readFile(file, "utf8")).asteroids ?? [];
            if (asteroids.length) break;
        } catch {
            // naechste Quelle versuchen
        }
    }
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(
    OUTPUT_FILE,
    JSON.stringify({
        source: "Minor Planet Center (comets), JPL Small-Body Database (asteroids)",
        generatedAt: new Date().toISOString(),
        comets,
        asteroids,
    }),
    "utf8"
);

console.log(`Small bodies ready: ${comets.length} comets, ${asteroids.length} asteroids.`);
