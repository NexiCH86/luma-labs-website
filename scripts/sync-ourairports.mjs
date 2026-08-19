import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRIES_URL = "https://davidmegginson.github.io/ourairports-data/countries.csv";
const RUNWAYS_URL = "https://davidmegginson.github.io/ourairports-data/runways.csv";
const FREQUENCIES_URL = "https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv";

const outputRoot = path.join(process.cwd(), "public", "data", "ourairports");

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
            } else field += char;
            continue;
        }
        if (char === '"') quoted = true;
        else if (char === ",") { row.push(field); field = ""; }
        else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
        else field += char;
    }

    if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    const [header, ...data] = rows;
    return data.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

async function downloadCsv(url) {
    const response = await fetch(url, { headers: { Accept: "text/csv", "User-Agent": "LuMa-Radar/1.0" } });
    if (!response.ok) throw new Error(`Download failed ${response.status}: ${url}`);
    return parseCsv(await response.text());
}

function clean(value) { const text = String(value ?? "").trim(); return text || null; }
function numberOrNull(value) { const n = Number(value); return String(value ?? "").trim() && Number.isFinite(n) ? n : null; }
function shardKey(code) { const first = code[0]?.toUpperCase(); return /^[A-Z0-9]$/.test(first ?? "") ? first : "_"; }
function tileKey(latitude, longitude, size) {
    const lat = Math.max(-90, Math.min(89.999999, latitude));
    const lon = Math.max(-180, Math.min(179.999999, longitude));
    return `${Math.floor((lat + 90) / size)}_${Math.floor((lon + 180) / size)}`;
}
function pushTile(store, key, record) { store[key] ??= []; store[key].push(record); }
async function writeTiles(directory, tiles) {
    await mkdir(directory, { recursive: true });
    for (const [tile, records] of Object.entries(tiles)) await writeFile(path.join(directory, `${tile}.json`), JSON.stringify(records), "utf8");
}

console.log("Downloading OurAirports metadata...");
const [airports, countries, runways, frequencies] = await Promise.all([
    downloadCsv(AIRPORTS_URL), downloadCsv(COUNTRIES_URL), downloadCsv(RUNWAYS_URL), downloadCsv(FREQUENCIES_URL),
]);

const countryNames = new Map(countries.map((country) => [String(country.code ?? "").toUpperCase(), clean(country.name)]));
const runwaysByAirport = new Map();
const frequenciesByAirport = new Map();

for (const runway of runways) {
    const ident = clean(runway.airport_ident)?.toUpperCase();
    if (!ident || String(runway.closed ?? "0") === "1") continue;
    const record = {
        id: clean(runway.id),
        lengthFt: numberOrNull(runway.length_ft),
        widthFt: numberOrNull(runway.width_ft),
        surface: clean(runway.surface),
        lighted: String(runway.lighted ?? "0") === "1",
        leIdent: clean(runway.le_ident),
        leHeading: numberOrNull(runway.le_heading_degT),
        leElevationFt: numberOrNull(runway.le_elevation_ft),
        leDisplacedThresholdFt: numberOrNull(runway.le_displaced_threshold_ft),
        leLatitude: numberOrNull(runway.le_latitude_deg),
        leLongitude: numberOrNull(runway.le_longitude_deg),
        heIdent: clean(runway.he_ident),
        heHeading: numberOrNull(runway.he_heading_degT),
        heElevationFt: numberOrNull(runway.he_elevation_ft),
        heDisplacedThresholdFt: numberOrNull(runway.he_displaced_threshold_ft),
        heLatitude: numberOrNull(runway.he_latitude_deg),
        heLongitude: numberOrNull(runway.he_longitude_deg),
    };
    if (!runwaysByAirport.has(ident)) runwaysByAirport.set(ident, []);
    runwaysByAirport.get(ident).push(record);
}

for (const frequency of frequencies) {
    const ident = clean(frequency.airport_ident)?.toUpperCase();
    const mhz = numberOrNull(frequency.frequency_mhz);
    if (!ident || mhz == null) continue;
    const record = { type: clean(frequency.type), description: clean(frequency.description), frequencyMhz: mhz };
    if (!frequenciesByAirport.has(ident)) frequenciesByAirport.set(ident, []);
    frequenciesByAirport.get(ident).push(record);
}

const iataShards = {}; const icaoShards = {}; const majorAirports = []; const regionalTiles = {}; const localTiles = {};
let indexed = 0, iataCount = 0, icaoCount = 0, mapCount = 0, runwayAirportCount = 0, frequencyAirportCount = 0;

for (const airport of airports) {
    if (airport.type === "closed_airport") continue;
    const latitude = Number(airport.latitude_deg); const longitude = Number(airport.longitude_deg);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const iata = clean(airport.iata_code)?.toUpperCase() ?? null;
    const ident = clean(airport.ident)?.toUpperCase() ?? null;
    const gpsCode = clean(airport.gps_code)?.toUpperCase() ?? null;
    const icao = gpsCode && /^[A-Z0-9]{4}$/.test(gpsCode) ? gpsCode : ident && /^[A-Z0-9]{4}$/.test(ident) ? ident : null;
    const countryIso = clean(airport.iso_country)?.toUpperCase() ?? null;
    const type = clean(airport.type);
    const scheduledService = String(airport.scheduled_service ?? "").toLowerCase() === "yes";
    const airportRunways = ident ? runwaysByAirport.get(ident) ?? [] : [];
    const airportFrequencies = ident ? frequenciesByAirport.get(ident) ?? [] : [];
    if (airportRunways.length) runwayAirportCount++;
    if (airportFrequencies.length) frequencyAirportCount++;

    const record = {
        icao, iata, ident, name: clean(airport.name), latitude, longitude,
        elevationFt: numberOrNull(airport.elevation_ft),
        country: countryIso ? countryNames.get(countryIso) ?? countryIso : null,
        countryIso, city: clean(airport.municipality), region: clean(airport.iso_region), type, scheduledService,
        wikipedia: clean(airport.wikipedia_link), website: clean(airport.home_link),
        runways: airportRunways, frequencies: airportFrequencies,
    };

    let used = false;
    if (iata && /^[A-Z0-9]{3}$/.test(iata)) { const shard = shardKey(iata); iataShards[shard] ??= {}; iataShards[shard][iata] = record; iataCount++; used = true; }
    if (icao) { const shard = shardKey(icao); icaoShards[shard] ??= {}; icaoShards[shard][icao] = record; icaoCount++; used = true; }
    if (used) indexed++;

    const mapRecord = { i: icao, a: iata, n: record.name, y: latitude, x: longitude, t: type, s: scheduledService, c: record.city, k: countryIso };
    if (type === "large_airport") { majorAirports.push(mapRecord); mapCount++; }
    if (type === "large_airport" || type === "medium_airport") pushTile(regionalTiles, tileKey(latitude, longitude, 20), mapRecord);
    if (iata || icao || type === "large_airport" || type === "medium_airport") pushTile(localTiles, tileKey(latitude, longitude, 5), mapRecord);
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "iata"), { recursive: true });
await mkdir(path.join(outputRoot, "icao"), { recursive: true });
for (const [shard, records] of Object.entries(iataShards)) await writeFile(path.join(outputRoot, "iata", `${shard}.json`), JSON.stringify(records), "utf8");
for (const [shard, records] of Object.entries(icaoShards)) await writeFile(path.join(outputRoot, "icao", `${shard}.json`), JSON.stringify(records), "utf8");
await mkdir(path.join(outputRoot, "map"), { recursive: true });
await writeFile(path.join(outputRoot, "map", "major.json"), JSON.stringify(majorAirports), "utf8");
await writeTiles(path.join(outputRoot, "map", "regional"), regionalTiles);
await writeTiles(path.join(outputRoot, "map", "local"), localTiles);
await writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify({
    source: "OurAirports", generatedAt: new Date().toISOString(), airportsDownloaded: airports.length, airportsIndexed: indexed,
    iataCodes: iataCount, icaoCodes: icaoCount, airportsWithRunways: runwayAirportCount, airportsWithFrequencies: frequencyAirportCount,
    mapMajorAirports: mapCount, regionalTileSizeDegrees: 20, localTileSizeDegrees: 5,
    regionalTiles: Object.keys(regionalTiles).length, localTiles: Object.keys(localTiles).length, license: "Public Domain",
}, null, 2), "utf8");

console.log(`OurAirports ready: ${indexed.toLocaleString("en-US")} airports indexed (${iataCount.toLocaleString("en-US")} IATA, ${icaoCount.toLocaleString("en-US")} ICAO, ${runwayAirportCount.toLocaleString("en-US")} with runways, ${frequencyAirportCount.toLocaleString("en-US")} with frequencies, ${majorAirports.length.toLocaleString("en-US")} major map airports, ${Object.keys(localTiles).length.toLocaleString("en-US")} local map tiles).`);
