"use client";

import { useEffect } from "react";

type Runway = {
    id?: string | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    surface?: string | null;
    lighted?: boolean;
    leIdent?: string | null;
    leHeading?: number | null;
    leLatitude?: number | null;
    leLongitude?: number | null;
    heIdent?: string | null;
    heHeading?: number | null;
    heLatitude?: number | null;
    heLongitude?: number | null;
};

type AirportResponse = {
    found: boolean;
    icao?: string | null;
    iata?: string | null;
    name?: string | null;
    latitude?: number;
    longitude?: number;
    runways?: Runway[];
};

type FocusDetail = {
    code?: string | null;
    latitude?: number;
    longitude?: number;
    name?: string | null;
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

export default function AirportRunwayLayer() {
    useEffect(() => {
        let active = true;
        let group: any = null;

        async function onFocus(event: Event) {
            const detail = (event as CustomEvent<FocusDetail>).detail;
            const code = detail?.code?.trim().toUpperCase();
            if (!code || !/^[A-Z0-9]{3,4}$/.test(code)) return;

            const map = window.__lumaRadarMap;
            if (!map) return;

            const L = await import("leaflet");
            if (!active) return;

            group?.remove();
            group = L.layerGroup().addTo(map);

            try {
                const response = await fetch(`/api/radar/airport?code=${encodeURIComponent(code)}`, { cache: "no-store" });
                if (!response.ok) return;
                const airport = (await response.json()) as AirportResponse;
                if (!airport.found || !Array.isArray(airport.runways)) return;

                const drawable = airport.runways.filter(hasEndpoints);

                for (const runway of drawable) {
                    const line = L.polyline(
                        [
                            [runway.leLatitude!, runway.leLongitude!],
                            [runway.heLatitude!, runway.heLongitude!],
                        ],
                        {
                            color: "#f4f7fb",
                            weight: runwayWeight(runway.widthFt),
                            opacity: 0.82,
                            lineCap: "butt",
                            interactive: true,
                        }
                    );

                    const designation = [runway.leIdent, runway.heIdent].filter(Boolean).join(" / ") || "RUNWAY";
                    const details = [
                        runway.lengthFt != null ? `${Math.round(runway.lengthFt).toLocaleString("de-CH")} ft` : null,
                        runway.surface,
                        runway.lighted ? "LIGHTED" : null,
                    ].filter(Boolean).join(" · ");

                    line.bindTooltip(`${designation}${details ? ` · ${details}` : ""}`, {
                        sticky: true,
                        direction: "top",
                        opacity: 0.94,
                    });
                    line.addTo(group);

                    addThresholdLabel(L, group, runway.leLatitude!, runway.leLongitude!, runway.leIdent);
                    addThresholdLabel(L, group, runway.heLatitude!, runway.heLongitude!, runway.heIdent);
                }

                if (drawable.length > 0) {
                    const bounds = L.latLngBounds(
                        drawable.flatMap((runway) => [
                            [runway.leLatitude!, runway.leLongitude!] as [number, number],
                            [runway.heLatitude!, runway.heLongitude!] as [number, number],
                        ])
                    );
                    map.flyToBounds(bounds.pad(0.55), { maxZoom: 14, duration: 1.15 });
                } else if (airport.latitude != null && airport.longitude != null) {
                    map.flyTo([airport.latitude, airport.longitude], Math.max(map.getZoom(), 11), { duration: 1.05 });
                }
            } catch {
                // Keep the normal airport focus behavior if operations data cannot be loaded.
            }
        }

        window.addEventListener("luma:airport-focus", onFocus);
        return () => {
            active = false;
            window.removeEventListener("luma:airport-focus", onFocus);
            group?.remove();
        };
    }, []);

    return null;
}

function hasEndpoints(runway: Runway) {
    return [runway.leLatitude, runway.leLongitude, runway.heLatitude, runway.heLongitude].every(
        (value) => typeof value === "number" && Number.isFinite(value)
    );
}

function runwayWeight(widthFt?: number | null) {
    if (widthFt == null) return 5;
    if (widthFt >= 180) return 9;
    if (widthFt >= 140) return 7;
    if (widthFt >= 100) return 6;
    return 4;
}

function addThresholdLabel(L: any, group: any, latitude: number, longitude: number, ident?: string | null) {
    if (!ident) return;

    const marker = L.marker([latitude, longitude], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
            className: "luma-runway-label-wrapper",
            html: `<div class="luma-runway-label">${escapeHtml(ident)}</div>`,
            iconSize: [34, 18],
            iconAnchor: [17, 9],
        }),
        zIndexOffset: 1200,
    });

    marker.addTo(group);
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
