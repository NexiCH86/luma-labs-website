import { describe, expect, it } from "vitest";
import { Body } from "astronomy-engine";
import { distance, galacticLongitudeLatitude, galacticPosition, heliocentric, moonFromEarth, AU_KM, formatAu, galaxyParticles, SUN_GALACTIC_KLY } from "../space-data";

const DATE = new Date("2026-10-22T20:00:00Z");

describe("solar system scene", () => {
    it("keeps planets at their known distances from the Sun", () => {
        const earth = heliocentric(Body.Earth, DATE);
        const mars = heliocentric(Body.Mars, DATE);
        const jupiter = heliocentric(Body.Jupiter, DATE);
        expect(Math.hypot(...earth)).toBeCloseTo(0.995, 1);
        expect(Math.hypot(...mars)).toBeGreaterThan(1.38);
        expect(Math.hypot(...mars)).toBeLessThan(1.67);
        expect(Math.hypot(...jupiter)).toBeGreaterThan(4.9);
        expect(Math.hypot(...jupiter)).toBeLessThan(5.5);
        // Ekliptik ist die Ebene y = 0: die Erde liegt darin.
        expect(Math.abs(earth[1])).toBeLessThan(0.001);
    });

    it("puts the Moon about 384'400 km from Earth", () => {
        const km = Math.hypot(...moonFromEarth(DATE)) * AU_KM;
        expect(km).toBeGreaterThan(356_000);
        expect(km).toBeLessThan(407_000);
    });

    it("formats distances with light time", () => {
        expect(formatAu(1)).toBe("1.00 AU · 149.6 M km · 8.3 light-min");
        expect(distance([0, 0, 0], [3, 4, 0])).toBe(5);
    });
});

describe("galaxy scene", () => {
    it("places the galactic centre direction (Sgr A*) at l = 0", () => {
        // Sgr A*: RA 17h45m40s, Dec -29°00'28"
        const { l, b } = galacticLongitudeLatitude(17.7611, -29.0078);
        expect(Math.min(l, 360 - l)).toBeLessThan(0.1);
        expect(Math.abs(b)).toBeLessThan(0.1);
    });

    it("puts Sgr A* near the centre of the galaxy at 26'700 ly", () => {
        const p = galacticPosition(17.7611, -29.0078, 26_700);
        expect(Math.hypot(...p)).toBeLessThan(0.2);
        expect(SUN_GALACTIC_KLY[0]).toBe(-26.7);
    });

    it("spreads the galaxy model over the whole disc", () => {
        const { positions } = galaxyParticles(20_000);
        const cells = new Set<string>();
        let maxRadius = 0;
        for (let i = 0; i < positions.length; i += 3) {
            cells.add(`${Math.round(positions[i] / 2)},${Math.round(positions[i + 2] / 2)}`);
            maxRadius = Math.max(maxRadius, Math.hypot(positions[i], positions[i + 2]));
        }
        // Ein kaputter Zufallsgenerator faellt in einen kurzen Zyklus: wenige Zellen.
        expect(cells.size).toBeGreaterThan(1500);
        expect(maxRadius).toBeGreaterThan(45);
    });
});
