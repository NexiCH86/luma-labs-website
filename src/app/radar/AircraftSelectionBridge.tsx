"use client";

import { useEffect } from "react";

type SelectAircraftDetail = {
    icao24?: string;
    latitude?: number;
    longitude?: number;
};

declare global {
    interface Window {
        __lumaRadarMap?: any;
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

            let bestLayer: any = null;
            let bestScore = 0.02 * 0.02;

            map.eachLayer((layer: any) => {
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

            if (bestLayer) {
                window.setTimeout(() => {
                    bestLayer.fire?.("click");
                }, 180);
            }
        };

        window.addEventListener("luma:aircraft-select", onSelect);
        return () => window.removeEventListener("luma:aircraft-select", onSelect);
    }, []);

    return null;
}
