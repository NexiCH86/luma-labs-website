"use client";

import { useEffect } from "react";

type Vec3 = { x: number; y: number; z: number };
type SatelliteRuntime = {
    json2satrec?: (record: Record<string, unknown>) => unknown;
    twoline2satrec?: (line1: string, line2: string) => unknown;
    propagate?: (satrec: unknown, date: Date) => { position?: Vec3; velocity?: Vec3 } | null;
};

declare global {
    interface Window {
        satellite?: SatelliteRuntime & Record<string, unknown>;
    }
}

const NUMERIC_FIELDS = [
    "MEAN_MOTION",
    "ECCENTRICITY",
    "INCLINATION",
    "RA_OF_ASC_NODE",
    "ARG_OF_PERICENTER",
    "MEAN_ANOMALY",
    "EPHEMERIS_TYPE",
    "NORAD_CAT_ID",
    "ELEMENT_SET_NO",
    "REV_AT_EPOCH",
    "BSTAR",
    "MEAN_MOTION_DOT",
    "MEAN_MOTION_DDOT",
] as const;

function normalizeOmm(input: Record<string, unknown>) {
    const record: Record<string, unknown> = { ...input };
    for (const field of NUMERIC_FIELDS) {
        const value = record[field];
        if (value == null || value === "") continue;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) record[field] = numeric;
    }
    if (typeof record.EPOCH === "string") record.EPOCH = record.EPOCH.trim().replace(/Z$/, "");
    if (!record.CLASSIFICATION_TYPE) record.CLASSIFICATION_TYPE = "U";
    if (record.EPHEMERIS_TYPE == null) record.EPHEMERIS_TYPE = 0;
    if (record.ELEMENT_SET_NO == null) record.ELEMENT_SET_NO = 0;
    if (record.REV_AT_EPOCH == null) record.REV_AT_EPOCH = 0;
    if (record.BSTAR == null) record.BSTAR = 0;
    if (record.MEAN_MOTION_DOT == null) record.MEAN_MOTION_DOT = 0;
    if (record.MEAN_MOTION_DDOT == null) record.MEAN_MOTION_DDOT = 0;
    return record;
}

function epochField(value: unknown) {
    const date = new Date(String(value ?? ""));
    if (Number.isNaN(date.getTime())) return "00001.00000000";
    const year = String(date.getUTCFullYear() % 100).padStart(2, "0");
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const day = (date.getTime() - start) / 86400000 + 1;
    return `${year}${day.toFixed(8).padStart(12, "0")}`;
}

function exponentField(value: unknown) {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric) || numeric === 0) return " 00000-0";
    const sign = numeric < 0 ? "-" : " ";
    const abs = Math.abs(numeric);
    const exponent = Math.floor(Math.log10(abs)) + 1;
    const mantissa = Math.round((abs / 10 ** exponent) * 1e5);
    const expSign = exponent < 0 ? "-" : "+";
    return `${sign}${String(mantissa).padStart(5, "0").slice(0, 5)}${expSign}${Math.abs(exponent)}`;
}

function buildTle(record: Record<string, unknown>): [string, string] | null {
    const norad = Number(record.NORAD_CAT_ID);
    const inc = Number(record.INCLINATION);
    const raan = Number(record.RA_OF_ASC_NODE);
    const ecc = Number(record.ECCENTRICITY);
    const arg = Number(record.ARG_OF_PERICENTER);
    const anomaly = Number(record.MEAN_ANOMALY);
    const motion = Number(record.MEAN_MOTION);
    if (![norad, inc, raan, ecc, arg, anomaly, motion].every(Number.isFinite)) return null;
    if (norad <= 0 || norad > 99999 || motion <= 0 || ecc < 0 || ecc >= 1) return null;

    const objectId = String(record.OBJECT_ID ?? "").replace(/-/g, "").slice(0, 8).padEnd(8, " ");
    const classification = String(record.CLASSIFICATION_TYPE ?? "U").slice(0, 1) || "U";
    const elementSet = Math.max(0, Math.min(9999, Number(record.ELEMENT_SET_NO ?? 0) || 0));
    const rev = Math.max(0, Math.min(99999, Number(record.REV_AT_EPOCH ?? 0) || 0));
    const mmDot = Number(record.MEAN_MOTION_DOT ?? 0);
    const eccentricity = String(Math.round(Math.abs(ecc) * 1e7)).padStart(7, "0").slice(0, 7);
    const dot = Number.isFinite(mmDot)
        ? `${mmDot < 0 ? "-" : " "}${Math.abs(mmDot).toFixed(8).replace(/^0/, "")}`.slice(0, 10)
        : " .00000000";

    const line1 =
        `1 ${String(Math.trunc(norad)).padStart(5, "0")}${classification} ${objectId} ${epochField(record.EPOCH)} ` +
        `${dot.padStart(10, " ")} ${exponentField(record.MEAN_MOTION_DDOT)} ${exponentField(record.BSTAR)} 0 ${String(elementSet).padStart(4, " ")}`;

    const line2 =
        `2 ${String(Math.trunc(norad)).padStart(5, "0")} ` +
        `${inc.toFixed(4).padStart(8, " ")} ${raan.toFixed(4).padStart(8, " ")} ` +
        `${eccentricity} ${arg.toFixed(4).padStart(8, " ")} ${anomaly.toFixed(4).padStart(8, " ")} ` +
        `${motion.toFixed(8).padStart(11, " ")}${String(rev).padStart(5, "0")}`;

    return [line1, line2];
}

function hasFiniteOrbit(runtime: SatelliteRuntime, satrec: unknown) {
    if (!satrec || !runtime.propagate) return Boolean(satrec);
    try {
        const propagated = runtime.propagate(satrec, new Date());
        const p = propagated?.position;
        return Boolean(
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            Number.isFinite(p.z)
        );
    } catch {
        return false;
    }
}

function patchRuntime(runtime: SatelliteRuntime & Record<string, unknown>) {
    if (!runtime.json2satrec) return runtime;

    const current = runtime.json2satrec as ((record: Record<string, unknown>) => unknown) & {
        __lumaPatched?: boolean;
    };
    if (current.__lumaPatched) return runtime;

    const original = current.bind(runtime);
    const patched = ((input: Record<string, unknown>) => {
        const record = normalizeOmm(input);

        // LuMa fallback records originate from TLE data. Prefer the TLE parser and
        // validate that the result can actually be propagated before accepting it.
        if (runtime.twoline2satrec) {
            const tle = buildTle(record);
            if (tle) {
                try {
                    const satrec = runtime.twoline2satrec(tle[0], tle[1]);
                    if (hasFiniteOrbit(runtime, satrec)) return satrec;
                } catch {
                    // Try OMM below.
                }
            }
        }

        try {
            const satrec = original(record);
            if (hasFiniteOrbit(runtime, satrec)) return satrec;
        } catch {
            // Preserve original error behavior below.
        }

        return original(record);
    }) as typeof current;

    patched.__lumaPatched = true;
    runtime.json2satrec = patched;
    console.info("LuMa SAT orbit adapter active (validated TLE-first propagation)");
    return runtime;
}

export default function SatOrbitAdapter() {
    useEffect(() => {
        let runtimeValue = window.satellite;

        if (runtimeValue) {
            patchRuntime(runtimeValue);
            return;
        }

        const descriptor = Object.getOwnPropertyDescriptor(window, "satellite");
        if (descriptor && descriptor.configurable === false) return;

        try {
            Object.defineProperty(window, "satellite", {
                configurable: true,
                enumerable: true,
                get() {
                    return runtimeValue;
                },
                set(value: SatelliteRuntime & Record<string, unknown>) {
                    runtimeValue = patchRuntime(value);
                },
            });
        } catch {
            // Browser runtime rejected property interception.
        }

        return () => {
            try {
                const current = runtimeValue;
                delete (window as Window & { satellite?: SatelliteRuntime }).satellite;
                if (current) window.satellite = current;
            } catch {
                // Nothing to clean up.
            }
        };
    }, []);

    return null;
}
