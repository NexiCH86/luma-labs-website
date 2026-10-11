import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

/*
 * Aufruf:
 *
 *   node scripts/sync-opensky-aircraft.mjs [zielverzeichnis]
 *       Build: Daten aus dem GitHub-Release holen, sonst direkt von
 *       OpenSky. Schlaegt beides fehl, nur eine Warnung (Build laeuft
 *       weiter, Airframe-Abfragen liefern dann "nicht gefunden").
 *
 *   node scripts/sync-opensky-aircraft.mjs --bundle <datei.json.gz>
 *       Lokal: Daten von OpenSky laden und zusaetzlich als eine Datei
 *       fuer das GitHub-Release "opensky-aircraft-data" schreiben.
 *
 * Hintergrund: Vercel-Build-Server erreichen s3.opensky-network.org
 * nicht (Verbindungs-Timeout).
 */
const SOURCE_URL =
    "https://s3.opensky-network.org/data-samples/metadata/aircraftDatabase.csv";

const BUNDLE_URL =
    process.env.OPENSKY_AIRCRAFT_BUNDLE_URL ??
    "https://github.com/NexiCH86/luma-labs-website/releases/download/opensky-aircraft-data/opensky-aircraft.json.gz";

const args = process.argv.slice(2);
const bundleFlag = args.indexOf("--bundle");
const BUNDLE_FILE =
    bundleFlag >= 0 ? args[bundleFlag + 1] : null;
const positional = args.filter(
    (_, index) =>
        bundleFlag < 0 ||
        (index !== bundleFlag && index !== bundleFlag + 1)
);

const OUTPUT_DIR =
    positional[0] ??
    path.join(
        process.cwd(),
        "public",
        "data",
        "opensky-aircraft"
    );

/*
 * ICAO-Luftfahrzeugklasse (erster Buchstabe von icaoAircraftType):
 * H = Helikopter, G = Tragschrauber, T = Kipprotor.
 * Diese Liste laedt die Radar-Karte fuer eigene Symbole.
 */
const ROTORCRAFT_CLASSES = ["H", "G", "T"];

const wantedColumns = [
    "icao24",
    "registration",
    "manufacturername",
    "model",
    "typecode",
    "serialnumber",
    "linenumber",
    "icaoaircrafttype",
    "operator",
    "operatorcallsign",
    "operatoricao",
    "operatoriata",
    "owner",
    "registered",
    "reguntil",
    "status",
    "built",
    "firstflightdate",
    "seatconfiguration",
    "engines",
    "categoryDescription",
];

function parseCsvRecord(record) {
    const fields = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < record.length; i++) {
        const char = record[i];

        if (char === '"') {
            if (quoted && record[i + 1] === '"') {
                value += '"';
                i++;
            } else {
                quoted = !quoted;
            }
            continue;
        }

        if (char === "," && !quoted) {
            fields.push(value);
            value = "";
            continue;
        }

        value += char;
    }

    fields.push(value);
    return fields;
}

function clean(value) {
    const text = value?.trim();
    return text ? text : null;
}

function compactRecord(fields, index) {
    const get = (name) =>
        index[name] == null
            ? null
            : clean(fields[index[name]]);

    /*
     * Leere Felder weglassen: halbiert die Datenmenge. Die
     * Airframe-API liefert fehlende Felder als undefined.
     */
    const record = {
        registration: get("registration"),
        manufacturer: get("manufacturername"),
        model: get("model"),
        typeCode: get("typecode"),
        serialNumber: get("serialnumber"),
        lineNumber: get("linenumber"),
        icaoAircraftType: get("icaoaircrafttype"),
        operator: get("operator"),
        operatorCallsign: get("operatorcallsign"),
        operatorIcao: get("operatoricao"),
        operatorIata: get("operatoriata"),
        owner: get("owner"),
        registered: get("registered"),
        regUntil: get("reguntil"),
        status: get("status"),
        built: get("built"),
        firstFlightDate: get("firstflightdate"),
        seatConfiguration: get("seatconfiguration"),
        engines: get("engines"),
        categoryDescription: get("categoryDescription"),
    };

    return Object.fromEntries(
        Object.entries(record).filter(
            ([, value]) => value != null
        )
    );
}

async function loadFromCsv() {
    console.log("Downloading OpenSky aircraft metadata...");

    const response = await fetch(SOURCE_URL);

    if (!response.ok || !response.body) {
        throw new Error(
            `OpenSky download failed: ${response.status} ${response.statusText}`
        );
    }

    const shards = new Map();
    const rotorcraft = Object.fromEntries(
        ROTORCRAFT_CLASSES.map((kind) => [
            kind,
            [],
        ])
    );
    const decoder = new TextDecoder();
    let buffer = "";
    let record = "";
    let quoted = false;
    let headerIndex = null;
    let count = 0;

    function processRecord(rawRecord) {
        if (!rawRecord) return;

        const fields = parseCsvRecord(rawRecord.replace(/\r$/, ""));

        if (!headerIndex) {
            const headers = fields.map((field) => field.trim());
            headerIndex = Object.fromEntries(
                wantedColumns.map((name) => [
                    name,
                    headers.indexOf(name),
                ])
            );

            if (headerIndex.icao24 < 0) {
                throw new Error("OpenSky CSV has no icao24 column");
            }
            return;
        }

        const icao24 =
            fields[headerIndex.icao24]
                ?.trim()
                .toLowerCase();

        if (!/^[0-9a-f]{6}$/.test(icao24)) {
            return;
        }

        const compact = compactRecord(
            fields,
            headerIndex
        );

        if (
            !compact.registration &&
            !compact.typeCode &&
            !compact.model &&
            !compact.icaoAircraftType
        ) {
            return;
        }

        const prefix = icao24.slice(0, 2);
        const suffix = icao24.slice(2);
        let shard = shards.get(prefix);

        if (!shard) {
            shard = {};
            shards.set(prefix, shard);
        }

        shard[suffix] = compact;

        const kind =
            compact.icaoAircraftType?.[0];

        if (rotorcraft[kind]) {
            rotorcraft[kind].push(icao24);
        }

        count++;
    }

    for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, {
            stream: true,
        });

        for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];

            if (char === '"') {
                if (quoted && buffer[i + 1] === '"') {
                    record += '""';
                    i++;
                    continue;
                }
                quoted = !quoted;
                record += char;
                continue;
            }

            if (char === "\n" && !quoted) {
                processRecord(record);
                record = "";
            } else {
                record += char;
            }
        }

        buffer = "";
    }

    buffer += decoder.decode();
    record += buffer;
    processRecord(record);

    return {
        source: SOURCE_URL,
        count,
        shards,
        rotorcraft,
    };
}

async function loadFromBundle() {
    console.log("Downloading OpenSky aircraft bundle from GitHub release...");

    const response = await fetch(BUNDLE_URL, {
        signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
        throw new Error(
            `Bundle download failed: ${response.status} ${response.statusText}`
        );
    }

    const bundle = JSON.parse(
        gunzipSync(
            Buffer.from(await response.arrayBuffer())
        ).toString("utf8")
    );

    return {
        source: bundle.source ?? BUNDLE_URL,
        count: bundle.count,
        shards: new Map(Object.entries(bundle.shards)),
        rotorcraft: bundle.rotorcraft,
    };
}

async function writeBundle({ source, count, shards, rotorcraft }) {
    await writeFile(
        BUNDLE_FILE,
        gzipSync(
            JSON.stringify({
                source,
                generatedAt: new Date().toISOString(),
                count,
                rotorcraft,
                shards: Object.fromEntries(shards),
            })
        )
    );

    console.log(`Bundle written: ${BUNDLE_FILE}`);
}

async function writeOutput({ source, count, shards, rotorcraft }) {
    await rm(OUTPUT_DIR, {
        recursive: true,
        force: true,
    });
    await mkdir(OUTPUT_DIR, {
        recursive: true,
    });

    const writes = [];

    /*
     * gzip: ~19 MB statt ~108 MB, damit die Daten in das
     * Bundle der Airframe-Function passen.
     */
    for (const [prefix, shard] of shards) {
        writes.push(
            writeFile(
                path.join(
                    OUTPUT_DIR,
                    `${prefix}.json.gz`
                ),
                gzipSync(
                    JSON.stringify(shard)
                )
            )
        );
    }

    writes.push(
        writeFile(
            path.join(
                OUTPUT_DIR,
                "rotorcraft.json"
            ),
            JSON.stringify(rotorcraft),
            "utf8"
        )
    );

    writes.push(
        writeFile(
            path.join(
                OUTPUT_DIR,
                "manifest.json"
            ),
            JSON.stringify(
                {
                    source,
                    generatedAt:
                        new Date().toISOString(),
                    records: count,
                    shards: shards.size,
                    rotorcraft: Object.fromEntries(
                        Object.entries(rotorcraft).map(
                            ([kind, list]) => [
                                kind,
                                list.length,
                            ]
                        )
                    ),
                },
                null,
                2
            ),
            "utf8"
        )
    );

    await Promise.all(writes);

    console.log(
        `OpenSky metadata ready: ${count.toLocaleString("en-US")} aircraft in ${shards.size} shards.`
    );
}

async function main() {
    if (BUNDLE_FILE) {
        const data = await loadFromCsv();
        await writeOutput(data);
        await writeBundle(data);
        return;
    }

    for (const load of [loadFromBundle, loadFromCsv]) {
        try {
            await writeOutput(await load());
            return;
        } catch (error) {
            console.warn(
                `OpenSky metadata source failed: ${error instanceof Error ? error.message : error}`
            );
        }
    }

    console.warn(
        "OpenSky metadata unavailable. Build continues; airframe lookups will report not found."
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
