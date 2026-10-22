"use client";

import dynamic from "next/dynamic";

/*
 * Nur im Browser rendern: Karte (Leaflet), Bahnrechnung und
 * gespeicherte Einstellungen (localStorage) brauchen das Fenster.
 */
const SatClient = dynamic(() => import("./SatClient"), {
    ssr: false,
    loading: () => <main className="radar-shell sat-app" />,
});

export default function SatClientOnly() {
    return <SatClient />;
}
