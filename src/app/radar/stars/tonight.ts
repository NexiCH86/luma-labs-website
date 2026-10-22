import { type SkyObject } from "./stars-data";
import { solarSystemObjects, type Observer } from "./sky-catalog";
import { createSkyFrame, type NightInfo, type SkyFrame } from "./astro";

/*
 * "Tonight's best": die lohnendsten Objekte der Nacht fuer den Standort.
 * Die Nacht wird in 20-Minuten-Schritten abgetastet; pro Objekt zaehlt
 * die groesste Hoehe im dunklen Zeitfenster.
 */

export type TonightEntry = {
    object: SkyObject;
    bestTime: Date;
    maxAltitude: number;
    reason: string;
};

const STEP_MS = 20 * 60_000;
const MIN_ALTITUDE = 25;

/*
 * Dunkles Fenster: astronomische Nacht, sonst die hellste verfuegbare
 * Daemmerungsstufe; im Polarsommer die Stunden um Mitternacht.
 */
export function darkWindow(night: NightInfo, reference: Date): [Date, Date] {
    const start = night.astronomicalDusk ?? night.nauticalDusk ?? night.civilDusk ?? night.sunset;
    const end = night.astronomicalDawn ?? night.nauticalDawn ?? night.civilDawn ?? night.sunrise;
    if (start && end && end > start) return [start, end];
    return [new Date(reference.getTime() - 3 * 3_600_000), new Date(reference.getTime() + 3 * 3_600_000)];
}

function isMessier(object: SkyObject) {
    return object.kind === "dso" && /^M\d+$/.test(object.catalog);
}

export function tonightsBest(candidates: SkyObject[], observer: Observer, night: NightInfo, reference: Date): TonightEntry[] {
    const [start, end] = darkWindow(night, reference);
    const samples: Date[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += STEP_MS) samples.push(new Date(t));
    if (samples.length === 0) return [];

    const best = new Map<string, { object: SkyObject; altitude: number; time: Date }>();
    const consider = (object: SkyObject, time: Date, frame: SkyFrame) => {
        const { altitude } = frame.toHorizontal(object.ra, object.dec);
        const current = best.get(object.id);
        if (!current || altitude > current.altitude) best.set(object.id, { object, altitude, time });
    };

    for (const time of samples) {
        const frame = createSkyFrame(time, observer);
        for (const object of candidates) consider(object, time, frame);
        // Planeten wandern, deshalb je Zeitpunkt neu berechnet (ohne Sonne und Mond).
        for (const planet of solarSystemObjects(time, observer)) {
            if (planet.id !== "sun" && planet.id !== "moon" && planet.magnitude < 7) consider(planet, time, frame);
        }
    }

    const entries = [...best.values()].filter((entry) => entry.altitude >= MIN_ALTITUDE);
    const score = (entry: { object: SkyObject; altitude: number }) => Math.sin((entry.altitude * Math.PI) / 180) * (12 - Math.min(entry.object.magnitude, 11));

    const pick = (filter: (object: SkyObject) => boolean, count: number) =>
        entries
            .filter((entry) => filter(entry.object))
            .sort((a, b) => score(b) - score(a))
            .slice(0, count);

    const planets = pick((object) => object.kind === "planet", 5);
    const deepSky = pick((object) => object.kind === "dso" && (isMessier(object) || object.magnitude <= 6), 6);
    const stars = pick((object) => object.kind === "star", 3);

    const reasonFor = (object: SkyObject) =>
        object.kind === "planet" ? "Planet" : object.kind === "dso" ? object.objectType : `Bright star · ${object.constellation}`;

    return [...planets, ...deepSky, ...stars].map((entry) => ({
        object: entry.object,
        bestTime: entry.time,
        maxAltitude: entry.altitude,
        reason: reasonFor(entry.object),
    }));
}
