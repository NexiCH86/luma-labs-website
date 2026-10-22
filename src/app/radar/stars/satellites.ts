import {
    degreesLat,
    degreesLong,
    eciToEcf,
    eciToGeodetic,
    ecfToLookAngles,
    gstime,
    json2satrec,
    jday,
    propagate,
    sunPos,
    type SatRec,
} from "satellite.js";
import { type Observer } from "./sky-catalog";

/*
 * Satelliten fuer den STARS-Modus: Bahndaten (OMM) von CelesTrak ueber
 * /api/radar/satellites (wie im SAT-Modus), Bahnrechnung SGP4 mit
 * satellite.js. Sichtbar ist ein Satellit, wenn er ueber dem Horizont
 * steht, selbst von der Sonne beschienen wird und es am Standort
 * dunkel genug ist.
 */

type OmmRecord = Record<string, unknown> & { OBJECT_NAME?: string; NORAD_CAT_ID?: number; category?: string };
export type SatelliteEntry = { id: string; norad: number; name: string; category: string; satrec: SatRec };

export type SatelliteState = {
    id: string;
    norad: number;
    name: string;
    category: string;
    altitude: number;
    azimuth: number;
    rangeKm: number;
    heightKm: number;
    lat: number;
    lon: number;
    sunlit: boolean;
    speedKms: number;
};

export type SatellitePass = {
    id: string;
    name: string;
    rise: Date;
    riseAzimuth: number;
    peak: Date;
    peakAltitude: number;
    set: Date;
    setAzimuth: number;
    visible: boolean;
};

const EARTH_RADIUS_KM = 6378.137;
const RAD = Math.PI / 180;
// Raumstationen und das Hubble-Teleskop immer beschriften.
const HIGHLIGHT = new Set([25544, 48274, 20580]);

export const SATELLITE_GROUPS = { bright: "STATIONS,VISUAL", starlink: "STARLINK" } as const;

const cache = new Map<string, Promise<SatelliteEntry[]>>();

export function loadSatellites(groups: string): Promise<SatelliteEntry[]> {
    let promise = cache.get(groups);
    if (!promise) {
        promise = fetch(`/api/radar/satellites?groups=${groups}`)
            .then((response) => response.json() as Promise<{ ok: boolean; satellites?: OmmRecord[]; error?: string }>)
            .then((data) => {
                if (!data.ok || !data.satellites) throw new Error(data.error ?? "Satellites unavailable");
                const entries: SatelliteEntry[] = [];
                for (const record of data.satellites) {
                    try {
                        const satrec = json2satrec(record as unknown as Parameters<typeof json2satrec>[0]);
                        const norad = Number(record.NORAD_CAT_ID);
                        entries.push({ id: `sat-${norad}`, norad, name: String(record.OBJECT_NAME ?? norad), category: String(record.category ?? ""), satrec });
                    } catch {
                        // Unvollstaendige Datensaetze ueberspringen.
                    }
                }
                return entries;
            });
        promise.catch(() => cache.delete(groups));
        cache.set(groups, promise);
    }
    return promise;
}

export function isHighlighted(norad: number) {
    return HIGHLIGHT.has(norad);
}

function observerGeodetic(observer: Observer) {
    return { latitude: observer.lat * RAD, longitude: observer.lon * RAD, height: 0.4 };
}

/*
 * Erdschatten als Zylinder: im Schatten, wenn der Satellit hinter der
 * Erde liegt (von der Sonne aus) und naeher als ein Erdradius an der
 * Achse Sonne-Erde ist.
 */
function isSunlit(position: { x: number; y: number; z: number }, sun: number[]) {
    const length = Math.hypot(sun[0], sun[1], sun[2]);
    const s = sun.map((value) => value / length);
    const along = position.x * s[0] + position.y * s[1] + position.z * s[2];
    if (along > 0) return true;
    const perpendicular = Math.hypot(position.x - along * s[0], position.y - along * s[1], position.z - along * s[2]);
    return perpendicular > EARTH_RADIUS_KM;
}

export function satelliteState(entry: SatelliteEntry, date: Date, observer: Observer): SatelliteState | null {
    const result = propagate(entry.satrec, date);
    if (!result || typeof result.position !== "object" || !result.position) return null;
    const position = result.position;
    const velocity = result.velocity as { x: number; y: number; z: number } | undefined;
    const gmst = gstime(date);
    const ecf = eciToEcf(position, gmst);
    const look = ecfToLookAngles(observerGeodetic(observer), ecf);
    const geodetic = eciToGeodetic(position, gmst);
    const sun = sunPos(jday(date)).rsun;
    return {
        id: entry.id,
        norad: entry.norad,
        name: entry.name,
        category: entry.category,
        altitude: look.elevation / RAD,
        azimuth: (((look.azimuth / RAD) % 360) + 360) % 360,
        rangeKm: look.rangeSat,
        heightKm: geodetic.height,
        lat: degreesLat(geodetic.latitude),
        lon: degreesLong(geodetic.longitude),
        sunlit: isSunlit(position, sun),
        speedKms: velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : 0,
    };
}

/*
 * Bodenspur (Erdansicht) bzw. Bahn am Himmel um einen Zeitpunkt.
 */
export function groundTrack(entry: SatelliteEntry, date: Date, minutesBefore: number, minutesAfter: number, stepMinutes = 1) {
    const points: { lat: number; lon: number }[] = [];
    for (let m = -minutesBefore; m <= minutesAfter; m += stepMinutes) {
        const when = new Date(date.getTime() + m * 60_000);
        const result = propagate(entry.satrec, when);
        if (!result || typeof result.position !== "object" || !result.position) continue;
        const geodetic = eciToGeodetic(result.position, gstime(when));
        points.push({ lat: degreesLat(geodetic.latitude), lon: degreesLong(geodetic.longitude) });
    }
    return points;
}

export function skyTrack(entry: SatelliteEntry, date: Date, observer: Observer, minutes = 6, stepSeconds = 20) {
    const points: { altitude: number; azimuth: number }[] = [];
    for (let s = -minutes * 60; s <= minutes * 60; s += stepSeconds) {
        const state = satelliteState(entry, new Date(date.getTime() + s * 1000), observer);
        if (state) points.push({ altitude: state.altitude, azimuth: state.azimuth });
    }
    return points;
}

/*
 * Ueberfluege der naechsten Tage (Hoehe > minAltitude). Sichtbar, wenn
 * der Satellit am hoechsten Punkt beschienen ist und die Sonne am
 * Standort tiefer als -6° steht (buergerliche Daemmerung vorbei).
 */
export function predictPasses(
    entry: SatelliteEntry,
    start: Date,
    observer: Observer,
    sunAltitudeAt: (date: Date) => number,
    hours = 72,
    minAltitude = 10
): SatellitePass[] {
    const passes: SatellitePass[] = [];
    const stepMs = 30_000;
    let current: { rise: Date; riseAzimuth: number; peak: Date; peakAltitude: number; peakSunlit: boolean } | null = null;
    let previous: SatelliteState | null = null;

    for (let t = start.getTime(); t <= start.getTime() + hours * 3_600_000; t += stepMs) {
        const date = new Date(t);
        const state = satelliteState(entry, date, observer);
        if (!state) continue;
        if (state.altitude >= minAltitude) {
            if (!current) current = { rise: date, riseAzimuth: state.azimuth, peak: date, peakAltitude: state.altitude, peakSunlit: state.sunlit };
            if (state.altitude > current.peakAltitude) {
                current.peak = date;
                current.peakAltitude = state.altitude;
                current.peakSunlit = state.sunlit;
            }
        } else if (current && previous) {
            passes.push({
                id: `${entry.id}-${current.rise.getTime()}`,
                name: entry.name,
                rise: current.rise,
                riseAzimuth: current.riseAzimuth,
                peak: current.peak,
                peakAltitude: current.peakAltitude,
                set: date,
                setAzimuth: previous.azimuth,
                visible: current.peakSunlit && sunAltitudeAt(current.peak) < -6,
            });
            current = null;
        }
        previous = state;
    }
    return passes;
}
