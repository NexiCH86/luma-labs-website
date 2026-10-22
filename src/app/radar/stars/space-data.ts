import { Body, GeoMoon, HelioVector } from "astronomy-engine";
import { anomaly, type SmallBodiesFile } from "./kepler";
import { type StarObject } from "./stars-data";

/*
 * Positionen fuer den 3D-Modus. Koordinatensystem der Szene (three.js):
 * y zeigt "nach oben" (Ekliptik-Nordpol bzw. Himmelsnordpol bzw.
 * galaktischer Nordpol), x/z liegen in der Hauptebene.
 */

export type Vec3 = [number, number, number];

const RAD = Math.PI / 180;
const OBLIQUITY = 23.4392911 * RAD;
export const AU_KM = 149_597_870.7;
export const LIGHT_SECONDS_PER_AU = 499.004784;
export const EARTH_RADIUS_KM = 6371;

// Aequatorial J2000 (x, y, z) -> Ekliptik -> Szene (Ekliptik-Nord nach oben)
export function equatorialToScene(x: number, y: number, z: number): Vec3 {
    const ye = y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY);
    const ze = -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY);
    return [x, ze, -ye];
}

export const PLANETS: { id: string; name: string; body: Body; periodDays: number; radiusKm: number; color: string }[] = [
    { id: "mercury", name: "Mercury", body: Body.Mercury, periodDays: 88, radiusKm: 2440, color: "#b9b2a8" },
    { id: "venus", name: "Venus", body: Body.Venus, periodDays: 225, radiusKm: 6052, color: "#f1d9a0" },
    { id: "earth", name: "Earth", body: Body.Earth, periodDays: 365.25, radiusKm: 6371, color: "#5aa7ff" },
    { id: "mars", name: "Mars", body: Body.Mars, periodDays: 687, radiusKm: 3390, color: "#ff8a5c" },
    { id: "jupiter", name: "Jupiter", body: Body.Jupiter, periodDays: 4333, radiusKm: 69911, color: "#e9c99a" },
    { id: "saturn", name: "Saturn", body: Body.Saturn, periodDays: 10759, radiusKm: 58232, color: "#f0dca0" },
    { id: "uranus", name: "Uranus", body: Body.Uranus, periodDays: 30687, radiusKm: 25362, color: "#9fe3ec" },
    { id: "neptune", name: "Neptune", body: Body.Neptune, periodDays: 60190, radiusKm: 24622, color: "#6f8dff" },
];

// Heliozentrische Position in AE (Szenenkoordinaten).
export function heliocentric(body: Body, date: Date): Vec3 {
    const v = HelioVector(body, date);
    return equatorialToScene(v.x, v.y, v.z);
}

// Bahn als Punktliste: eine Umlaufzeit um den Zeitpunkt herum abgetastet.
export function orbitPoints(body: Body, date: Date, periodDays: number, samples = 180): Vec3[] {
    const points: Vec3[] = [];
    for (let i = 0; i <= samples; i++) {
        const t = new Date(date.getTime() + ((i / samples) - 0.5) * periodDays * 86_400_000);
        points.push(heliocentric(body, t));
    }
    return points;
}

// Mond relativ zur Erde in AE (Szene)
export function moonFromEarth(date: Date): Vec3 {
    const v = GeoMoon(date);
    return equatorialToScene(v.x, v.y, v.z);
}

export function distance(a: Vec3, b: Vec3) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/*
 * Kometen und Kleinplaneten heliozentrisch (Szene, AE), dazu ihre Bahn.
 */
const GAUSS_K = 0.01720209895;

function orbitalPosition(q: number, e: number, w: number, node: number, i: number, days: number): Vec3 {
    const { nu, r } = anomaly(q, e, days);
    const u = w * RAD + nu;
    const om = node * RAD;
    const inc = i * RAD;
    // Bahnelemente sind ekliptikal: direkt in die Szene (Ekliptik-Nord = y)
    const x = r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(inc));
    const y = r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(inc));
    const z = r * Math.sin(u) * Math.sin(inc);
    return [x, z, -y];
}

export type SmallBodyPath = { id: string; name: string; kind: "comet" | "asteroid"; position: Vec3; orbit: Vec3[] };

export function smallBodyPaths(file: SmallBodiesFile | null, date: Date): SmallBodyPath[] {
    if (!file) return [];
    const jd = date.getTime() / 86_400_000 + 2440587.5;
    const result: SmallBodyPath[] = [];
    for (const comet of file.comets) {
        const position = orbitalPosition(comet.q, comet.e, comet.w, comet.node, comet.i, jd - comet.tp);
        // Nur Kometen im inneren Sonnensystem; Bahn nur bis 12 AE Sonnenabstand,
        // sonst ziehen weite und offene Bahnen gerade Linien durchs Bild.
        if (Math.hypot(...position) > 8) continue;
        const orbit: Vec3[] = [];
        for (let d = -1500; d <= 1500; d += 5) {
            const point = orbitalPosition(comet.q, comet.e, comet.w, comet.node, comet.i, d);
            if (Math.hypot(...point) <= 12) orbit.push(point);
        }
        result.push({ id: `comet-${comet.id.replace(/[^\w/.-]/g, "")}`, name: comet.name, kind: "comet", position, orbit });
    }
    for (const asteroid of file.asteroids) {
        const n = GAUSS_K / Math.pow(asteroid.a, 1.5) / RAD;
        const tp = asteroid.epoch - asteroid.M / n;
        const period = 360 / n;
        const orbit: Vec3[] = [];
        for (let k = 0; k <= 120; k++) orbit.push(orbitalPosition(asteroid.a * (1 - asteroid.e), asteroid.e, asteroid.w, asteroid.node, asteroid.i, (k / 120) * period));
        result.push({ id: `asteroid-${asteroid.id}`, name: asteroid.name, kind: "asteroid", position: orbitalPosition(asteroid.a * (1 - asteroid.e), asteroid.e, asteroid.w, asteroid.node, asteroid.i, jd - tp), orbit });
    }
    return result;
}

/*
 * Sterne in Lichtjahren um die Sonne (Szene: Himmelsnordpol nach oben).
 */
export function starPosition(ra: number, dec: number, distanceLy: number): Vec3 {
    const a = ra * 15 * RAD;
    const d = dec * RAD;
    return [Math.cos(d) * Math.cos(a) * distanceLy, Math.sin(d) * distanceLy, -Math.cos(d) * Math.sin(a) * distanceLy];
}

export function absoluteMagnitude(apparent: number, distanceLy: number) {
    return apparent - 5 * Math.log10(distanceLy / 3.26156 / 10);
}

export function starsWithDistance(stars: StarObject[]) {
    return stars.filter((star) => star.distanceLy && star.distanceLy > 0 && star.distanceLy < 20_000);
}

/*
 * Galaktische Koordinaten: J2000 -> galaktisch (IAU-Matrix), Galaxie-
 * Szene in tausend Lichtjahren, Zentrum im Ursprung, Sonne 26,7 kly
 * daneben, galaktischer Nordpol nach oben.
 */
const GALACTIC = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.4448296300, 0.7469822445],
    [-0.8676661490, -0.1980763734, 0.4559837762],
];
export const SUN_GALACTIC_KLY: Vec3 = [-26.7, 0.07, 0];

export function galacticPosition(ra: number, dec: number, distanceLy: number): Vec3 {
    const a = ra * 15 * RAD;
    const d = dec * RAD;
    const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const g = GALACTIC.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    const kly = distanceLy / 1000;
    // galaktisch x zum Zentrum, y Richtung Rotation, z Nordpol -> Szene (x, z, -y)
    return [SUN_GALACTIC_KLY[0] + g[0] * kly, SUN_GALACTIC_KLY[1] + g[2] * kly, SUN_GALACTIC_KLY[2] - g[1] * kly];
}

export function galacticLongitudeLatitude(ra: number, dec: number) {
    const a = ra * 15 * RAD;
    const d = dec * RAD;
    const v = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    const g = GALACTIC.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    return { l: ((Math.atan2(g[1], g[0]) / RAD) + 360) % 360, b: Math.asin(g[2]) / RAD };
}

/*
 * Prozedurale Milchstrasse: Balken, vier logarithmische Spiralarme,
 * Scheibe und Halo als Punktwolke (deterministisch, damit sie nicht
 * bei jedem Laden anders aussieht). Einheit: tausend Lichtjahre.
 */
export function galaxyParticles(count = 60_000) {
    let seed = 1234567;
    const random = () => {
        // mulberry32: 32-Bit-Ganzzahlen, damit keine Genauigkeit verloren geht
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const gaussian = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const arms = 4;
    for (let i = 0; i < count; i++) {
        const kind = random();
        let x: number, y: number, z: number;
        let color: [number, number, number];
        if (kind < 0.18) {
            // Bulge/Balken
            const r = Math.abs(gaussian()) * 4;
            const angle = random() * Math.PI * 2;
            x = Math.cos(angle) * r * 1.6;
            z = Math.sin(angle) * r * 0.7;
            y = gaussian() * 1.2;
            color = [1, 0.86, 0.62];
        } else if (kind < 0.9) {
            // Spiralarme: r = a * e^(b*theta)
            const arm = Math.floor(random() * arms);
            const r = 3 + Math.pow(random(), 0.8) * 50;
            const theta = Math.log(r / 3) / 0.22 + (arm * Math.PI * 2) / arms;
            const spread = 1.2 + r * 0.06;
            x = Math.cos(theta) * r + gaussian() * spread;
            z = Math.sin(theta) * r + gaussian() * spread;
            y = gaussian() * 0.35;
            const young = random() < 0.35;
            color = young ? [0.62, 0.74, 1] : [0.9, 0.9, 1];
        } else {
            // Duenne Scheibe und Halo
            const r = Math.abs(gaussian()) * 30;
            const angle = random() * Math.PI * 2;
            x = Math.cos(angle) * r;
            z = Math.sin(angle) * r;
            y = gaussian() * (random() < 0.3 ? 12 : 1);
            color = [0.75, 0.75, 0.85];
        }
        positions.set([x, y, z], i * 3);
        colors.set(color, i * 3);
    }
    return { positions, colors };
}

export function formatAu(au: number) {
    const km = au * AU_KM;
    const seconds = au * LIGHT_SECONDS_PER_AU;
    const light = seconds < 120 ? `${seconds.toFixed(1)} light-s` : seconds < 7200 ? `${(seconds / 60).toFixed(1)} light-min` : `${(seconds / 3600).toFixed(2)} light-h`;
    const kmText = km < 1e6 ? `${Math.round(km).toLocaleString("de-CH")} km` : `${(km / 1e6).toFixed(1)} M km`;
    return `${au.toFixed(au < 0.1 ? 4 : 2)} AU · ${kmText} · ${light}`;
}
