import {
    degreesLat,
    degreesLong,
    eciToEcf,
    eciToGeodetic,
    ecfToLookAngles,
    gstime,
    json2satrec,
    propagate,
    type SatRec,
} from "satellite.js";
import type { SatCategory, SatelliteRecord } from "@/lib/satellite-source";

/*
 * Bahnrechnung fuer den SAT-Modus (SGP4 mit satellite.js).
 * Ein Satellit wird einmal in ein SatEntry umgewandelt; alle
 * Panels rechnen danach mit demselben Eintrag.
 */

export type Vec3 = { x: number; y: number; z: number };

export type SatEntry = {
    norad: number;
    name: string;
    objectId: string | null;
    group: string;
    groupLabel: string;
    category: SatCategory;
    record: SatelliteRecord;
    satrec: SatRec;
};

export type Observer = { latitude: number; longitude: number; altitudeKm: number; label?: string };

export type LivePosition = { latitude: number; longitude: number; altitudeKm: number; speedKmS: number; eci: Vec3 };

export type Look = { elevation: number; azimuth: number; rangeKm: number; sunlit: boolean };

export type Pass = {
    rise: Date;
    peak: Date;
    set: Date;
    peakElevation: number;
    riseAzimuth: number;
    setAzimuth: number;
    sunlit: boolean;
    observerSunElevation: number;
    /* Mit blossem Auge sichtbar: hoch genug, beschienen, Beobachter im Dunkeln. */
    optical: boolean;
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const MU = 398600.4418;
export const EARTH_RADIUS_KM = 6378.137;
export const ISS_NORAD = 25544;

export function toEntry(record: SatelliteRecord): SatEntry | null {
    const norad = Number(record.NORAD_CAT_ID);
    if (!Number.isFinite(norad)) return null;
    try {
        const satrec = json2satrec(record as Parameters<typeof json2satrec>[0]);
        return {
            norad,
            name: record.OBJECT_NAME ?? `NORAD ${norad}`,
            objectId: record.OBJECT_ID ?? null,
            group: record.group,
            groupLabel: record.groupLabel,
            category: record.category,
            record,
            satrec,
        };
    } catch {
        return null;
    }
}

function propagateEci(entry: SatEntry, date: Date) {
    const result = propagate(entry.satrec, date);
    if (!result || typeof result.position !== "object" || !result.position) return null;
    const position = result.position as Vec3;
    if (![position.x, position.y, position.z].every(Number.isFinite)) return null;
    return { position, velocity: result.velocity as Vec3 | undefined };
}

export function positionAt(entry: SatEntry, date: Date): LivePosition | null {
    const result = propagateEci(entry, date);
    if (!result) return null;
    const geodetic = eciToGeodetic(result.position, gstime(date));
    const latitude = degreesLat(geodetic.latitude);
    const longitude = degreesLong(geodetic.longitude);
    if (![latitude, longitude, geodetic.height].every(Number.isFinite)) return null;
    const velocity = result.velocity;
    return {
        latitude,
        longitude,
        altitudeKm: geodetic.height,
        speedKmS: velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : 0,
        eci: result.position,
    };
}

export function lookAt(entry: SatEntry, observer: Observer, date: Date): Look | null {
    const result = propagateEci(entry, date);
    if (!result) return null;
    const look = ecfToLookAngles(
        { latitude: observer.latitude * DEG, longitude: observer.longitude * DEG, height: observer.altitudeKm },
        eciToEcf(result.position, gstime(date))
    );
    return {
        elevation: look.elevation * RAD,
        azimuth: norm360(look.azimuth * RAD),
        rangeKm: look.rangeSat,
        sunlit: isSunlit(result.position, date),
    };
}

/*
 * Bodenspur um den Zeitpunkt, an der Datumsgrenze in Teilstuecke
 * getrennt, damit die Linie nicht quer ueber die Karte springt.
 */
export function groundTrack(entry: SatEntry, date: Date): [number, number][][] {
    const period = orbitMetrics(entry.record)?.periodMin ?? 100;
    const span = Math.min(720, Math.max(100, Math.ceil(period * 1.2)));
    const step = Math.max(1, Math.round(span / 120));
    const segments: [number, number][][] = [];
    let segment: [number, number][] = [];
    for (let minute = -span / 2; minute <= span / 2; minute += step) {
        const position = positionAt(entry, new Date(date.getTime() + minute * 60_000));
        if (!position) continue;
        const previous = segment.at(-1);
        if (previous && Math.abs(previous[1] - position.longitude) > 180) {
            if (segment.length > 1) segments.push(segment);
            segment = [];
        }
        segment.push([position.latitude, position.longitude]);
    }
    if (segment.length > 1) segments.push(segment);
    return segments;
}

/*
 * Ueberfluege ueber dem Horizont (0°) in den naechsten Stunden.
 * Schritt 30 s; Auf- und Untergang sind damit auf eine halbe
 * Minute genau, das reicht fuer die Anzeige.
 */
export function predictPasses(entry: SatEntry, observer: Observer, start: Date, hours = 48, maxPasses = 5, stepMs = 30_000): Pass[] {
    const passes: Pass[] = [];
    let current: { rise: Date; riseAzimuth: number; peak: Date; peakElevation: number } | null = null;
    let lastAzimuth = 0;
    const end = start.getTime() + hours * 3_600_000;

    for (let time = start.getTime(); time <= end && passes.length < maxPasses; time += stepMs) {
        const date = new Date(time);
        const look = lookAt(entry, observer, date);
        if (!look) continue;
        if (look.elevation >= 0) {
            if (!current) current = { rise: date, riseAzimuth: look.azimuth, peak: date, peakElevation: look.elevation };
            if (look.elevation > current.peakElevation) {
                current.peak = date;
                current.peakElevation = look.elevation;
            }
            lastAzimuth = look.azimuth;
        } else if (current) {
            const atPeak = lookAt(entry, observer, current.peak);
            const sunlit = atPeak?.sunlit ?? false;
            const observerSunElevation = sunElevation(observer, current.peak);
            passes.push({
                ...current,
                set: date,
                setAzimuth: lastAzimuth,
                sunlit,
                observerSunElevation,
                optical: current.peakElevation >= 10 && sunlit && observerSunElevation < -6,
            });
            current = null;
        }
    }
    return passes;
}

export function orbitMetrics(record: SatelliteRecord) {
    const meanMotion = Number(record.MEAN_MOTION);
    const eccentricity = Number(record.ECCENTRICITY);
    if (!Number.isFinite(meanMotion) || !Number.isFinite(eccentricity) || meanMotion <= 0) return null;
    const n = (meanMotion * 2 * Math.PI) / 86400;
    const semiMajor = Math.cbrt(MU / (n * n));
    return {
        periodMin: 1440 / meanMotion,
        apogeeKm: semiMajor * (1 + eccentricity) - EARTH_RADIUS_KM,
        perigeeKm: semiMajor * (1 - eccentricity) - EARTH_RADIUS_KM,
    };
}

export function epochAgeDays(record: SatelliteRecord, now: Date) {
    if (!record.EPOCH) return null;
    const epoch = new Date(record.EPOCH.endsWith("Z") ? record.EPOCH : `${record.EPOCH}Z`);
    return Number.isNaN(epoch.getTime()) ? null : (now.getTime() - epoch.getTime()) / 86_400_000;
}

export function launchYear(objectId: string | null) {
    const match = objectId?.match(/^(\d{4})-/);
    return match ? Number(match[1]) : null;
}

/* ---------- Sonne ---------- */

export function norm360(value: number) {
    return ((value % 360) + 360) % 360;
}

function normLon(value: number) {
    return norm360(value + 180) - 180;
}

function julianDay(date: Date) {
    return date.getTime() / 86_400_000 + 2440587.5;
}

function gmstDeg(date: Date) {
    const jd = julianDay(date);
    const t = (jd - 2451545) / 36525;
    return norm360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/* Sonnenstand (genau auf etwa 0,01°), reicht fuer Tag/Nacht und Erdschatten. */
export function sunState(date: Date) {
    const n = julianDay(date) - 2451545;
    const meanLon = norm360(280.46 + 0.9856474 * n);
    const anomaly = norm360(357.528 + 0.9856003 * n) * DEG;
    const lambda = norm360(meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * DEG;
    const obliquity = (23.439 - 0.0000004 * n) * DEG;
    const ra = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
    const raDeg = norm360(ra * RAD);
    const decDeg = dec * RAD;
    return { raDeg, decDeg, subsolarLat: decDeg, subsolarLon: normLon(raDeg - gmstDeg(date)) };
}

export function sunElevation(observer: Pick<Observer, "latitude" | "longitude">, date: Date) {
    const sun = sunState(date);
    const lat = observer.latitude * DEG;
    const dec = sun.decDeg * DEG;
    const hourAngle = normLon(observer.longitude - sun.subsolarLon) * DEG;
    return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)) * RAD;
}

export function twilight(elevation: number) {
    if (elevation >= 0) return "DAYLIGHT";
    if (elevation >= -6) return "CIVIL TWILIGHT";
    if (elevation >= -12) return "NAUTICAL TWILIGHT";
    if (elevation >= -18) return "ASTRONOMICAL TWILIGHT";
    return "NIGHT";
}

/* Erdschatten als Zylinder hinter der Erde. */
export function isSunlit(position: Vec3, date: Date) {
    const sun = sunState(date);
    const ra = sun.raDeg * DEG;
    const dec = sun.decDeg * DEG;
    const unit = { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
    const along = position.x * unit.x + position.y * unit.y + position.z * unit.z;
    if (along >= 0) return true;
    return Math.hypot(position.x - along * unit.x, position.y - along * unit.y, position.z - along * unit.z) > EARTH_RADIUS_KM;
}

/* ---------- Sichtbarkeit ---------- */

export type Visibility = {
    label: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "BELOW HORIZON" | "LOCATION REQUIRED";
    score: number;
    reason: string;
};

/* Schaetzung aus der Geometrie, keine kalibrierte Helligkeit. */
export function visibilityRating(look: Look | null, category: SatCategory): Visibility {
    if (!look) return { label: "LOCATION REQUIRED", score: 0, reason: "Set MY LOCATION for observer geometry." };
    if (look.elevation <= 0) return { label: "BELOW HORIZON", score: 0, reason: "The satellite is currently below your local horizon." };

    let score = Math.min(60, look.elevation * 1.25);
    if (look.sunlit) score += 22;
    if (look.rangeKm < 1000) score += 18;
    else if (look.rangeKm < 3000) score += 10;
    else if (look.rangeKm < 10000) score += 4;
    if (category === "station") score += 8;
    if (category === "constellation") score += 3;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const label: Visibility["label"] = score >= 80 ? "EXCELLENT" : score >= 60 ? "GOOD" : score >= 35 ? "FAIR" : "POOR";
    const reason = `${look.sunlit ? "Sunlit" : "Earth shadow"} · ${look.elevation.toFixed(0)}° elevation · ${Math.round(look.rangeKm).toLocaleString("de-CH")} km range. Geometry estimate, not a calibrated magnitude.`;
    return { label, score, reason };
}
