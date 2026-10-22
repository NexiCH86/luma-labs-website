import {
    Body,
    DefineStar,
    Illumination,
    MoonPhase,
    Observer as AstroObserver,
    Refraction,
    Rotation_EQJ_EQD,
    SearchAltitude,
    SearchHourAngle,
    SearchRiseSet,
    SiderealTime,
} from "astronomy-engine";
import { type SkyObject } from "./stars-data";
import { type Observer } from "./sky-catalog";

/*
 * Rechenhilfen fuer den STARS-Modus: Koordinaten, Auf-/Untergang,
 * Daemmerung und Mond. Zeiten sind Date-Objekte; angezeigt werden sie
 * in der Zeitzone des Standorts (format.ts).
 */

const OBLIQUITY = 23.4393;
const HOUR = 3_600_000;
const RAD = Math.PI / 180;

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export type Horizontal = { altitude: number; azimuth: number };

/*
 * Koordinatenrahmen fuer einen Zeitpunkt und Standort. Kataloge und
 * Planeten liegen in J2000 vor; der Rahmen rechnet mit Praezession und
 * Nutation (astronomy-engine) auf das Datum um, nutzt die scheinbare
 * Sternzeit und hebt Objekte am Horizont um die Lichtbrechung an.
 * Eine 3x3-Matrix fasst J2000 -> Datum -> Horizont zusammen, damit
 * auch 40'000 Sterne pro Bild schnell gehen.
 */
export type SkyFrame = {
    date: Date;
    // Sternzeit in Stunden: scheinbar in Greenwich und am Standort
    gast: number;
    lst: number;
    toHorizontal: (ra: number, dec: number) => Horizontal;
    toDate: (ra: number, dec: number) => { ra: number; dec: number };
    fromHorizontal: (altitude: number, azimuth: number) => { ra: number; dec: number };
};

export function createSkyFrame(date: Date, observer: Observer, refraction = true): SkyFrame {
    // RotateVector-Konvention von astronomy-engine: out[j] = sum_i rot[i][j] * v[i]
    const rot = Rotation_EQJ_EQD(date).rot;
    const gast = SiderealTime(date);
    const lst = (((gast + observer.lon / 15) % 24) + 24) % 24;
    const theta = lst * 15 * RAD;
    const phi = observer.lat * RAD;
    const north = [-Math.sin(phi) * Math.cos(theta), -Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
    const east = [-Math.sin(theta), Math.cos(theta), 0];
    const up = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
    // m[k][i]: Anteil der J2000-Komponente i an Nord/Ost/Oben
    const m = [north, east, up].map((row) => [0, 1, 2].map((i) => row[0] * rot[i][0] + row[1] * rot[i][1] + row[2] * rot[i][2]));

    const unit = (ra: number, dec: number) => {
        const a = ra * 15 * RAD;
        const d = dec * RAD;
        const cd = Math.cos(d);
        return [cd * Math.cos(a), cd * Math.sin(a), Math.sin(d)];
    };

    return {
        date,
        gast,
        lst,
        toHorizontal: (ra, dec) => {
            const v = unit(ra, dec);
            const n = m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2];
            const e = m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2];
            const u = m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2];
            let altitude = Math.asin(clamp(u, -1, 1)) / RAD;
            if (refraction && altitude > -1) altitude += Refraction("normal", altitude);
            const azimuth = ((Math.atan2(e, n) / RAD) + 360) % 360;
            return { altitude, azimuth };
        },
        toDate: (ra, dec) => {
            const v = unit(ra, dec);
            const out = [0, 1, 2].map((j) => rot[0][j] * v[0] + rot[1][j] * v[1] + rot[2][j] * v[2]);
            return { ra: (((Math.atan2(out[1], out[0]) / RAD / 15) % 24) + 24) % 24, dec: Math.asin(clamp(out[2], -1, 1)) / RAD };
        },
        fromHorizontal: (altitude, azimuth) => {
            const h = altitude * RAD;
            const z = azimuth * RAD;
            const local = [Math.cos(h) * Math.cos(z), Math.cos(h) * Math.sin(z), Math.sin(h)];
            // m ist orthonormal: die Transponierte fuehrt zurueck nach J2000.
            const v = [0, 1, 2].map((i) => m[0][i] * local[0] + m[1][i] * local[1] + m[2][i] * local[2]);
            return { ra: (((Math.atan2(v[1], v[0]) / RAD / 15) % 24) + 24) % 24, dec: Math.asin(clamp(v[2], -1, 1)) / RAD };
        },
    };
}

export function julianDate(date: Date) {
    return date.getTime() / 86400000 + 2440587.5;
}

export function localSiderealTime(date: Date, lon: number) {
    const jd = julianDate(date);
    const d = jd - 2451545.0;
    const gmst = 18.697374558 + 24.06570982441908 * d;
    return ((gmst + lon / 15) % 24 + 24) % 24;
}

/*
 * Hoehe/Azimut aus Rektaszension (h) und Deklination (Grad).
 * Die Ortssternzeit wird einmal pro Zeichnung berechnet.
 */
export function horizontal(ra: number, decDeg: number, lst: number, latDeg: number) {
    let hourAngle = (lst - ra) * 15;
    if (hourAngle > 180) hourAngle -= 360;
    if (hourAngle < -180) hourAngle += 360;

    const ha = (hourAngle * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    const lat = (latDeg * Math.PI) / 180;

    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const altitude = Math.asin(clamp(sinAlt, -1, 1));
    const cosAz = (Math.sin(dec) - Math.sin(altitude) * Math.sin(lat)) / (Math.cos(altitude) * Math.cos(lat));
    let azimuth = Math.acos(clamp(cosAz, -1, 1));
    if (Math.sin(ha) > 0) azimuth = 2 * Math.PI - azimuth;

    return { altitude: (altitude * 180) / Math.PI, azimuth: (azimuth * 180) / Math.PI };
}

/*
 * Punkt auf der Ekliptik (ekliptikale Laenge in Grad) -> RA (h) / Dec (Grad).
 */
export function eclipticToEquatorial(longitudeDeg: number) {
    const l = (longitudeDeg * Math.PI) / 180;
    const e = (OBLIQUITY * Math.PI) / 180;
    const ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l));
    const dec = Math.asin(Math.sin(e) * Math.sin(l));
    return { ra: ((((ra * 180) / Math.PI) / 15) % 24 + 24) % 24, dec: (dec * 180) / Math.PI };
}

export function azimuthLabel(azimuth: number) {
    const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return labels[Math.round(azimuth / 45) % 8];
}

const PLANET_BODIES: Record<string, Body> = {
    sun: Body.Sun,
    moon: Body.Moon,
    mercury: Body.Mercury,
    venus: Body.Venus,
    mars: Body.Mars,
    jupiter: Body.Jupiter,
    saturn: Body.Saturn,
    uranus: Body.Uranus,
    neptune: Body.Neptune,
};

function astroObserver(observer: Observer) {
    return new AstroObserver(observer.lat, observer.lon, 400);
}

/*
 * Sterne und Deep-Sky-Objekte laufen ueber einen der benutzerdefinierten
 * Sterne von astronomy-engine (Body.Star1), Planeten direkt.
 */
function bodyFor(object: SkyObject) {
    // Kometen und Kleinplaneten: fuer Auf-/Untergang genuegt die momentane Position.
    if (object.kind === "planet" && PLANET_BODIES[object.id]) return PLANET_BODIES[object.id];
    const distanceLy = object.kind === "planet" ? 1000 : object.distanceLy && object.distanceLy > 0 ? object.distanceLy : 1000;
    DefineStar(Body.Star1, object.ra, object.dec, distanceLy);
    return Body.Star1;
}

export type RiseTransitSet = {
    rise: Date | null;
    transit: Date | null;
    transitAltitude: number | null;
    set: Date | null;
    status: "normal" | "circumpolar" | "never";
};

/*
 * Naechster Aufgang, Kulmination und Untergang ab dem Zeitpunkt.
 * Findet die Suche innerhalb eines Tages keinen Horizontdurchgang,
 * ist das Objekt zirkumpolar oder geht nie auf.
 */
export function riseTransitSet(object: SkyObject, observer: Observer, date: Date, currentAltitude: number): RiseTransitSet {
    const body = bodyFor(object);
    if (!body) return { rise: null, transit: null, transitAltitude: null, set: null, status: "normal" };

    const obs = astroObserver(observer);

    try {
        const rise = SearchRiseSet(body, obs, +1, date, 1.1);
        const set = SearchRiseSet(body, obs, -1, date, 1.1);
        const transit = SearchHourAngle(body, obs, 0, date);
        const status = rise || set ? "normal" : currentAltitude > 0 ? "circumpolar" : "never";

        return {
            rise: rise?.date ?? null,
            transit: transit.time.date,
            transitAltitude: transit.hor.altitude,
            set: set?.date ?? null,
            status,
        };
    } catch {
        return { rise: null, transit: null, transitAltitude: null, set: null, status: "normal" };
    }
}

export type NightInfo = {
    sunset: Date | null;
    civilDusk: Date | null;
    nauticalDusk: Date | null;
    astronomicalDusk: Date | null;
    astronomicalDawn: Date | null;
    nauticalDawn: Date | null;
    civilDawn: Date | null;
    sunrise: Date | null;
};

/*
 * Die Nacht, zu der der Zeitpunkt gehoert: Suche ab dem lokalen
 * Mittag davor (Mittag aus der Laenge geschaetzt, nicht aus der Zeitzone).
 */
export function nightFor(date: Date, observer: Observer): NightInfo {
    const obs = astroObserver(observer);
    const offset = (observer.lon / 15) * HOUR;
    const local = new Date(date.getTime() + offset);
    const noon = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12) - offset;
    const start = new Date(noon > date.getTime() ? noon - 24 * HOUR : noon);

    const find = (direction: number, altitude: number, from: Date | null) => {
        if (!from) return null;
        try {
            return SearchAltitude(Body.Sun, obs, direction, from, 1, altitude)?.date ?? null;
        } catch {
            return null;
        }
    };
    const riseSet = (direction: number, from: Date | null) => {
        if (!from) return null;
        try {
            return SearchRiseSet(Body.Sun, obs, direction, from, 1)?.date ?? null;
        } catch {
            return null;
        }
    };

    const sunset = riseSet(-1, start);
    const civilDusk = find(-1, -6, start);
    const nauticalDusk = find(-1, -12, start);
    const astronomicalDusk = find(-1, -18, start);
    const dawnFrom = astronomicalDusk ?? nauticalDusk ?? civilDusk ?? sunset ?? start;

    return {
        sunset,
        civilDusk,
        nauticalDusk,
        astronomicalDusk,
        astronomicalDawn: astronomicalDusk ? find(+1, -18, dawnFrom) : null,
        nauticalDawn: nauticalDusk ? find(+1, -12, dawnFrom) : null,
        civilDawn: civilDusk ? find(+1, -6, dawnFrom) : null,
        sunrise: riseSet(+1, dawnFrom),
    };
}

export type MoonInfo = {
    phaseAngle: number;
    illumination: number;
    name: string;
};

const MOON_PHASES: [number, string][] = [
    [22.5, "New moon"],
    [67.5, "Waxing crescent"],
    [112.5, "First quarter"],
    [157.5, "Waxing gibbous"],
    [202.5, "Full moon"],
    [247.5, "Waning gibbous"],
    [292.5, "Last quarter"],
    [337.5, "Waning crescent"],
    [360, "New moon"],
];

export function moonInfo(date: Date): MoonInfo {
    const phaseAngle = MoonPhase(date);
    let illumination = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2;
    try {
        illumination = Illumination(Body.Moon, date).phase_fraction;
    } catch {
        // Naeherung aus dem Phasenwinkel genuegt.
    }
    const name = MOON_PHASES.find(([limit]) => phaseAngle < limit)?.[1] ?? "New moon";
    return { phaseAngle, illumination, name };
}
