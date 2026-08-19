"use client";

import { useEffect } from "react";

type MapAirport = {
    i?: string | null;
    a?: string | null;
    n?: string | null;
    y: number;
    x: number;
    t?: string | null;
    s?: boolean;
    c?: string | null;
    k?: string | null;
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

export default function DynamicAirportLayer() {
    useEffect(() => {
        let active = true;
        let layerGroup: any = null;
        let refreshTimer: ReturnType<typeof setTimeout> | null = null;
        const cache = new Map<string, MapAirport[]>();
        let cleanupMapListeners: (() => void) | null = null;

        async function setup() {
            const L = await import("leaflet");

            const waitForMap = async () => {
                for (let attempt = 0; attempt < 80 && active; attempt++) {
                    const map = window.__lumaRadarMap;
                    if (map) {
                        layerGroup = L.layerGroup().addTo(map);

                        const scheduleRefresh = () => {
                            if (refreshTimer) clearTimeout(refreshTimer);
                            refreshTimer = setTimeout(() => refresh(map, L), 120);
                        };

                        map.on("moveend", scheduleRefresh);
                        map.on("zoomend", scheduleRefresh);
                        cleanupMapListeners = () => {
                            map.off("moveend", scheduleRefresh);
                            map.off("zoomend", scheduleRefresh);
                        };

                        await refresh(map, L);
                        return;
                    }

                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
            };

            await waitForMap();
        }

        async function fetchJson(url: string) {
            if (cache.has(url)) return cache.get(url)!;

            try {
                const response = await fetch(url, { cache: "force-cache" });
                if (!response.ok) return [];
                const data = (await response.json()) as MapAirport[];
                cache.set(url, data);
                return data;
            } catch {
                return [];
            }
        }

        async function refresh(map: any, L: typeof import("leaflet")) {
            if (!active || !layerGroup) return;

            const zoom = map.getZoom();
            const bounds = map.getBounds();
            let airports: MapAirport[] = [];

            if (zoom <= 5) {
                airports = await fetchJson("/data/ourairports/map/major.json");
            } else if (zoom <= 8) {
                const urls = tileUrls(bounds, 20, "regional");
                const sets = await Promise.all(urls.map(fetchJson));
                airports = sets.flat();
            } else {
                const urls = tileUrls(bounds, 5, "local");
                const sets = await Promise.all(urls.map(fetchJson));
                airports = sets.flat();
            }

            if (!active) return;

            const filtered = airports
                .filter((airport) =>
                    Number.isFinite(airport.y) &&
                    Number.isFinite(airport.x) &&
                    bounds.contains([airport.y, airport.x])
                )
                .filter((airport) => visibleForZoom(airport, zoom))
                .sort((a, b) => airportPriority(a) - airportPriority(b))
                .slice(0, markerLimit(zoom));

            layerGroup.clearLayers();

            for (const airport of filtered) {
                const code = airport.a ?? airport.i ?? "APT";
                const icon = L.divIcon({
                    className: "luma-world-airport-wrapper",
                    html: airportIconHtml(code, airport, zoom),
                    iconSize: zoom >= 9 ? [92, 28] : [62, 22],
                    iconAnchor: [7, 11],
                });

                const marker = L.marker([airport.y, airport.x], {
                    icon,
                    interactive: true,
                    keyboard: false,
                    zIndexOffset: -100,
                });

                marker.bindTooltip(
                    [code, airport.n, airport.c, airport.k]
                        .filter(Boolean)
                        .join(" · "),
                    {
                        direction: "top",
                        offset: [0, -7],
                    }
                );

                marker.on("click", () => {
                    const lookupCode = airport.a ?? airport.i;
                    if (!lookupCode) return;

                    window.dispatchEvent(
                        new CustomEvent("luma:airport-layer-select", {
                            detail: {
                                code: lookupCode,
                            },
                        })
                    );
                });

                marker.addTo(layerGroup);
            }
        }

        setup();

        return () => {
            active = false;
            if (refreshTimer) clearTimeout(refreshTimer);
            cleanupMapListeners?.();
            layerGroup?.remove();
        };
    }, []);

    return null;
}

function tileUrls(bounds: any, size: number, folder: string) {
    const south = Math.max(-90, bounds.getSouth());
    const north = Math.min(89.999999, bounds.getNorth());
    const west = normalizeLongitude(bounds.getWest());
    const east = normalizeLongitude(bounds.getEast());

    const lonRanges = west <= east
        ? [[west, east]]
        : [[west, 179.999999], [-180, east]];

    const urls = new Set<string>();

    for (let lat = Math.floor((south + 90) / size); lat <= Math.floor((north + 90) / size); lat++) {
        for (const [rangeWest, rangeEast] of lonRanges) {
            for (
                let lon = Math.floor((rangeWest + 180) / size);
                lon <= Math.floor((rangeEast + 180) / size);
                lon++
            ) {
                urls.add(`/data/ourairports/map/${folder}/${lat}_${lon}.json`);
            }
        }
    }

    return [...urls];
}

function normalizeLongitude(value: number) {
    let result = value;
    while (result < -180) result += 360;
    while (result >= 180) result -= 360;
    return result;
}

function visibleForZoom(airport: MapAirport, zoom: number) {
    if (zoom <= 5) return airport.t === "large_airport";
    if (zoom <= 7) {
        return airport.t === "large_airport" ||
            (airport.t === "medium_airport" && airport.s);
    }
    if (zoom <= 9) {
        return airport.t === "large_airport" ||
            airport.t === "medium_airport" ||
            Boolean(airport.s);
    }
    if (zoom <= 11) {
        return airport.t !== "heliport" && airport.t !== "seaplane_base";
    }
    return true;
}

function airportPriority(airport: MapAirport) {
    if (airport.t === "large_airport") return 0;
    if (airport.t === "medium_airport" && airport.s) return 1;
    if (airport.t === "medium_airport") return 2;
    if (airport.s) return 3;
    if (airport.t === "small_airport") return 4;
    return 5;
}

function markerLimit(zoom: number) {
    if (zoom <= 5) return 350;
    if (zoom <= 7) return 450;
    if (zoom <= 9) return 650;
    if (zoom <= 11) return 850;
    return 1100;
}

function airportIconHtml(code: string, airport: MapAirport, zoom: number) {
    const safeCode = escapeHtml(code);
    const typeClass = airport.t === "large_airport"
        ? "major"
        : airport.t === "medium_airport"
            ? "regional"
            : "local";

    if (zoom <= 7) {
        return `<div class="luma-world-airport ${typeClass}"><span></span><strong>${safeCode}</strong></div>`;
    }

    const name = zoom >= 10 && airport.n
        ? `<small>${escapeHtml(airport.n)}</small>`
        : "";

    return `<div class="luma-world-airport ${typeClass}"><span></span><div><strong>${safeCode}</strong>${name}</div></div>`;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
