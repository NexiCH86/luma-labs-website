import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Entfernung und Spektralklasse fuer die Sterne des STARS-Katalogs.
 *
 * Quelle: HYG-Datenbank v4.1 von David Nash (CC BY-SA 4.0),
 * https://github.com/astronexus/HYG-Database
 *
 * Die CSV ist 34 MB gross. Deshalb laeuft dieses Skript nicht im
 * Build, sondern von Hand; das Ergebnis liegt im Repo:
 *
 *   node scripts/build-star-details.mjs [pfad/zu/hygdata_v41.csv]
 *
 * Ohne Pfad wird die CSV heruntergeladen. Ausgabe:
 * scripts/data/star-details.json  { hip: [Entfernung (ly), Spektralklasse] }
 * fuer Sterne bis Helligkeit 6,5 (der Katalog reicht bis 6).
 */
const URL =
    "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv";
const OUTPUT_FILE = path.join(process.cwd(), "scripts", "data", "star-details.json");
const PARSEC_IN_LY = 3.26156;
const MAX_MAGNITUDE = 6.5;

const csv = process.argv[2]
    ? await readFile(process.argv[2], "utf8")
    : await (await fetch(URL, { signal: AbortSignal.timeout(180_000) })).text();

// Einfacher CSV-Parser: Felder koennen in Anfuehrungszeichen stehen, ohne Kommas darin.
const rows = csv.split(/\r?\n/).filter(Boolean).map((line) => line.split(",").map((field) => field.replace(/^"|"$/g, "")));
const header = rows.shift();
const column = (name) => header.indexOf(name);
const [HIP, DIST, MAG, SPECT] = ["hip", "dist", "mag", "spect"].map(column);

const details = {};

for (const row of rows) {
    const hip = row[HIP];
    const magnitude = Number(row[MAG]);
    if (!hip || !(magnitude <= MAX_MAGNITUDE)) {
        continue;
    }

    // HYG kennzeichnet unbekannte Entfernungen mit 100000 pc.
    const parsecs = Number(row[DIST]);
    const distanceLy = parsecs > 0 && parsecs < 100_000 ? Math.round(parsecs * PARSEC_IN_LY * 10) / 10 : 0;
    const spectral = row[SPECT] ?? "";

    if (distanceLy || spectral) {
        details[hip] = [distanceLy, spectral];
    }
}

await writeFile(OUTPUT_FILE, JSON.stringify(details), "utf8");
console.log(`Star details ready: ${Object.keys(details).length.toLocaleString("en-US")} stars.`);
