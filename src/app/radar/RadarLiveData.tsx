"use client";

import { useEffect } from "react";

export type RadarLiveAircraft = {
    icao24: string;
    callsign: string;
    country?: string;
    longitude: number;
    latitude: number;
    altitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    verticalRate: number | null;
    geoAltitude?: number | null;
    squawk?: string | null;
};

export type RadarLiveSnapshot = {
    count?: number;
    aircraft?: RadarLiveAircraft[];
    updated?: number | null;
    receivedAt?: number | null;
    source?: string;
    status?: string;
};

declare global {
    interface Window {
        __lumaRadarSnapshot?: RadarLiveSnapshot;
        __lumaRadarFetchInstalled?: boolean;
        __lumaRadarOriginalFetch?: typeof window.fetch;
    }
}

const EVENT_NAME = "luma:radar-snapshot";

export default function RadarLiveData() {
    useEffect(() => {
        if (window.__lumaRadarFetchInstalled) return;

        const originalFetch = window.fetch.bind(window);
        window.__lumaRadarOriginalFetch = originalFetch;
        window.__lumaRadarFetchInstalled = true;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            const isRadarSnapshot = normalizePath(url) === "/api/radar";

            if (isRadarSnapshot && window.__lumaRadarSnapshot) {
                return jsonResponse(window.__lumaRadarSnapshot);
            }

            const response = await originalFetch(input, init);
            if (isRadarSnapshot && response.ok) {
                try {
                    const snapshot = (await response.clone().json()) as RadarLiveSnapshot;
                    publish(snapshot);
                } catch {
                    // Leave the live stream untouched when a response cannot be decoded.
                }
            }
            return response;
        };

        let active = true;
        let loading = false;

        async function load() {
            if (loading) return;
            loading = true;
            try {
                const response = await originalFetch("/api/radar", { cache: "no-store" });
                if (!response.ok) return;
                const snapshot = (await response.json()) as RadarLiveSnapshot;
                if (active) publish(snapshot);
            } catch {
                // Consumers keep the last good snapshot.
            } finally {
                loading = false;
            }
        }

        void load();
        const timer = window.setInterval(load, 5000);

        return () => {
            active = false;
            window.clearInterval(timer);
            if (window.__lumaRadarFetchInstalled && window.__lumaRadarOriginalFetch) {
                window.fetch = window.__lumaRadarOriginalFetch;
                delete window.__lumaRadarOriginalFetch;
                delete window.__lumaRadarFetchInstalled;
            }
        };
    }, []);

    return null;
}

function publish(snapshot: RadarLiveSnapshot) {
    window.__lumaRadarSnapshot = snapshot;
    window.dispatchEvent(new CustomEvent<RadarLiveSnapshot>(EVENT_NAME, { detail: snapshot }));
}

function normalizePath(value: string) {
    try {
        return new URL(value, window.location.origin).pathname;
    } catch {
        return value.split("?")[0];
    }
}

function jsonResponse(value: RadarLiveSnapshot) {
    return new Response(JSON.stringify(value), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-LuMa-Radar-Cache": "shared-client-snapshot" },
    });
}
