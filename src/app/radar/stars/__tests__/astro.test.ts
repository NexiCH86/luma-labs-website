import { describe, expect, it } from "vitest";
import { Horizon, Observer as AstroObserver } from "astronomy-engine";
import { createSkyFrame, eclipticToEquatorial, moonInfo, nightFor } from "../astro";

const ZURICH = { lat: 47.3769, lon: 8.5417 };
const DATE = new Date("2026-10-22T20:30:00Z");

describe("createSkyFrame", () => {
    it("matches astronomy-engine for Vega, Sirius and Polaris", () => {
        const frame = createSkyFrame(DATE, ZURICH);
        const observer = new AstroObserver(ZURICH.lat, ZURICH.lon, 0);
        const stars: [string, number, number][] = [
            ["Vega", 18.6156, 38.7837],
            ["Sirius", 6.7525, -16.7161],
            ["Polaris", 2.5303, 89.2641],
        ];
        for (const [, ra, dec] of stars) {
            const ofDate = frame.toDate(ra, dec);
            const expected = Horizon(DATE, observer, ofDate.ra, ofDate.dec, "normal");
            const actual = frame.toHorizontal(ra, dec);
            // Unter dem Horizont rechnet astronomy-engine weiter Lichtbrechung ein, die Karte nicht.
            if (expected.altitude < 0) continue;
            expect(actual.altitude).toBeCloseTo(expected.altitude, 2);
            // Azimut nur vergleichen, wenn das Objekt nicht im Zenit steht.
            expect(Math.abs(((actual.azimuth - expected.azimuth + 540) % 360) - 180)).toBeLessThan(0.02);
        }
    });

    it("applies precession since J2000 (about 0.36° in 26 years)", () => {
        const frame = createSkyFrame(DATE, ZURICH);
        const vernalEquinox = frame.toDate(0, 0);
        const shift = vernalEquinox.ra > 12 ? (vernalEquinox.ra - 24) * 15 : vernalEquinox.ra * 15;
        expect(shift).toBeGreaterThan(0.3);
        expect(shift).toBeLessThan(0.42);
    });

    it("lifts objects at the horizon by refraction", () => {
        const withRefraction = createSkyFrame(DATE, ZURICH, true);
        const without = createSkyFrame(DATE, ZURICH, false);
        // Ein Punkt knapp ueber dem Horizont: rund ein halbes Grad Unterschied.
        const point = without.fromHorizontal(0.5, 120);
        const lifted = withRefraction.toHorizontal(point.ra, point.dec).altitude - without.toHorizontal(point.ra, point.dec).altitude;
        expect(lifted).toBeGreaterThan(0.3);
        expect(lifted).toBeLessThan(0.6);
    });

    it("converts horizontal coordinates back to J2000", () => {
        const frame = createSkyFrame(DATE, ZURICH, false);
        const sky = frame.fromHorizontal(42, 210);
        const back = frame.toHorizontal(sky.ra, sky.dec);
        expect(back.altitude).toBeCloseTo(42, 6);
        expect(back.azimuth).toBeCloseTo(210, 6);
    });
});

describe("nightFor", () => {
    it("finds sunset, darkness and sunrise for Zürich on 22 October 2026", () => {
        const night = nightFor(new Date("2026-10-22T15:00:00Z"), ZURICH);
        const utc = (date: Date | null) => date?.toISOString().slice(11, 16);
        // Lokalzeit CEST (UTC+2): Sonnenuntergang 18:25, Nacht 20:07–06:13, Aufgang 07:55
        expect(utc(night.sunset)).toBe("16:25");
        expect(utc(night.astronomicalDusk)).toBe("18:07");
        expect(utc(night.astronomicalDawn)).toBe("04:13");
        expect(utc(night.sunrise)).toBe("05:55");
    });

    it("reports no astronomical darkness in polar summer", () => {
        const night = nightFor(new Date("2026-06-21T12:00:00Z"), { lat: 69.65, lon: 18.96 });
        expect(night.astronomicalDusk).toBeNull();
        expect(night.sunset).toBeNull();
    });
});

describe("moon and ecliptic", () => {
    it("describes the waxing gibbous moon of 22 October 2026", () => {
        const moon = moonInfo(new Date("2026-10-22T16:00:00Z"));
        expect(moon.name).toBe("Waxing gibbous");
        expect(moon.illumination).toBeGreaterThan(0.8);
        expect(moon.illumination).toBeLessThan(0.92);
    });

    it("puts the summer solstice point at RA 6h, Dec +23.44°", () => {
        const point = eclipticToEquatorial(90);
        expect(point.ra).toBeCloseTo(6, 6);
        expect(point.dec).toBeCloseTo(23.4393, 3);
    });
});
