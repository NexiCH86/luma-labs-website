import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
    "https://s3.opensky-network.org/data-samples/metadata/aircraftDatabase.csv";

const OUTPUT_DIR = path.join(
    process.cwd(),
    "public",
    "data",
    "opensky-aircraft"
);

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

    return {
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
}

async function main() {
    console.log("Downloading OpenSky aircraft metadata...");

    const response = await fetch(SOURCE_URL);

    if (!response.ok || !response.body) {
        throw new Error(
            `OpenSky download failed: ${response.status} ${response.statusText}`
        );
    }

    await rm(OUTPUT_DIR, {
        recursive: true,
        force: true,
    });
    await mkdir(OUTPUT_DIR, {
        recursive: true,
    });

    const shards = new Map();
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

        const prefix = icao24.slice(0, 2);
        const suffix = icao24.slice(2);
        let shard = shards.get(prefix);

        if (!shard) {
            shard = {};
            shards.set(prefix, shard);
        }

        shard[suffix] = compactRecord(
            fields,
            headerIndex
        );
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

    const writes = [];

    for (const [prefix, shard] of shards) {
        writes.push(
            writeFile(
                path.join(
                    OUTPUT_DIR,
                    `${prefix}.json`
                ),
                JSON.stringify(shard),
                "utf8"
            )
        );
    }

    writes.push(
        writeFile(
            path.join(
                OUTPUT_DIR,
                "manifest.json"
            ),
            JSON.stringify(
                {
                    source: SOURCE_URL,
                    generatedAt:
                        new Date().toISOString(),
                    records: count,
                    shards: shards.size,
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

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
