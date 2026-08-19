import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const AIRPORTS_URL =
    "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRIES_URL =
    "https://davidmegginson.github.io/ourairports-data/countries.csv";

const outputRoot = path.join(
    process.cwd(),
    "public",
    "data",
    "ourairports"
);

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') {
            quoted = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field.replace(/\r$/, ""));
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field.replace(/\r$/, ""));
        rows.push(row);
    }

    const [header, ...data] = rows;
    return data
        .filter((values) => values.some(Boolean))
        .map((values) =>
            Object.fromEntries(
                header.map((key, index) => [key, values[index] ?? ""])
            )
        );
}

async function downloadCsv(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "text/csv",
            "User-Agent": "LuMa-Radar/1.0",
        },
    });

    if (!response.ok) {
        throw new Error(`Download failed ${response.status}: ${url}`);
    }

    return parseCsv(await response.text());
}

function shardKey(code) {
    const first = code[0]?.toUpperCase();
    return /^[A-Z0-9]$/.test(first ?? "") ? first : "_";
}

function clean(value) {
    const text = String(value ?? "").trim();
    return text || null;
}

function tileKey(latitude, longitude, size) {
    const lat = Math.max(-90, Math.min(89.999999, latitude));
    const lon = Math.max(-180, Math.min(179.999999, longitude));
    const latCell = Math.floor((lat + 90) / size);
    const lonCell = Math.floor((lon + 180) / size);
    return `${latCell}_${lonCell}`;
}

function pushTile(store, key, record) {
    store[key] ??= [];
    store[key].push(record);
}

async function writeTiles(directory, tiles) {
    await mkdir(directory, { recursive: true });

    for (const [tile, records] of Object.entries(tiles)) {
        await writeFile(
            path.join(directory, `${tile}.json`),
            JSON.stringify(records),
            "utf8"
        );
    }
}

console.log("Downloading OurAirports metadata...");

const [airports, countries] = await Promise.all([
    downloadCsv(AIRPORTS_URL),
    downloadCsv(COUNTRIES_URL),
]);

const countryNames = new Map(
    countries.map((country) => [
        String(country.code ?? "").toUpperCase(),
        clean(country.name),
    ])
);

const iataShards = {};
const icaoShards = {};
const majorAirports = [];
const regionalTiles = {};
const localTiles = {};

let indexed = 0;
let iataCount = 0;
let icaoCount = 0;
let mapCount = 0;

for (const airport of airports) {
    if (airport.type === "closed_airport") {
        continue;
    }

    const latitude = Number(airport.latitude_deg);
    const longitude = Number(airport.longitude_deg);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
    }

    const iata = clean(airport.iata_code)?.toUpperCase() ?? null;
    const ident = clean(airport.ident)?.toUpperCase() ?? null;
    const gpsCode = clean(airport.gps_code)?.toUpperCase() ?? null;
    const icao =
        gpsCode && /^[A-Z0-9]{4}$/.test(gpsCode)
            ? gpsCode
            : ident && /^[A-Z0-9]{4}$/.test(ident)
                ? ident
                : null;

    const countryIso = clean(airport.iso_country)?.toUpperCase() ?? null;
    const type = clean(airport.type);
    const scheduledService =
        String(airport.scheduled_service ?? "").toLowerCase() === "yes";

    const record = {
        icao,
        iata,
        name: clean(airport.name),
        latitude,
        longitude,
        elevationFt: Number.isFinite(Number(airport.elevation_ft))
            ? Number(airport.elevation_ft)
            : null,
        country: countryIso
            ? countryNames.get(countryIso) ?? countryIso
            : null,
        countryIso,
        city: clean(airport.municipality),
        region: clean(airport.iso_region),
        type,
        scheduledService,
        wikipedia: clean(airport.wikipedia_link),
        website: clean(airport.home_link),
    };

    let used = false;

    if (iata && /^[A-Z0-9]{3}$/.test(iata)) {
        const shard = shardKey(iata);
        iataShards[shard] ??= {};
        iataShards[shard][iata] = record;
        iataCount++;
        used = true;
    }

    if (icao) {
        const shard = shardKey(icao);
        icaoShards[shard] ??= {};
        icaoShards[shard][icao] = record;
        icaoCount++;
        used = true;
    }

    if (used) {
        indexed++;
    }

    const mapRecord = {
        i: icao,
        a: iata,
        n: record.name,
        y: latitude,
        x: longitude,
        t: type,
        s: scheduledService,
        c: record.city,
        k: countryIso,
    };

    if (type === "large_airport") {
        majorAirports.push(mapRecord);
        mapCount++;
    }

    if (
        type === "large_airport" ||
        type === "medium_airport"
    ) {
        pushTile(
            regionalTiles,
            tileKey(latitude, longitude, 20),
            mapRecord
        );
    }

    if (
        iata ||
        icao ||
        type === "large_airport" ||
        type === "medium_airport"
    ) {
        pushTile(
            localTiles,
            tileKey(latitude, longitude, 5),
            mapRecord
        );
    }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, "iata"), { recursive: true });
await mkdir(path.join(outputRoot, "icao"), { recursive: true });

for (const [shard, records] of Object.entries(iataShards)) {
    await writeFile(
        path.join(outputRoot, "iata", `${shard}.json`),
        JSON.stringify(records),
        "utf8"
    );
}

for (const [shard, records] of Object.entries(icaoShards)) {
    await writeFile(
        path.join(outputRoot, "icao", `${shard}.json`),
        JSON.stringify(records),
        "utf8"
    );
}

await mkdir(path.join(outputRoot, "map"), { recursive: true });
await writeFile(
    path.join(outputRoot, "map", "major.json"),
    JSON.stringify(majorAirports),
    "utf8"
);

await writeTiles(
    path.join(outputRoot, "map", "regional"),
    regionalTiles
);
await writeTiles(
    path.join(outputRoot, "map", "local"),
    localTiles
);

await writeFile(
    path.join(outputRoot, "manifest.json"),
    JSON.stringify(
        {
            source: "OurAirports",
            generatedAt: new Date().toISOString(),
            airportsDownloaded: airports.length,
            airportsIndexed: indexed,
            iataCodes: iataCount,
            icaoCodes: icaoCount,
            mapMajorAirports: mapCount,
            regionalTileSizeDegrees: 20,
            localTileSizeDegrees: 5,
            regionalTiles: Object.keys(regionalTiles).length,
            localTiles: Object.keys(localTiles).length,
            license: "Public Domain",
        },
        null,
        2
    ),
    "utf8"
);

console.log(
    `OurAirports ready: ${indexed.toLocaleString("en-US")} airports indexed ` +
        `(${iataCount.toLocaleString("en-US")} IATA, ${icaoCount.toLocaleString("en-US")} ICAO, ` +
        `${majorAirports.length.toLocaleString("en-US")} major map airports, ` +
        `${Object.keys(localTiles).length.toLocaleString("en-US")} local map tiles).`
);
