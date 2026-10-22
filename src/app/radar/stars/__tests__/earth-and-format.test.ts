import { describe, expect, it } from "vitest";
import { earthProjection, normalizeLon, subpoint } from "../earth-view";
import { fromZonedInput, timeLabel, toZonedInput } from "../format";
import { buildShareQuery, readUrlState } from "../settings";
import { zoomAround } from "../projection";

describe("earth projection", () => {
    const view = { zoom: 1, offsetX: 0, offsetY: 0 };

    it("inverts the globe projection", () => {
        const globe = earthProjection("globe", 800, 600, view, { lat: 47, lon: 8 });
        for (const [lat, lon] of [[47.37, 8.54], [35.68, 139.69], [-33.87, 151.21], [0, 60]]) {
            const point = globe.project(lat, lon);
            if (!point.visible) continue;
            const back = globe.invert(point.x, point.y);
            expect(back?.lat).toBeCloseTo(lat, 6);
            expect(back?.lon).toBeCloseTo(lon, 6);
        }
    });

    it("hides the far side of the globe", () => {
        const globe = earthProjection("globe", 800, 600, view, { lat: 0, lon: 0 });
        expect(globe.project(0, 179).visible).toBe(false);
        expect(globe.project(0, 10).visible).toBe(true);
    });

    it("inverts the map projection", () => {
        const map = earthProjection("map", 1000, 600, view, { lat: 0, lon: 0 });
        const point = map.project(-33.87, 151.21);
        const back = map.invert(point.x, point.y);
        expect(back?.lat).toBeCloseTo(-33.87, 6);
        expect(back?.lon).toBeCloseTo(151.21, 6);
    });

    it("places a subpoint west of Greenwich when the object has not culminated there yet", () => {
        // Sternzeit 6h in Greenwich, Objekt bei RA 3h: steht 45° oestlich im Zenit.
        expect(subpoint(3, 20, 6)).toEqual({ lat: 20, lon: -45 });
        expect(normalizeLon(190)).toBe(-170);
    });
});

describe("time zones", () => {
    it("round-trips wall time in Tokyo and across the Swiss DST change", () => {
        for (const [value, zone] of [["2026-10-23T01:30", "Asia/Tokyo"], ["2026-10-25T02:30", "Europe/Zurich"], ["2026-03-29T03:30", "Europe/Zurich"]]) {
            const date = fromZonedInput(value, zone);
            expect(date).not.toBeNull();
            expect(toZonedInput(date as Date, zone)).toBe(value);
        }
    });

    it("labels times in the site's zone and marks the next day", () => {
        const date = new Date("2026-10-22T16:30:00Z");
        expect(timeLabel(date, "Asia/Tokyo")).toBe("01:30");
        expect(timeLabel(date, "Asia/Tokyo", new Date("2026-10-22T10:00:00Z"))).toMatch(/^Fr\.? 01:30$/);
    });
});

describe("share links", () => {
    it("round-trips view, object, time and place", () => {
        const query = buildShareQuery({
            mode: "earth",
            objectId: "dso-M31",
            time: new Date("2026-10-22T21:30:12Z"),
            observer: { lat: 35.6762, lon: 139.6503 },
            observerLabel: "Tokyo",
            earthKind: "map",
        });
        const state = readUrlState(`?${query}`);
        expect(state.mode).toBe("earth");
        expect(state.objectId).toBe("dso-M31");
        expect(state.time?.toISOString()).toBe("2026-10-22T21:30:00.000Z");
        expect(state.observer?.lat).toBeCloseTo(35.6762, 9);
        expect(state.observer?.lon).toBeCloseTo(139.6503, 9);
        expect(state.observerLabel).toBe("Tokyo");
        expect(state.earthKind).toBe("map");
    });

    it("ignores invalid values", () => {
        const state = readUrlState("?v=mars&lat=abc&lon=8&t=never&obj=<script>");
        expect(state).toEqual({});
    });
});

describe("zoom", () => {
    it("keeps the point under the cursor in place", () => {
        const size = { width: 800, height: 600 };
        const before = { zoom: 1, offsetX: 0, offsetY: 0 };
        const after = zoomAround(before, 2, 600, 200, size);
        // Bildschirmpunkt (600, 200) zeigt vorher und nachher auf dieselbe Kartenstelle.
        const mapX = (600 - size.width / 2 - before.offsetX) / before.zoom;
        expect((600 - size.width / 2 - after.offsetX) / after.zoom).toBeCloseTo(mapX, 9);
    });
});
