import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SatelliteRecord } from "@/lib/satellite-source";
import { groundTrack, isSunlit, lookAt, orbitMetrics, positionAt, predictPasses, sunElevation, toEntry, visibilityRating } from "../orbit";
import { buildShareQuery, readUrlState } from "../settings";

// ISS-Bahndaten (OMM) von CelesTrak, Epoche 21.10.2026
const issRecord = JSON.parse(readFileSync(path.join(__dirname, "../../stars/__tests__/iss-omm.json"), "utf8")) as SatelliteRecord;
const iss = toEntry(issRecord)!;
const DATE = new Date("2026-10-22T18:00:00Z");
const ZURICH = { latitude: 47.3769, longitude: 8.5417, altitudeKm: 0.4 };

// Vereinfachte Bahnen mit typischen Werten: GPS (MEO, 2 Umlaeufe/Tag) und ein geostationaerer Satellit.
function synthetic(name: string, norad: number, meanMotion: number, inclination: number, extra: Partial<SatelliteRecord> = {}) {
    return toEntry({
        OBJECT_NAME: name,
        OBJECT_ID: "2020-001A",
        EPOCH: "2026-10-21T00:00:00.000000",
        MEAN_MOTION: meanMotion,
        ECCENTRICITY: 0.0001,
        INCLINATION: inclination,
        RA_OF_ASC_NODE: 10,
        ARG_OF_PERICENTER: 0,
        MEAN_ANOMALY: 0,
        EPHEMERIS_TYPE: 0,
        CLASSIFICATION_TYPE: "U",
        NORAD_CAT_ID: norad,
        ELEMENT_SET_NO: 999,
        REV_AT_EPOCH: 1,
        BSTAR: 0,
        MEAN_MOTION_DOT: 0,
        MEAN_MOTION_DDOT: 0,
        category: "navigation",
        group: "GPS-OPS",
        groupLabel: "GPS",
        ...extra,
    })!;
}

const gps = synthetic("GPS TEST", 90001, 2.00563, 55);
const geo = synthetic("GEO TEST", 90002, 1.00273, 0.02, { category: "geo", group: "GEO", groupLabel: "Geostationary", MEAN_ANOMALY: 180 });

describe("positions", () => {
    it("puts the ISS about 420 km high at about 7.66 km/s", () => {
        const position = positionAt(iss, DATE)!;
        expect(position.altitudeKm).toBeGreaterThan(380);
        expect(position.altitudeKm).toBeLessThan(440);
        expect(position.speedKmS).toBeGreaterThan(7.5);
        expect(position.speedKmS).toBeLessThan(7.8);
        expect(Math.abs(position.latitude)).toBeLessThan(52);
    });

    it("puts GPS at about 20'200 km and a GEO satellite at about 35'786 km over the equator", () => {
        expect(positionAt(gps, DATE)!.altitudeKm).toBeGreaterThan(19_900);
        expect(positionAt(gps, DATE)!.altitudeKm).toBeLessThan(20_500);
        const position = positionAt(geo, DATE)!;
        expect(position.altitudeKm).toBeGreaterThan(35_650);
        expect(position.altitudeKm).toBeLessThan(35_900);
        expect(Math.abs(position.latitude)).toBeLessThan(0.5);
    });

    it("derives period, apogee and perigee from the elements", () => {
        const metrics = orbitMetrics(iss.record)!;
        expect(metrics.periodMin).toBeGreaterThan(92);
        expect(metrics.periodMin).toBeLessThan(94);
        expect(metrics.perigeeKm).toBeGreaterThan(380);
        expect(metrics.apogeeKm).toBeLessThan(440);
    });

    it("splits the ground track at the date line", () => {
        const segments = groundTrack(iss, DATE);
        expect(segments.length).toBeGreaterThan(0);
        for (const segment of segments) {
            for (let index = 1; index < segment.length; index++) {
                expect(Math.abs(segment[index][1] - segment[index - 1][1])).toBeLessThan(180);
            }
        }
    });
});

describe("passes", () => {
    it("finds ISS passes over Zürich, each a few minutes long", () => {
        const passes = predictPasses(iss, ZURICH, DATE, 48, 10);
        expect(passes.length).toBeGreaterThan(2);
        for (const pass of passes) {
            const minutes = (pass.set.getTime() - pass.rise.getTime()) / 60_000;
            expect(minutes).toBeGreaterThan(0);
            expect(minutes).toBeLessThan(13);
            expect(pass.peakElevation).toBeGreaterThanOrEqual(0);
            expect(pass.peak.getTime()).toBeGreaterThanOrEqual(pass.rise.getTime());
            if (pass.optical) expect(pass.sunlit && pass.observerSunElevation < -6 && pass.peakElevation >= 10).toBe(true);
        }
    });

    it("finds no rise and set for a geostationary satellite", () => {
        expect(predictPasses(geo, ZURICH, DATE)).toEqual([]);
    });

    it("rates visibility only above the horizon", () => {
        const look = lookAt(iss, ZURICH, DATE)!;
        const rating = visibilityRating(look, "station");
        if (look.elevation <= 0) expect(rating.label).toBe("BELOW HORIZON");
        else expect(rating.score).toBeGreaterThan(0);
        expect(visibilityRating(null, "station").label).toBe("LOCATION REQUIRED");
    });
});

describe("sun", () => {
    it("is high over Zürich at midsummer noon and below the horizon at midnight", () => {
        expect(sunElevation(ZURICH, new Date("2026-06-21T11:30:00Z"))).toBeGreaterThan(60);
        expect(sunElevation(ZURICH, new Date("2026-06-21T23:30:00Z"))).toBeLessThan(-10);
    });

    it("puts a satellite behind the Earth into its shadow", () => {
        // Um Mitternacht UTC zur Tagundnachtgleiche liegt die Sonne etwa in Richtung +x.
        const date = new Date("2026-03-20T12:00:00Z");
        expect(isSunlit({ x: 7000, y: 0, z: 0 }, date)).toBe(true);
        expect(isSunlit({ x: -7000, y: 0, z: 0 }, date)).toBe(false);
        expect(isSunlit({ x: -7000, y: 0, z: 9000 }, date)).toBe(true);
    });
});

describe("share links", () => {
    it("round-trips satellite, groups and location", () => {
        const query = buildShareQuery({ norad: 25544, groups: ["STATIONS", "STARLINK"], observer: { latitude: 47.37691, longitude: 8.54171, altitudeKm: 0, label: "Zürich" } });
        expect(query).toBe("sat=25544&g=STATIONS%2CSTARLINK&lat=47.3769&lon=8.5417&place=Z%C3%BCrich");
        const state = readUrlState(`?${query}`);
        expect(state.norad).toBe(25544);
        expect(state.groups).toEqual(["STATIONS", "STARLINK"]);
        expect(state.observer).toMatchObject({ latitude: 47.3769, longitude: 8.5417, label: "Zürich" });
    });

    it("ignores unknown groups and invalid coordinates", () => {
        const state = readUrlState("?sat=abc&g=NOAA,GPS-OPS&lat=123&lon=8");
        expect(state.norad).toBeUndefined();
        expect(state.groups).toEqual(["GPS-OPS"]);
        expect(state.observer).toBeUndefined();
    });
});
