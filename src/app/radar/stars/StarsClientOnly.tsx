"use client";

import dynamic from "next/dynamic";

/*
 * Nur im Browser rendern: die Sternkarte ist ein Canvas und liest
 * gespeicherte Einstellungen (localStorage) schon beim Start.
 */
const StarsClient = dynamic(() => import("./StarsClient"), {
    ssr: false,
    loading: () => <main className="stars-workspace" />,
});

export default function StarsClientOnly() {
    return <StarsClient />;
}
