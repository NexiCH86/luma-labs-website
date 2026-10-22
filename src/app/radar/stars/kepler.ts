import { Body, GeoVector, HelioVector, JupiterMoons } from "astronomy-engine";
import { type PlanetObject } from "./stars-data";

/*
 * Kometen, Kleinplaneten und Jupitermonde fuer den STARS-Modus.
 * Kometen/Kleinplaneten: Zweikoerper-Bahn aus den Elementen
 * (scripts/sync-small-bodies.mjs), Erde aus astronomy-engine,
 * eine Iteration Lichtlaufzeit. Fuer eine Sternkarte genau genug
 * (Bogenminuten), Stoerungen durch Planeten fehlen.
 */

export type CometElements = { id: string; name: string; q: number; e: number; w: number; node: number; i: number; tp: number; H: number; G: number };
export type AsteroidElements = { id: string; name: string; a: number; e: number; i: number; node: number; w: number; M: number; epoch: number; H: number; G: number };
export type SmallBodiesFile = { comets: CometElements[]; asteroids: AsteroidElements[]; generatedAt?: string };

const RAD = Math.PI / 180;
const GAUSS_K = 0.01720209895;
const OBLIQUITY = 23.4392911 * RAD;
const LIGHT_DAYS_PER_AU = 0.0057755183;

let smallBodiesPromise: Promise<SmallBodiesFile> | null = null;

export function loadSmallBodies(): Promise<SmallBodiesFile> {
    smallBodiesPromise ??= fetch("/data/sky/small-bodies.json", { cache: "no-cache" }).then((response) => {
        if (!response.ok) throw new Error(`Small bodies unavailable (${response.status})`);
        return response.json() as Promise<SmallBodiesFile>;
    });
    smallBodiesPromise.catch(() => { smallBodiesPromise = null; });
    return smallBodiesPromise;
}

const julianDay = (date: Date) => date.getTime() / 86_400_000 + 2440587.5;

/*
 * Wahre Anomalie und Sonnenabstand aus Zeit seit Perihel:
 * Ellipse (Kepler-Gleichung), Parabel (Barker) oder Hyperbel.
 */
export function anomaly(q: number, e: number, daysSincePerihelion: number) {
    if (Math.abs(e - 1) < 1e-6) {
        const w = (3 * GAUSS_K * daysSincePerihelion) / Math.sqrt(2 * q * q * q);
        const y = Math.cbrt(w / 2 + Math.sqrt((w * w) / 4 + 1));
        const s = y - 1 / y;
        return { nu: 2 * Math.atan(s), r: q * (1 + s * s) };
    }
    if (e < 1) {
        const a = q / (1 - e);
        const meanAnomaly = (GAUSS_K / Math.pow(a, 1.5)) * daysSincePerihelion;
        const m = Math.atan2(Math.sin(meanAnomaly), Math.cos(meanAnomaly));
        let eccentric = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
        for (let k = 0; k < 50; k++) {
            const step = (eccentric - e * Math.sin(eccentric) - m) / (1 - e * Math.cos(eccentric));
            eccentric -= step;
            if (Math.abs(step) < 1e-12) break;
        }
        const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(eccentric / 2), Math.sqrt(1 - e) * Math.cos(eccentric / 2));
        return { nu, r: a * (1 - e * Math.cos(eccentric)) };
    }
    const a = q / (e - 1);
    const meanAnomaly = (GAUSS_K / Math.pow(a, 1.5)) * daysSincePerihelion;
    let hyperbolic = Math.asinh(meanAnomaly / e);
    for (let k = 0; k < 50; k++) {
        const step = (e * Math.sinh(hyperbolic) - hyperbolic - meanAnomaly) / (e * Math.cosh(hyperbolic) - 1);
        hyperbolic -= step;
        if (Math.abs(step) < 1e-12) break;
    }
    const nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(hyperbolic / 2));
    return { nu, r: a * (e * Math.cosh(hyperbolic) - 1) };
}

/*
 * Heliozentrische Position (AE) im aequatorialen J2000-System.
 */
function heliocentric(nu: number, r: number, w: number, node: number, i: number) {
    const u = (w + 0) * RAD + nu;
    const om = node * RAD;
    const inc = i * RAD;
    const xe = r * (Math.cos(om) * Math.cos(u) - Math.sin(om) * Math.sin(u) * Math.cos(inc));
    const ye = r * (Math.sin(om) * Math.cos(u) + Math.cos(om) * Math.sin(u) * Math.cos(inc));
    const ze = r * Math.sin(u) * Math.sin(inc);
    return { x: xe, y: ye * Math.cos(OBLIQUITY) - ze * Math.sin(OBLIQUITY), z: ye * Math.sin(OBLIQUITY) + ze * Math.cos(OBLIQUITY) };
}

function toRaDec(x: number, y: number, z: number) {
    const distance = Math.hypot(x, y, z);
    return { ra: (((Math.atan2(y, x) / RAD / 15) % 24) + 24) % 24, dec: Math.asin(z / distance) / RAD, distance };
}

type Orbit = { q: number; e: number; w: number; node: number; i: number; tp: number };

function asteroidOrbit(element: AsteroidElements): Orbit {
    // Perihelzeit aus mittlerer Anomalie zur Epoche.
    const n = GAUSS_K / Math.pow(element.a, 1.5) / RAD;
    return { q: element.a * (1 - element.e), e: element.e, w: element.w, node: element.node, i: element.i, tp: element.epoch - element.M / n };
}

/*
 * Geozentrische Position mit einer Iteration Lichtlaufzeit.
 */
export function geocentricPosition(orbit: Orbit, date: Date) {
    const earth = HelioVector(Body.Earth, date);
    let jd = julianDay(date);
    let result = { ra: 0, dec: 0, distance: 0, r: 0, sun: { x: 0, y: 0, z: 0 } };
    for (let pass = 0; pass < 2; pass++) {
        const { nu, r } = anomaly(orbit.q, orbit.e, jd - orbit.tp);
        const sun = heliocentric(nu, r, orbit.w, orbit.node, orbit.i);
        const geo = toRaDec(sun.x - earth.x, sun.y - earth.y, sun.z - earth.z);
        result = { ...geo, r, sun };
        jd = julianDay(date) - geo.distance * LIGHT_DAYS_PER_AU;
    }
    return result;
}

/*
 * Helligkeit: Kometen m = H + 5 log Δ + 2.5 G log r (MPC-Konvention),
 * Kleinplaneten H-G-System mit Phasenwinkel.
 */
function asteroidMagnitude(H: number, G: number, r: number, delta: number, earthSunDistance: number) {
    const cosPhase = (r * r + delta * delta - earthSunDistance * earthSunDistance) / (2 * r * delta);
    const phase = Math.acos(Math.max(-1, Math.min(1, cosPhase)));
    const phi1 = Math.exp(-3.33 * Math.pow(Math.tan(phase / 2), 0.63));
    const phi2 = Math.exp(-1.87 * Math.pow(Math.tan(phase / 2), 1.22));
    return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * phi1 + G * phi2);
}

export type MinorBody = PlanetObject & { minorKind: "comet" | "asteroid"; tailAngle?: number };

export function smallBodyObjects(file: SmallBodiesFile | null, date: Date): MinorBody[] {
    if (!file) return [];
    const earth = HelioVector(Body.Earth, date);
    const earthSun = Math.hypot(earth.x, earth.y, earth.z);
    const bodies: MinorBody[] = [];

    for (const comet of file.comets) {
        const position = geocentricPosition(comet, date);
        const magnitude = comet.H + 5 * Math.log10(position.distance) + 2.5 * comet.G * Math.log10(position.r);
        bodies.push({
            id: `comet-${comet.id.replace(/[^\w/.-]/g, "")}`,
            kind: "planet",
            minorKind: "comet",
            name: comet.name,
            constellation: "Comet",
            ra: position.ra,
            dec: position.dec,
            magnitude,
            distanceAu: position.distance,
        });
    }

    for (const asteroid of file.asteroids) {
        const position = geocentricPosition(asteroidOrbit(asteroid), date);
        bodies.push({
            id: `asteroid-${asteroid.id}`,
            kind: "planet",
            minorKind: "asteroid",
            name: asteroid.name,
            constellation: "Asteroid",
            ra: position.ra,
            dec: position.dec,
            magnitude: asteroidMagnitude(asteroid.H, asteroid.G, position.r, position.distance, earthSun),
            distanceAu: position.distance,
        });
    }

    return bodies;
}

/*
 * Galileische Monde: geozentrische Position von Jupiter plus
 * jovizentrische Mondposition (beide J2000, AE).
 */
export type JupiterMoon = { id: string; name: string; ra: number; dec: number; offsetEast: number; offsetNorth: number };

export function jupiterMoons(date: Date): { jupiter: { ra: number; dec: number }; moons: JupiterMoon[] } {
    const jupiter = GeoVector(Body.Jupiter, date, true);
    const center = toRaDec(jupiter.x, jupiter.y, jupiter.z);
    const info = JupiterMoons(date);
    const entries: [string, string, { x: number; y: number; z: number }][] = [
        ["io", "Io", info.io],
        ["europa", "Europa", info.europa],
        ["ganymede", "Ganymede", info.ganymede],
        ["callisto", "Callisto", info.callisto],
    ];
    const moons = entries.map(([id, name, state]) => {
        const s = state as unknown as { x: number; y: number; z: number };
        const position = toRaDec(jupiter.x + s.x, jupiter.y + s.y, jupiter.z + s.z);
        // Versatz in Bogensekunden: Ost = steigende Rektaszension
        let dra = (position.ra - center.ra) * 15;
        if (dra > 180) dra -= 360;
        if (dra < -180) dra += 360;
        return {
            id: `jupiter-${id}`,
            name,
            ra: position.ra,
            dec: position.dec,
            offsetEast: dra * Math.cos(center.dec * RAD) * 3600,
            offsetNorth: (position.dec - center.dec) * 3600,
        };
    });
    return { jupiter: { ra: center.ra, dec: center.dec }, moons };
}
