import { describe, expect, it } from "vitest";
import { horizonProjector } from "../projection";
import { lookFromOrientation } from "../device-orientation";

describe("horizon projection", () => {
    const look = { azimuth: 180, altitude: 20, fov: 90, roll: 0 };
    const projector = horizonProjector(look, 800, 600);

    it("puts the look direction in the middle", () => {
        const center = projector.project(20, 180)!;
        expect(center.x).toBeCloseTo(400, 6);
        expect(center.y).toBeCloseTo(300, 6);
    });

    it("shows east to the left when looking south, and higher objects above", () => {
        expect(projector.project(20, 150)!.x).toBeLessThan(400);
        expect(projector.project(20, 210)!.x).toBeGreaterThan(400);
        expect(projector.project(40, 180)!.y).toBeLessThan(300);
    });

    it("spans the field of view across the width", () => {
        // 45° links und rechts der Mitte am Rand (stereografisch: genau am Rand fuer fov/2)
        expect(projector.project(20, 135, true)!.x).toBeGreaterThan(-5);
        expect(projector.project(0, 0)).toBeNull();
    });

    it("rotates the picture with the roll angle", () => {
        const rolled = horizonProjector({ ...look, roll: 90 }, 800, 600);
        const zenithward = rolled.project(40, 180)!;
        // Handy um 90° im Uhrzeigersinn gedreht: "oben" am Himmel liegt links im Bild.
        expect(zenithward.x).toBeLessThan(400);
        expect(zenithward.y).toBeCloseTo(300, 6);
    });
});

describe("device orientation", () => {
    it("looks north at the horizon when held upright facing north", () => {
        const look = lookFromOrientation({ alpha: 0, beta: 90, gamma: 0 });
        expect(look.altitude).toBeCloseTo(0, 6);
        expect(look.azimuth % 360).toBeCloseTo(0, 6);
        expect(look.roll).toBeCloseTo(0, 6);
    });

    it("looks east when turned 90° clockwise (alpha counts counter-clockwise)", () => {
        const look = lookFromOrientation({ alpha: 270, beta: 90, gamma: 0 });
        expect(look.azimuth).toBeCloseTo(90, 6);
    });

    it("looks up when tilted back", () => {
        const look = lookFromOrientation({ alpha: 0, beta: 135, gamma: 0 });
        expect(look.altitude).toBeCloseTo(45, 6);
    });
});
