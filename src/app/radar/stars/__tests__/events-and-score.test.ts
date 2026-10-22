import { describe, expect, it } from "vitest";
import { nightFor } from "../astro";
import { requiredKp, upcomingEvents } from "../events";
import { nightScore, type SkyWeather } from "../score";
import { lookAt } from "../aircraft";

const ZURICH = { lat: 47.3769, lon: 8.5417 };
const START = new Date("2026-10-22T12:00:00Z");

describe("upcoming events", () => {
    const events = upcomingEvents(START, ZURICH, [], null, 45);

    it("lists the next full moon and sorts by time", () => {
        const fullMoon = events.find((event) => event.title === "Full moon");
        expect(fullMoon).toBeDefined();
        // Vollmond am 26. Oktober 2026
        expect(fullMoon!.time.toISOString().slice(0, 10)).toBe("2026-10-26");
        const times = events.map((event) => event.time.getTime());
        expect([...times].sort((a, b) => a - b)).toEqual(times);
    });

    it("includes the Leonids and Geminids within 45 days, not the Perseids", () => {
        const titles = events.map((event) => event.title);
        expect(titles).toContain("Leonids peak");
        expect(titles).not.toContain("Perseids peak");
    });

    it("needs about Kp 7 for aurora in Zürich and Kp 1 in Tromsø", () => {
        expect(requiredKp(47.4)).toBe(7);
        expect(requiredKp(69.6)).toBe(1);
    });
});

describe("night score", () => {
    const night = nightFor(START, ZURICH);
    const hours = Array.from({ length: 36 }, (_, i) => START.getTime() + i * 3_600_000);
    const weather = (cloud: number): SkyWeather => ({
        timezone: "Europe/Zurich",
        hourly: { time: hours, cloud: hours.map(() => cloud), low: hours.map(() => cloud), mid: hours.map(() => 0), high: hours.map(() => 0), visibility: hours.map(() => 30000), humidity: hours.map(() => 60) },
    });

    it("rates a clear night higher than an overcast one", () => {
        const clear = nightScore(weather(0), ZURICH, night, 4);
        const overcast = nightScore(weather(100), ZURICH, night, 4);
        expect(clear!.peak).toBeGreaterThan(50);
        expect(overcast!.peak).toBe(0);
        expect(overcast!.label).toBe("Poor");
        expect(clear!.best).not.toBeNull();
    });

    it("penalises light pollution", () => {
        const dark = nightScore(weather(0), ZURICH, night, 1)!.peak;
        const city = nightScore(weather(0), ZURICH, night, 9)!.peak;
        expect(city).toBeLessThan(dark * 0.6);
    });
});

describe("aircraft geometry", () => {
    it("puts an aircraft 10 km north at 10 km height about 45° high in the north", () => {
        const look = lookAt(ZURICH, ZURICH.lat + 10 / 111.2, ZURICH.lon, 10_400, 400);
        expect(look.altitude).toBeGreaterThan(43);
        expect(look.altitude).toBeLessThan(46);
        expect(look.azimuth < 1 || look.azimuth > 359).toBe(true);
    });
});
