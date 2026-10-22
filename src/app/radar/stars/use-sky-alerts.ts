"use client";

import { useEffect, useRef, useState } from "react";
import { type SkyEvent } from "./events";

/*
 * Browser-Benachrichtigungen fuer Ereignisse (wie die Squawk-Alerts im
 * AIR-Modus): solange die Seite offen ist, wird jedes Ereignis mit
 * notify einmal gemeldet, sobald es weniger als 15 Minuten entfernt ist.
 * Bereits gemeldete IDs liegen im localStorage.
 */
const ALERTS_KEY = "luma-radar-stars-alerts-v1";
const NOTIFIED_KEY = "luma-radar-stars-notified-v1";
const LEAD_MS = 15 * 60_000;

function readFlag() {
    try {
        return window.localStorage.getItem(ALERTS_KEY) === "1" && "Notification" in window && Notification.permission === "granted";
    } catch {
        return false;
    }
}

export function useSkyAlerts(events: SkyEvent[]) {
    const [enabled, setEnabled] = useState(readFlag);
    const [status, setStatus] = useState("");
    const eventsRef = useRef(events);

    useEffect(() => {
        eventsRef.current = events;
    }, [events]);

    useEffect(() => {
        if (!enabled) return;
        const check = () => {
            let notified: string[] = [];
            try {
                notified = JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) ?? "[]") as string[];
            } catch {
                notified = [];
            }
            const now = Date.now();
            for (const event of eventsRef.current) {
                if (!event.notify || notified.includes(event.id)) continue;
                const lead = event.time.getTime() - now;
                if (lead > LEAD_MS || lead < -LEAD_MS) continue;
                try {
                    new Notification(`LuMa STARS · ${event.title}`, { body: event.detail, tag: event.id, icon: "/favicon.ico" });
                } catch {
                    // Manche Browser erlauben Notification nur im Service Worker.
                }
                notified.push(event.id);
            }
            try {
                window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified.slice(-200)));
            } catch {
                // optional
            }
        };
        check();
        const timer = window.setInterval(check, 60_000);
        return () => window.clearInterval(timer);
    }, [enabled]);

    async function toggle() {
        if (enabled) {
            setEnabled(false);
            setStatus("");
            try { window.localStorage.setItem(ALERTS_KEY, "0"); } catch { /* optional */ }
            return;
        }
        if (!("Notification" in window)) {
            setStatus("This browser does not support notifications.");
            return;
        }
        const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
        if (permission !== "granted") {
            setStatus("Notifications are blocked for this site.");
            return;
        }
        setEnabled(true);
        setStatus("You will be alerted 15 minutes ahead while this page is open.");
        try { window.localStorage.setItem(ALERTS_KEY, "1"); } catch { /* optional */ }
    }

    return { enabled, status, toggle };
}
