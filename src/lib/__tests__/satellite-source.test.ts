import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { json2satrec, propagate, twoline2satrec } from "satellite.js";
import {
    buildSatelliteResponse,
    FRESH_MS,
    loadGroup,
    parseOmmJson,
    parseTle,
    SOURCE_DEFINITIONS,
    STALE_AFTER_MS,
    type GroupCacheEntry,
    type GroupStatus,
    type OmmRecord,
    type SatelliteStore,
} from "../satellite-source";

// ISS-Bahndaten (OMM) von CelesTrak, Epoche 21.10.2026
const issOmm = JSON.parse(readFileSync(path.join(__dirname, "../../app/radar/stars/__tests__/iss-omm.json"), "utf8")) as OmmRecord;
const OMM_JSON = JSON.stringify([issOmm]);

// ISS-TLE aus der satellite.js-Dokumentation
const ISS_TLE = [
    "ISS (ZARYA)",
    "1 25544U 98067A   19156.50900463  .00003075  00000-0  59442-4 0  9992",
    "2 25544  51.6433  59.2583 0008217  16.4489 347.6017 15.51174618173442",
].join("\n");

const NOW = Date.parse("2026-10-22T18:00:00Z");

type Reply = { status: number; body: string } | Error;

/* Fake-CelesTrak: Antwort je nach Format in der URL. */
function fakeFetch(replies: { json?: Reply; tle?: Reply; supplemental?: Reply }) {
    const calls: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        const reply = url.includes("sup-gp") ? replies.supplemental : url.includes("FORMAT=TLE") ? replies.tle : replies.json;
        if (!reply) return new Response("Not found", { status: 404 });
        if (reply instanceof Error) throw reply;
        return new Response(reply.body, { status: reply.status });
    }) as typeof fetch;
    return { fetcher, calls };
}

function memoryStore(initial?: GroupCacheEntry, lockFree = true) {
    const entries = new Map<string, GroupCacheEntry>();
    const statuses = new Map<string, GroupStatus>();
    if (initial) entries.set(initial.group, initial);
    const store: SatelliteStore = {
        read: async (group) => entries.get(group) ?? null,
        write: async (entry) => void entries.set(entry.group, entry),
        lock: async () => lockFree,
        readStatus: async (group) => statuses.get(group) ?? null,
        writeStatus: async (group, status) => void statuses.set(group, status),
    };
    return { store, entries, statuses };
}

describe("parsers", () => {
    it("reads CelesTrak OMM JSON", () => {
        const records = parseOmmJson(OMM_JSON);
        expect(records).toHaveLength(1);
        expect(records[0].NORAD_CAT_ID).toBe(25544);
    });

    it("rejects CelesTrak text answers instead of crashing", () => {
        expect(() => parseOmmJson("Invalid query: \"GROUP=NOAA\"")).toThrow(/not JSON/);
        expect(() => parseOmmJson("")).toThrow(/empty/);
    });

    it("turns a TLE into an OMM record that propagates like the TLE itself", () => {
        const [record] = parseTle(ISS_TLE);
        expect(record.OBJECT_NAME).toBe("ISS (ZARYA)");
        expect(record.OBJECT_ID).toBe("1998-067A");
        expect(record.NORAD_CAT_ID).toBe(25544);

        const lines = ISS_TLE.split("\n");
        const fromTle = twoline2satrec(lines[1], lines[2]);
        const fromOmm = json2satrec(record as Parameters<typeof json2satrec>[0]);
        const date = new Date("2019-06-05T14:00:00Z");
        const a = propagate(fromTle, date)!.position as { x: number; y: number; z: number };
        const b = propagate(fromOmm, date)!.position as { x: number; y: number; z: number };
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.1); // km
    });

    it("reads two-line TLE files without name lines", () => {
        const twoLine = ISS_TLE.split("\n").slice(1).join("\n");
        const records = parseTle(twoLine);
        expect(records).toHaveLength(1);
        expect(records[0].OBJECT_NAME).toBe("NORAD 25544");
    });
});

describe("loadGroup", () => {
    const stations = SOURCE_DEFINITIONS.STATIONS;

    it("loads JSON live and stores it for the next requests", async () => {
        const { fetcher } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const { store, entries, statuses } = memoryStore();
        const result = await loadGroup(stations, { store, fetcher, now: NOW });
        expect(result.origin).toBe("live");
        expect(result.records[0].groupLabel).toBe("Space Stations");
        expect(entries.get("STATIONS")?.fetchedAt).toBe(NOW);
        expect(statuses.get("STATIONS")).toMatchObject({ count: 1, lastError: null, format: "OMM" });
    });

    it("does not ask CelesTrak again within two hours", async () => {
        const { fetcher, calls } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const { store } = memoryStore({ group: "STATIONS", fetchedAt: NOW - FRESH_MS / 2, format: "OMM", records: [issOmm] });
        const result = await loadGroup(stations, { store, fetcher, now: NOW });
        expect(result.origin).toBe("cache");
        expect(calls).toHaveLength(0);
    });

    it("falls back to TLE when JSON is blocked with 403", async () => {
        const { fetcher } = fakeFetch({ json: { status: 403, body: "Forbidden" }, tle: { status: 200, body: ISS_TLE } });
        const result = await loadGroup(stations, { store: null, fetcher, now: NOW });
        expect(result.format).toBe("TLE");
        expect(result.records).toHaveLength(1);
    });

    it("uses the Starlink supplemental data as third source", async () => {
        const { fetcher, calls } = fakeFetch({ json: { status: 403, body: "" }, tle: { status: 403, body: "" }, supplemental: { status: 200, body: OMM_JSON } });
        const result = await loadGroup(SOURCE_DEFINITIONS.STARLINK, { store: null, fetcher, now: NOW });
        expect(result.records).toHaveLength(1);
        expect(calls.at(-1)).toContain("sup-gp.php?FILE=starlink");
    });

    it("serves the last known data when CelesTrak fails, and marks old data as stale", async () => {
        const { fetcher } = fakeFetch({ json: new Error("timeout"), tle: { status: 503, body: "" } });
        const { store, statuses } = memoryStore({ group: "STATIONS", fetchedAt: NOW - STALE_AFTER_MS - 1, format: "OMM", records: [issOmm] });
        const result = await loadGroup(stations, { store, fetcher, now: NOW });
        expect(result.origin).toBe("cache");
        expect(result.stale).toBe(true);
        expect(result.warning).toMatch(/STATIONS unavailable/);
        expect(statuses.get("STATIONS")?.lastError).toMatch(/timeout/);
    });

    it("lets another instance refresh while serving the cache", async () => {
        const { fetcher, calls } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const { store } = memoryStore({ group: "STATIONS", fetchedAt: NOW - FRESH_MS - 1, format: "OMM", records: [issOmm] }, false);
        const result = await loadGroup(stations, { store, fetcher, now: NOW });
        expect(result.origin).toBe("cache");
        expect(calls).toHaveLength(0);
    });

    it("fails only when there is neither live data nor a cache", async () => {
        const { fetcher } = fakeFetch({ json: { status: 200, body: "Invalid query" }, tle: { status: 200, body: "Invalid query" } });
        await expect(loadGroup(stations, { store: memoryStore().store, fetcher, now: NOW })).rejects.toThrow(/not JSON.*no TLE records/);
    });

    it("keeps working when the store itself is down", async () => {
        const { fetcher } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const broken: SatelliteStore = {
            read: () => Promise.reject(new Error("redis down")),
            write: () => Promise.reject(new Error("redis down")),
            lock: () => Promise.reject(new Error("redis down")),
            readStatus: () => Promise.reject(new Error("redis down")),
            writeStatus: () => Promise.reject(new Error("redis down")),
        };
        const result = await loadGroup(stations, { store: broken, fetcher, now: NOW });
        expect(result.origin).toBe("live");
    });
});

describe("buildSatelliteResponse", () => {
    it("returns the groups that worked and names the ones that failed", async () => {
        const { fetcher } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const ok = await loadGroup(SOURCE_DEFINITIONS.STATIONS, { store: null, fetcher, now: NOW });
        const body = buildSatelliteResponse(["STATIONS", "STARLINK"], [{ status: "fulfilled", value: ok }, { status: "rejected", reason: new Error("CelesTrak STARLINK unavailable") }], NOW);
        expect(body.ok).toBe(true);
        expect(body.count).toBe(1);
        expect(body.failedGroups).toEqual([{ group: "STARLINK", error: "CelesTrak STARLINK unavailable" }]);
        expect(body.dataUpdatedAt).toBe(new Date(NOW).toISOString());
        expect(body.availableGroups.some((group) => group.group === "NOAA")).toBe(false);
    });

    it("is not ok when no group could be loaded", () => {
        const body = buildSatelliteResponse(["STARLINK"], [{ status: "rejected", reason: new Error("down") }], NOW);
        expect(body.ok).toBe(false);
        expect(body.error).toBe("down");
    });

    it("prefers the station entry when an object is in two groups", async () => {
        const { fetcher } = fakeFetch({ json: { status: 200, body: OMM_JSON } });
        const visual = await loadGroup(SOURCE_DEFINITIONS.VISUAL, { store: null, fetcher, now: NOW });
        const stations = await loadGroup(SOURCE_DEFINITIONS.STATIONS, { store: null, fetcher, now: NOW });
        const body = buildSatelliteResponse(["VISUAL", "STATIONS"], [{ status: "fulfilled", value: visual }, { status: "fulfilled", value: stations }], NOW);
        expect(body.count).toBe(1);
        expect(body.satellites[0].category).toBe("station");
    });
});
