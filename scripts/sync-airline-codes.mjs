import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Zuordnung IATA-Airline-Code (Flugticket, z. B. "LX 3155") zu
 * ICAO-Code (Funk-Rufzeichen, z. B. "SWR3155") fuer die Radar-Suche.
 *
 * Quelle: OpenFlights airlines.dat (ODbL), nur aktive Airlines.
 */
const SOURCE_URL =
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat";

const OUTPUT_FILE = path.join(
    process.cwd(),
    "public",
    "data",
    "airlines",
    "iata-icao.json"
);

/*
 * Luecken und Mehrdeutigkeiten in OpenFlights, die im Schweizer
 * Luftraum haeufig vorkommen.
 */
const OVERRIDES = {
    DS: ["EZS"], // easyJet Switzerland
    EC: ["EJU"], // easyJet Europe
    U2: ["EZY"], // easyJet UK
    LX: ["SWR"], // SWISS
    WK: ["EDW"], // Edelweiss
    "2L": ["OAW"], // Helvetic Airways
    LH: ["DLH"], // Lufthansa
    SN: ["BEL"], // Brussels Airlines (OpenFlights: alte DAT)
    AZ: ["ITY"], // ITA Airways (OpenFlights: Alitalia AZA)
    VY: ["VLG"], // Vueling
};

function parseCsvLine(line) {
    const fields = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
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

console.log("Downloading OpenFlights airline codes...");

const response = await fetch(SOURCE_URL, {
    signal: AbortSignal.timeout(60_000),
});

if (!response.ok) {
    throw new Error(`Airline download failed ${response.status}: ${SOURCE_URL}`);
}

const candidates = new Map();

for (const line of (await response.text()).split("\n")) {
    const [, name, , iata, icao, , , active] = parseCsvLine(line.trim());

    if (
        active !== "Y" ||
        !/^[A-Z0-9]{2}$/.test(iata ?? "") ||
        !/^[A-Z]{3}$/.test(icao ?? "")
    ) {
        continue;
    }

    const list = candidates.get(iata) ?? [];
    list.push({ icao, cargo: /cargo/i.test(name ?? "") });
    candidates.set(iata, list);
}

const codes = {};

for (const [iata, list] of candidates) {
    // Passagier-Airlines vor Cargo, damit "LH 1234" zuerst DLH1234 sucht.
    codes[iata] = [
        ...new Set(
            list
                .sort((a, b) => Number(a.cargo) - Number(b.cargo))
                .map((item) => item.icao)
        ),
    ];
}

for (const [iata, icaoList] of Object.entries(OVERRIDES)) {
    codes[iata] = [
        ...new Set([
            ...icaoList,
            ...(codes[iata] ?? []),
        ]),
    ];
}

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, JSON.stringify(codes), "utf8");

console.log(
    `Airline codes ready: ${Object.keys(codes).length.toLocaleString("en-US")} IATA codes.`
);
