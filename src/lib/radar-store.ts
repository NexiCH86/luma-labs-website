import { gunzipSync, gzipSync } from "node:zlib";
import { createClient } from "redis";

/*
 * =====================================================
 * LuMa RADAR – Redis-Speicher
 * =====================================================
 *
 * Redis Cloud (Free, ueber den Vercel Marketplace):
 * 30 MB, 30 Verbindungen, 100 Befehle/s, 5 GB Traffic
 * pro Monat, aber kein monatliches Befehlslimit.
 *
 * Der Collector liefert alle 25 Sekunden. Deshalb gilt:
 *
 *   - Snapshot: genau 1 Befehl pro Lieferung
 *   - Spuren:   1 Befehl pro Minute (ein Frame mit allen
 *               Flugzeugen statt 2 Befehle pro Flugzeug)
 *   - Werte werden gzip-komprimiert gespeichert
 */

export type RadarAircraft = {
    icao24: string;
    callsign: string;
    country: string;
    longitude: number;
    latitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    verticalRate: number | null;
    geoAltitude: number | null;
    squawk: string | null;
};

export type RadarSnapshot = {
    updated: number;
    receivedAt: number;
    count: number;
    aircraft: RadarAircraft[];
};

export type RadarTrackPoint = {
    latitude: number;
    longitude: number;
    altitude: number | null;
    heading: number | null;
    velocity: number | null;
    timestamp: number;
};

/*
 * icao24 -> [latitude, longitude, altitude, heading, velocity]
 */
type TrackFrame = {
    t: number;
    a: Record<
        string,
        [number, number, number | null, number | null, number | null]
    >;
};

const SNAPSHOT_KEY = "radar:snapshot";

/*
 * Nach 90 Sekunden ohne Collector gelten die Daten als veraltet.
 */
const SNAPSHOT_TTL_SECONDS = 90;

const COLLECTOR_INTERVAL_MS = 25_000;

const TRACK_FRAME_PREFIX = "radar:frame:";
const TRACK_FRAME_MS = 60_000;

/*
 * 2 Stunden Verlauf. Flugzeuge bleiben selten laenger
 * im Schweizer Ausschnitt.
 */
const TRACK_HISTORY_FRAMES = 120;

const PACKED_PREFIX = "gz:";

/*
 * Eine Verbindung pro Function-Instanz, die ueber mehrere
 * Requests wiederverwendet wird (Free-Plan: max. 30).
 */
let connection: Promise<RadarRedis> | null = null;

function getRadarRedis() {
    if (connection) {
        return connection;
    }

    const url =
        process.env.RADAR_REDIS_URL;

    if (!url) {
        throw new Error(
            "RADAR_REDIS_URL is missing"
        );
    }

    const client =
        createRadarClient(url);

    client.on("error", (error) => {
        console.error(
            "Radar Redis error:",
            error
        );
    });

    client.on("end", () => {
        connection = null;
    });

    const pending = client
        .connect()
        .catch((error) => {
            connection = null;
            throw error;
        });

    connection = pending;

    return pending;
}

type RadarRedis = ReturnType<typeof createRadarClient>;

function createRadarClient(
    url: string
) {
    return createClient({
        url,
        socket: {
            connectTimeout: 5_000,
            /*
             * Nach 5 Fehlversuchen aufgeben, damit Requests nicht
             * bis zum Function-Timeout haengen. Der naechste
             * Request baut eine neue Verbindung auf.
             */
            reconnectStrategy: (retries) =>
                retries > 5
                    ? new Error(
                        "Radar Redis unreachable"
                    )
                    : Math.min(
                        retries * 200,
                        2_000
                    ),
        },
    });
}

export async function writeSnapshot(
    snapshot: RadarSnapshot
) {
    const redis =
        await getRadarRedis();

    await redis.set(
        SNAPSHOT_KEY,
        pack(snapshot),
        {
            expiration: {
                type: "EX",
                value: SNAPSHOT_TTL_SECONDS,
            },
        }
    );
}

export async function readSnapshot() {
    const redis =
        await getRadarRedis();

    return unpack<RadarSnapshot>(
        await redis.get(SNAPSHOT_KEY)
    );
}

/*
 * Bei 25 Sekunden Collector-Takt faellt pro Minute genau eine
 * Lieferung in die ersten 25 Sekunden. Nur diese schreibt
 * einen Spur-Frame.
 */
export function isTrackFrameDue(
    now: number
) {
    return (
        now % TRACK_FRAME_MS <
        COLLECTOR_INTERVAL_MS
    );
}

export async function writeTrackFrame(
    now: number,
    aircraft: RadarAircraft[]
) {
    const frame: TrackFrame = {
        t: now,
        a: {},
    };

    for (const item of aircraft) {
        frame.a[item.icao24.toLowerCase()] = [
            round(item.latitude, 4),
            round(item.longitude, 4),
            roundOrNull(item.altitude),
            roundOrNull(item.heading),
            roundOrNull(item.velocity),
        ];
    }

    const redis =
        await getRadarRedis();

    await redis.set(
        frameKey(
            Math.floor(now / TRACK_FRAME_MS)
        ),
        pack(frame),
        {
            expiration: {
                type: "EX",
                value:
                    ((TRACK_HISTORY_FRAMES + 1) *
                        TRACK_FRAME_MS) /
                    1000,
            },
        }
    );
}

export async function readTrack(
    icao24: string,
    now = Date.now()
) {
    const current =
        Math.floor(now / TRACK_FRAME_MS);

    /*
     * Aelteste zuerst, damit die Punkte chronologisch sind.
     * Ein einziger MGET-Befehl fuer den ganzen Verlauf.
     */
    const keys = Array.from(
        {
            length: TRACK_HISTORY_FRAMES + 1,
        },
        (_, index) =>
            frameKey(
                current -
                TRACK_HISTORY_FRAMES +
                index
            )
    );

    const redis =
        await getRadarRedis();

    const stored =
        await redis.mGet(keys);

    const id =
        icao24.toLowerCase();

    const points: RadarTrackPoint[] = [];

    for (const value of stored) {
        const frame =
            unpack<TrackFrame>(value);

        const entry =
            frame?.a[id];

        if (!frame || !entry) {
            continue;
        }

        const [
            latitude,
            longitude,
            altitude,
            heading,
            velocity,
        ] = entry;

        points.push({
            latitude,
            longitude,
            altitude,
            heading,
            velocity,
            timestamp: frame.t,
        });
    }

    return points;
}

/*
 * Allgemeiner Speicher fuer weitere RADAR-Modi, z. B. die
 * SAT-Bahndaten (gleiche Komprimierung wie Snapshot und Spuren).
 */
export function hasRadarStore() {
    return Boolean(process.env.RADAR_REDIS_URL);
}

export async function readStoredJson<T>(
    key: string
) {
    const redis =
        await getRadarRedis();

    return unpack<T>(
        await redis.get(key)
    );
}

export async function writeStoredJson(
    key: string,
    value: unknown,
    ttlSeconds: number
) {
    const redis =
        await getRadarRedis();

    await redis.set(
        key,
        pack(value),
        {
            expiration: {
                type: "EX",
                value: ttlSeconds,
            },
        }
    );
}

/*
 * Kurze Sperre ueber alle Function-Instanzen (SET NX). Gibt true
 * zurueck, wenn diese Instanz die Sperre erhalten hat.
 */
export async function acquireStoreLock(
    key: string,
    ttlSeconds: number
) {
    const redis =
        await getRadarRedis();

    const result = await redis.set(
        key,
        "1",
        {
            condition: "NX",
            expiration: {
                type: "EX",
                value: ttlSeconds,
            },
        }
    );

    return result === "OK";
}

function frameKey(
    bucket: number
) {
    return `${TRACK_FRAME_PREFIX}${bucket}`;
}

function pack(
    value: unknown
) {
    return (
        PACKED_PREFIX +
        gzipSync(
            JSON.stringify(value)
        ).toString("base64")
    );
}

function unpack<T>(
    stored: string | null
): T | null {
    if (
        !stored ||
        !stored.startsWith(PACKED_PREFIX)
    ) {
        return null;
    }

    return JSON.parse(
        gunzipSync(
            Buffer.from(
                stored.slice(PACKED_PREFIX.length),
                "base64"
            )
        ).toString("utf8")
    ) as T;
}

function round(
    value: number,
    digits: number
) {
    const factor =
        10 ** digits;

    return (
        Math.round(value * factor) /
        factor
    );
}

function roundOrNull(
    value: number | null | undefined
) {
    return typeof value === "number" &&
        Number.isFinite(value)
        ? Math.round(value)
        : null;
}
