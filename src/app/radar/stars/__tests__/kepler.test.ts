import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { anomaly, jupiterMoons, smallBodyObjects, type SmallBodiesFile } from "../kepler";

const file = JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "data", "small-bodies.fallback.json"), "utf8")) as SmallBodiesFile;
const DATE = new Date("2026-10-22T20:00:00Z");

describe("small bodies", () => {
    // Referenz: JPL Horizons, astrometrisch J2000, 22.10.2026 20:00 UTC
    const reference: Record<string, { ra: number; dec: number; mag: number; delta: number }> = {
        "asteroid-1": { ra: 112.63712, dec: 23.67329, mag: 8.387, delta: 2.3222 },
        "asteroid-4": { ra: 20.25469, dec: -4.06309, mag: 6.504, delta: 1.5057 },
    };

    it("matches JPL Horizons for Ceres and Vesta within a few arcminutes", () => {
        const bodies = smallBodyObjects(file, DATE);
        for (const [id, expected] of Object.entries(reference)) {
            const body = bodies.find((item) => item.id === id);
            expect(body).toBeDefined();
            expect(Math.abs(body!.ra * 15 - expected.ra)).toBeLessThan(0.1);
            expect(Math.abs(body!.dec - expected.dec)).toBeLessThan(0.1);
            expect(Math.abs(body!.magnitude - expected.mag)).toBeLessThan(0.3);
            expect(body!.distanceAu).toBeCloseTo(expected.delta, 2);
        }
    });

    it("solves parabolic and hyperbolic orbits continuously", () => {
        const near = [0.999999, 1, 1.000001].map((e) => anomaly(1.2, e, 40));
        expect(Math.abs(near[0].r - near[1].r)).toBeLessThan(1e-4);
        expect(Math.abs(near[2].r - near[1].r)).toBeLessThan(1e-4);
        expect(anomaly(1.2, 0.5, 0).r).toBeCloseTo(1.2, 9);
    });
});

describe("Jupiter's moons", () => {
    it("keeps all four moons within 30 arcminutes of Jupiter", () => {
        const { moons } = jupiterMoons(DATE);
        expect(moons.map((moon) => moon.name)).toEqual(["Io", "Europa", "Ganymede", "Callisto"]);
        for (const moon of moons) {
            expect(Math.hypot(moon.offsetEast, moon.offsetNorth)).toBeLessThan(1800);
        }
    });
});
