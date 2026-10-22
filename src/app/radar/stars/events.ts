import { AngleBetween, Body, GeoVector, SearchLocalSolarEclipse, SearchLunarEclipse, SearchMoonQuarter, Observer as AstroObserver, Elongation } from "astronomy-engine";
import { createSkyFrame } from "./astro";
import { solarSystemObjects, type Observer } from "./sky-catalog";
import { type SatellitePass } from "./satellites";

/*
 * Himmelsereignisse der naechsten Wochen: Mondphasen, Meteorstroeme,
 * Konjunktionen, Finsternisse, sichtbare ISS-Ueberfluege und die
 * Polarlicht-Aussicht (NOAA Kp-Index).
 */

export type SkyEvent = {
    id: string;
    time: Date;
    kind: "moon" | "meteor" | "conjunction" | "eclipse" | "pass" | "aurora";
    title: string;
    detail: string;
    // fuer Benachrichtigungen: ab wann vorher melden
    notify?: boolean;
    objectId?: string;
};

export type KpForecast = { time: Date; kp: number; observed: boolean }[];

const DAY = 86_400_000;

// Maximum der grossen Meteorstroeme (Monat, Tag) mit typischer Rate (ZHR).
const METEOR_SHOWERS: [string, number, number, number][] = [
    ["Quadrantids", 1, 3, 110],
    ["Lyrids", 4, 22, 18],
    ["Eta Aquariids", 5, 6, 50],
    ["Perseids", 8, 12, 100],
    ["Draconids", 10, 8, 10],
    ["Orionids", 10, 21, 20],
    ["Leonids", 11, 17, 15],
    ["Geminids", 12, 14, 150],
    ["Ursids", 12, 22, 10],
];

const QUARTERS = ["New moon", "First quarter", "Full moon", "Last quarter"];

const CONJUNCTION_BODIES: [Body, string][] = [
    [Body.Moon, "Moon"],
    [Body.Mercury, "Mercury"],
    [Body.Venus, "Venus"],
    [Body.Mars, "Mars"],
    [Body.Jupiter, "Jupiter"],
    [Body.Saturn, "Saturn"],
];

function moonPhases(start: Date, days: number): SkyEvent[] {
    const events: SkyEvent[] = [];
    let quarter = SearchMoonQuarter(start);
    while (quarter.time.date.getTime() < start.getTime() + days * DAY) {
        events.push({ id: `moon-${quarter.time.date.getTime()}`, time: quarter.time.date, kind: "moon", title: QUARTERS[quarter.quarter], detail: quarter.quarter === 0 ? "Darkest nights for deep-sky objects" : quarter.quarter === 2 ? "Bright moon all night" : "Moon visible half the night", objectId: "moon" });
        quarter = SearchMoonQuarter(new Date(quarter.time.date.getTime() + DAY));
    }
    return events;
}

function meteorShowers(start: Date, days: number): SkyEvent[] {
    const events: SkyEvent[] = [];
    for (const year of [start.getUTCFullYear(), start.getUTCFullYear() + 1]) {
        for (const [name, month, day, zhr] of METEOR_SHOWERS) {
            const time = new Date(Date.UTC(year, month - 1, day, 2));
            if (time.getTime() < start.getTime() - DAY || time.getTime() > start.getTime() + days * DAY) continue;
            events.push({ id: `meteor-${name}-${year}`, time, kind: "meteor", title: `${name} peak`, detail: `Up to ${zhr} meteors per hour under dark skies, best after midnight`, notify: true });
        }
    }
    return events;
}

/*
 * Engste Annaeherungen zwischen Mond und Planeten bzw. Planeten
 * untereinander (alle 6 Stunden abgetastet, dann lokales Minimum).
 * Paare zu nahe an der Sonne sind unbeobachtbar und fallen weg.
 */
function conjunctions(start: Date, days: number): SkyEvent[] {
    const events: SkyEvent[] = [];
    const step = 6 * 3_600_000;
    const vectors = new Map<number, ReturnType<typeof GeoVector>[]>();
    const times: Date[] = [];
    for (let t = start.getTime(); t <= start.getTime() + days * DAY; t += step) times.push(new Date(t));
    for (const [body] of CONJUNCTION_BODIES) vectors.set(CONJUNCTION_BODIES.findIndex(([b]) => b === body), times.map((time) => GeoVector(body, time, true)));

    for (let a = 0; a < CONJUNCTION_BODIES.length; a++) {
        for (let b = a + 1; b < CONJUNCTION_BODIES.length; b++) {
            const limit = a === 0 ? 4 : 2.5;
            const va = vectors.get(a)!;
            const vb = vectors.get(b)!;
            const separation = times.map((_, i) => AngleBetween(va[i], vb[i]));
            for (let i = 1; i < times.length - 1; i++) {
                if (separation[i] > limit || separation[i] > separation[i - 1] || separation[i] > separation[i + 1]) continue;
                const time = times[i];
                const elongation = Math.min(Elongation(CONJUNCTION_BODIES[b][0], time).elongation, a === 0 ? 180 : Elongation(CONJUNCTION_BODIES[a][0], time).elongation);
                if (elongation < 15) continue;
                const [, nameA] = CONJUNCTION_BODIES[a];
                const [, nameB] = CONJUNCTION_BODIES[b];
                events.push({ id: `conj-${nameA}-${nameB}-${time.getTime()}`, time, kind: "conjunction", title: `${nameA} & ${nameB}`, detail: `Only ${separation[i].toFixed(1)}° apart`, notify: true, objectId: nameB.toLowerCase() });
            }
        }
    }
    return events;
}

function eclipses(start: Date, observer: Observer): SkyEvent[] {
    const events: SkyEvent[] = [];
    const horizon = start.getTime() + 400 * DAY;
    try {
        const lunar = SearchLunarEclipse(start);
        if (lunar.peak.date.getTime() < horizon) {
            const moon = solarSystemObjects(lunar.peak.date, observer).find((body) => body.id === "moon");
            const altitude = moon ? createSkyFrame(lunar.peak.date, observer).toHorizontal(moon.ra, moon.dec).altitude : -90;
            events.push({
                id: `lunar-${lunar.peak.date.getTime()}`,
                time: lunar.peak.date,
                kind: "eclipse",
                title: `${lunar.kind[0].toUpperCase()}${lunar.kind.slice(1)} lunar eclipse`,
                detail: altitude > 0 ? `Visible here, Moon ${altitude.toFixed(0)}° high at maximum` : "Moon below the horizon here at maximum",
                notify: altitude > 0,
                objectId: "moon",
            });
        }
    } catch {
        // keine Finsternis gefunden
    }
    try {
        const solar = SearchLocalSolarEclipse(start, new AstroObserver(observer.lat, observer.lon, 400));
        if (solar.peak.time.date.getTime() < horizon) {
            events.push({
                id: `solar-${solar.peak.time.date.getTime()}`,
                time: solar.peak.time.date,
                kind: "eclipse",
                title: `${solar.kind[0].toUpperCase()}${solar.kind.slice(1)} solar eclipse`,
                detail: `${Math.round(solar.obscuration * 100)}% of the Sun covered here · never look without a filter`,
                notify: true,
                objectId: "sun",
            });
        }
    } catch {
        // keine Finsternis am Standort
    }
    return events;
}

/*
 * Polarlicht: grob noetiger Kp-Wert fuer die geografische Breite
 * (Polarlichtoval). In Mitteleuropa (47°N) braucht es etwa Kp 7.
 */
export function requiredKp(latitude: number) {
    return Math.max(1, Math.min(9, Math.round((66 - Math.abs(latitude)) / 2.7)));
}

function auroraOutlook(kp: KpForecast | null, start: Date, observer: Observer): SkyEvent[] {
    if (!kp?.length) return [];
    const upcoming = kp.filter((entry) => entry.time.getTime() >= start.getTime() - 3 * 3_600_000);
    if (!upcoming.length) return [];
    const peak = upcoming.reduce((top, entry) => (entry.kp > top.kp ? entry : top), upcoming[0]);
    const needed = requiredKp(observer.lat);
    const chance = peak.kp >= needed ? "likely visible here" : peak.kp >= needed - 1 ? "possible low on the northern horizon" : "not expected here";
    return [{
        id: `aurora-${peak.time.getTime()}-${peak.kp}`,
        time: peak.time,
        kind: "aurora",
        title: `Aurora: Kp ${peak.kp.toFixed(1)} forecast`,
        detail: `Needs about Kp ${needed} at this latitude – ${chance}`,
        notify: peak.kp >= needed - 1,
    }];
}

function satellitePasses(passes: SatellitePass[]): SkyEvent[] {
    return passes
        .filter((pass) => pass.visible)
        .slice(0, 6)
        .map((pass) => ({
            id: `pass-${pass.id}`,
            time: pass.rise,
            kind: "pass" as const,
            title: `${pass.name.replace(/\s*\(.*\)$/, "")} pass`,
            detail: `Max ${pass.peakAltitude.toFixed(0)}° · from ${compass(pass.riseAzimuth)} to ${compass(pass.setAzimuth)}`,
            notify: true,
            objectId: pass.id.split("-").slice(0, 2).join("-"),
        }));
}

function compass(azimuth: number) {
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(azimuth / 45) % 8];
}

export function upcomingEvents(start: Date, observer: Observer, passes: SatellitePass[], kp: KpForecast | null, days = 45): SkyEvent[] {
    return [
        ...auroraOutlook(kp, start, observer),
        ...satellitePasses(passes),
        ...moonPhases(start, days),
        ...meteorShowers(start, days),
        ...conjunctions(start, days),
        ...eclipses(start, observer),
    ].sort((a, b) => a.time.getTime() - b.time.getTime());
}
