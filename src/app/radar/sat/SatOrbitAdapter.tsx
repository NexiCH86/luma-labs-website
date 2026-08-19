"use client";

import { useEffect } from "react";

type SatelliteRuntime = {
    json2satrec?: (record: Record<string, unknown>) => unknown;
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

    if (typeof record.EPOCH === "string") {
        // satellite.js 6 accepts ISO OMM epochs; stripping a trailing Z also
        // keeps compatibility with older/minified builds that are cached by browsers.
        record.EPOCH = record.EPOCH.trim().replace(/Z$/, "");
    }

    if (!record.CLASSIFICATION_TYPE) record.CLASSIFICATION_TYPE = "U";
    if (record.EPHEMERIS_TYPE == null) record.EPHEMERIS_TYPE = 0;
    if (record.ELEMENT_SET_NO == null) record.ELEMENT_SET_NO = 0;
    if (record.REV_AT_EPOCH == null) record.REV_AT_EPOCH = 0;
    if (record.BSTAR == null) record.BSTAR = 0;
    if (record.MEAN_MOTION_DOT == null) record.MEAN_MOTION_DOT = 0;
    if (record.MEAN_MOTION_DDOT == null) record.MEAN_MOTION_DDOT = 0;

    return record;
}

export default function SatOrbitAdapter() {
    useEffect(() => {
        let disposed = false;
        let timer: number | null = null;

        const patch = () => {
            if (disposed) return true;
            const runtime = window.satellite;
            if (!runtime?.json2satrec) return false;

            const current = runtime.json2satrec as ((record: Record<string, unknown>) => unknown) & {
                __lumaPatched?: boolean;
            };
            if (current.__lumaPatched) return true;

            const original = current.bind(runtime);
            const patched = ((record: Record<string, unknown>) => {
                return original(normalizeOmm(record));
            }) as typeof current;
            patched.__lumaPatched = true;
            runtime.json2satrec = patched;

            console.info("LuMa SAT orbit adapter active");
            return true;
        };

        if (!patch()) {
            timer = window.setInterval(() => {
                if (patch() && timer != null) {
                    window.clearInterval(timer);
                    timer = null;
                }
            }, 20);
        }

        return () => {
            disposed = true;
            if (timer != null) window.clearInterval(timer);
        };
    }, []);

    return null;
}
