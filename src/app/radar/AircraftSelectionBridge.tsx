"use client";

import type { Layer, Map as LeafletMap, Marker } from "leaflet";
import { useEffect } from "react";

// Flugzeug-Icons sind Marker; andere Layer haben diese Methoden nicht.
type MarkerLikeLayer = Layer & Partial<Pick<Marker, "getElement" | "getLatLng">>;

type SelectAircraftDetail = {
    icao24?: string;
    latitude?: number;
    longitude?: number;
};

declare global {
    interface Window {
        __lumaRadarMap?: LeafletMap;
    }
}

export default function AircraftSelectionBridge() {
    useEffect(() => {
        const onSelect = (event: Event) => {
            const detail = (event as CustomEvent<SelectAircraftDetail>).detail;
            const map = window.__lumaRadarMap;

            if (!map || detail?.latitude == null || detail?.longitude == null) {
                return;
            }

            let bestLayer = null as MarkerLikeLayer | null;
            let bestScore = 0.02 * 0.02;

            map.eachLayer((layer: MarkerLikeLayer) => {
                const element = layer?.getElement?.() as HTMLElement | undefined;
                if (!element?.classList?.contains("plane-icon-wrapper")) return;

                const latLng = layer?.getLatLng?.();
                if (!latLng) return;

                const dy = Number(latLng.lat) - detail.latitude!;
                const dx = Number(latLng.lng) - detail.longitude!;
                const score = dy * dy + dx * dx;

                if (score < bestScore) {
                    bestScore = score;
                    bestLayer = layer;
                }
            });

            map.flyTo?.([detail.latitude, detail.longitude], Math.max(map.getZoom?.() ?? 8, 10), {
                animate: true,
                duration: 0.65,
            });

            const target = bestLayer;
            if (target) {
                window.setTimeout(() => {
                    target.fire?.("click");
                }, 180);
            }
        };

        window.addEventListener("luma:aircraft-select", onSelect);
        return () => window.removeEventListener("luma:aircraft-select", onSelect);
    }, []);

    return null;
}
