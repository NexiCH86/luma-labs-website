"use client";

import { useLayoutEffect } from "react";

declare global {
    interface Window {
        __lumaRadarMap?: any;
    }
}

type AirportFocusDetail = {
    latitude: number;
    longitude: number;
    code?: string | null;
    name?: string | null;
};

export default function RadarMapBridge() {
    useLayoutEffect(() => {
        let active = true;
        let focusMarker: any = null;
        let cleanupListener:
            | (() => void)
            | null = null;

        async function setup() {
            const L = await import("leaflet");

            if (!active) {
                return;
            }

            L.Map.addInitHook(function () {
                const container =
                    this.getContainer?.();

                if (
                    container?.classList?.contains(
                        "radar-map"
                    )
                ) {
                    window.__lumaRadarMap =
                        this;
                }
            });

            const onAirportFocus = (
                event: Event
            ) => {
                const detail =
                    (
                        event as CustomEvent<AirportFocusDetail>
                    ).detail;

                const map =
                    window.__lumaRadarMap;

                if (
                    !map ||
                    !detail ||
                    !Number.isFinite(
                        detail.latitude
                    ) ||
                    !Number.isFinite(
                        detail.longitude
                    )
                ) {
                    return;
                }

                const code =
                    detail.code ??
                    "AIRPORT";

                const name =
                    detail.name ??
                    "Airport";

                map.flyTo(
                    [
                        detail.latitude,
                        detail.longitude,
                    ],
                    10,
                    {
                        duration: 1.45,
                    }
                );

                focusMarker?.remove();

                const icon =
                    L.divIcon({
                        className:
                            "route-airport-wrapper",
                        html: `
                            <div class="route-airport-marker luma-focus-airport-marker">
                                <span></span>
                                <strong>${escapeHtml(
                                    code
                                )}</strong>
                            </div>
                        `,
                        iconSize: [72, 30],
                        iconAnchor: [10, 15],
                    });

                focusMarker =
                    L.marker(
                        [
                            detail.latitude,
                            detail.longitude,
                        ],
                        {
                            icon,
                            zIndexOffset: 1200,
                        }
                    )
                        .addTo(map)
                        .bindTooltip(
                            `${code} · ${name}`,
                            {
                                direction:
                                    "top",
                                offset: [
                                    0,
                                    -10,
                                ],
                            }
                        );
            };

            window.addEventListener(
                "luma:airport-focus",
                onAirportFocus
            );

            cleanupListener = () => {
                window.removeEventListener(
                    "luma:airport-focus",
                    onAirportFocus
                );
            };
        }

        setup();

        return () => {
            active = false;
            cleanupListener?.();
            focusMarker?.remove();

            if (
                window.__lumaRadarMap
            ) {
                delete window.__lumaRadarMap;
            }
        };
    }, []);

    return null;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
