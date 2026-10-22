"use client";

import { useEffect, useState } from "react";

/*
 * Beobachtungsliste: gemerkte Objekte, als gesehen abhakbar.
 * Liegt im Browser (localStorage), wie die uebrigen Einstellungen.
 */
export type WatchEntry = { id: string; name: string; kind: string; seen: boolean; addedAt: number; seenAt?: number };

const WATCHLIST_KEY = "luma-radar-stars-watchlist-v1";

function readWatchlist(): WatchEntry[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) ?? "[]") as WatchEntry[];
        return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry.id === "string" && typeof entry.name === "string") : [];
    } catch {
        return [];
    }
}

export function useWatchlist() {
    const [entries, setEntries] = useState<WatchEntry[]>(readWatchlist);

    useEffect(() => {
        try {
            window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(entries));
        } catch {
            // Speichern ist optional.
        }
    }, [entries]);

    return {
        entries,
        has: (id: string) => entries.some((entry) => entry.id === id),
        add: (entry: Pick<WatchEntry, "id" | "name" | "kind">) =>
            setEntries((current) => (current.some((item) => item.id === entry.id) ? current : [...current, { ...entry, seen: false, addedAt: Date.now() }])),
        remove: (id: string) => setEntries((current) => current.filter((entry) => entry.id !== id)),
        toggleSeen: (id: string) =>
            setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, seen: !entry.seen, seenAt: entry.seen ? undefined : Date.now() } : entry))),
    };
}
