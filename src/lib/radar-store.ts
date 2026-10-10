import { gunzipSync, gzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";

/*
 * =====================================================
 * LuMa RADAR – Redis-Speicher
 * =====================================================
 *
 * Upstash Free erlaubt 500'000 Befehle und 10 GB Traffic
 * pro Monat. Der Collector liefert alle 25 Sekunden, also
 * rund 3'500 Mal pro Tag. Deshalb gilt:
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

export function getRadarRedis() {
    const url =
        process.env.RADAR_REDIS_KV_REST_API_URL;

    const token =
        process.env.RADAR_REDIS_KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error(
            "Radar Redis environment variables are missing"
        );
    }

    return new Redis({
        url,
        token,
        /*
         * Gespeichert wird nur ASCII (Base64), daher ist die
         * zusaetzliche Base64-Kodierung der Antworten unnoetig.
         */
        responseEncoding: false,
    });
}

export async function writeSnapshot(
    redis: Redis,
    snapshot: RadarSnapshot
) {
    await redis.set(
        SNAPSHOT_KEY,
        pack(snapshot),
        {
            ex: SNAPSHOT_TTL_SECONDS,
        }
    );
}

export async function readSnapshot(
    redis: Redis
) {
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
    redis: Redis,
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

    await redis.set(
        frameKey(
            Math.floor(now / TRACK_FRAME_MS)
        ),
        pack(frame),
        {
            ex:
                ((TRACK_HISTORY_FRAMES + 1) *
                    TRACK_FRAME_MS) /
                1000,
        }
    );
}

export async function readTrack(
    redis: Redis,
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

    const stored =
        await redis.mget<unknown[]>(keys);

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
    stored: unknown
): T | null {
    if (stored == null) {
        return null;
    }

    /*
     * Altes, unkomprimiertes Format: der Upstash-Client hat das
     * JSON bereits in ein Objekt umgewandelt.
     */
    if (typeof stored !== "string") {
        return stored as T;
    }

    if (!stored.startsWith(PACKED_PREFIX)) {
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
