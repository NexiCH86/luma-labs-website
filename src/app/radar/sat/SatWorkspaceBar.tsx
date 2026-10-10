"use client";

import { useEffect, useState } from "react";

const WATCH_KEY = "luma-radar-sat-watchlist";

function watchCount() {
    try {
        const parsed = JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]") as unknown[];
        return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
        return 0;
    }
}

export default function SatWorkspaceBar() {
    const [now, setNow] = useState<Date | null>(null);
    const [timeZone, setTimeZone] = useState("");
    const [markers, setMarkers] = useState(true);
    const [orbits, setOrbits] = useState(true);
    const [watch, setWatch] = useState(0);

    useEffect(() => {
        setNow(new Date());
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        setWatch(watchCount());

        const timer = window.setInterval(() => setNow(new Date()), 1000);
        const onWatch = () => setWatch(watchCount());
        window.addEventListener("luma-sat-watchlist-change", onWatch);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("luma-sat-watchlist-change", onWatch);
        };
    }, []);

    function toggleMarkers() {
        const next = !markers;
        setMarkers(next);
        document.documentElement.classList.toggle("sat4-hide-markers", !next);
    }

    function toggleOrbits() {
        const next = !orbits;
        setOrbits(next);
        document.documentElement.classList.toggle("sat4-hide-orbits", !next);
    }

    function resetWorkspace() {
        [
            "luma-radar-sat-details-position",
            "luma-radar-sat-tracked-panel-position",
            "luma-radar-sat-v1-panel-position",
            "luma-radar-sat-phase3-position",
            "luma-radar-sat-network-position",
            "luma-radar-sat-final-center-position",
        ].forEach((key) => localStorage.removeItem(key));
        window.location.reload();
    }

    const localTime = now ? now.toLocaleTimeString("de-CH") : "--:--:--";
    const utcTime = now ? now.toLocaleTimeString("de-CH", { timeZone: "UTC" }) : "--:--:--";

    return (
        <div className="sat4-workspace-bar">
            <div className="sat4-workspace-section sat4-clock">
                <small>LOCAL</small>
                <b>{localTime}</b>
                <span>{timeZone || "LOCAL"}</span>
            </div>
            <div className="sat4-workspace-section sat4-clock">
                <small>UTC</small>
                <b>{utcTime}</b>
            </div>
            <button className={markers ? "is-on" : ""} onClick={toggleMarkers}><span /> MARKERS</button>
            <button className={orbits ? "is-on" : ""} onClick={toggleOrbits}><span /> ORBIT TRAIL</button>
            <div className="sat4-watch-count">★ <b>{watch}</b> WATCHED</div>
            <button className="sat4-reset" onClick={resetWorkspace}>RESET PANELS</button>
        </div>
    );
}
