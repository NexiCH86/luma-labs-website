import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { json2satrec } from "satellite.js";
import { groundTrack, predictPasses, satelliteState, type SatelliteEntry } from "../satellites";

// ISS-Bahndaten (OMM) von CelesTrak, Epoche 21.10.2026
const omm = JSON.parse(readFileSync(path.join(__dirname, "iss-omm.json"), "utf8"));
const iss: SatelliteEntry = { id: "sat-25544", norad: 25544, name: "ISS (ZARYA)", category: "station", satrec: json2satrec(omm) };
const ZURICH = { lat: 47.3769, lon: 8.5417 };
const DATE = new Date("2026-10-22T18:00:00Z");

describe("ISS", () => {
    it("flies about 420 km high at about 27'600 km/h", () => {
        const state = satelliteState(iss, DATE, ZURICH);
        expect(state).not.toBeNull();
        expect(state!.heightKm).toBeGreaterThan(380);
        expect(state!.heightKm).toBeLessThan(440);
        expect(state!.speedKms * 3600).toBeGreaterThan(27_000);
        expect(state!.speedKms * 3600).toBeLessThan(28_200);
        expect(Math.abs(state!.lat)).toBeLessThan(52);
    });

    it("finds several passes over Zürich in three days, each a few minutes long", () => {
        const passes = predictPasses(iss, DATE, ZURICH, () => -20, 72);
        expect(passes.length).toBeGreaterThan(3);
        for (const pass of passes) {
            const minutes = (pass.set.getTime() - pass.rise.getTime()) / 60_000;
            expect(minutes).toBeGreaterThan(0.4);
            expect(minutes).toBeLessThan(12);
            expect(pass.peakAltitude).toBeGreaterThanOrEqual(10);
        }
    });

    it("draws a ground track that covers a full orbit in 92 minutes", () => {
        const track = groundTrack(iss, DATE, 46, 46, 1);
        expect(track.length).toBe(93);
        const longitudes = new Set(track.map((point) => Math.round(point.lon / 30)));
        expect(longitudes.size).toBeGreaterThan(10);
    });
});
