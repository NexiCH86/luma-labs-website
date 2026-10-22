"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SatelliteResponse } from "@/lib/satellite-source";
import { toEntry, type SatEntry } from "./orbit";

/*
 * Bahndaten pro Gruppe: genau ein Abruf je Gruppe, danach liegen
 * die fertigen SGP4-Eintraege hier fuer alle Panels bereit.
 */

export type GroupState = {
    status: "loading" | "ready" | "error";
    entries: SatEntry[];
    fetchedAt: number | null;
    stale: boolean;
    error: string | null;
};

async function fetchGroup(group: string): Promise<GroupState> {
    const response = await fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`);
    const data = (await response.json()) as Partial<SatelliteResponse>;
    const failure = data.failedGroups?.find((item) => item.group === group);
    if (!response.ok || !data.ok || failure) throw new Error(failure?.error ?? data.error ?? `HTTP ${response.status}`);
    const entries: SatEntry[] = [];
    for (const record of data.satellites ?? []) {
        const entry = toEntry(record);
        if (entry) entries.push(entry);
    }
    return {
        status: "ready",
        entries,
        fetchedAt: data.dataUpdatedAt ? Date.parse(data.dataUpdatedAt) : Date.now(),
        stale: data.stale === true,
        error: null,
    };
}

export function useSatData(groups: string[]) {
    const [state, setState] = useState<Record<string, GroupState>>({});
    const requested = useRef(new Set<string>());

    const load = useCallback((group: string) => {
        requested.current.add(group);
        setState((current) => ({ ...current, [group]: { status: "loading", entries: current[group]?.entries ?? [], fetchedAt: null, stale: false, error: null } }));
        fetchGroup(group)
            .then((result) => setState((current) => ({ ...current, [group]: result })))
            .catch((error: unknown) =>
                setState((current) => ({
                    ...current,
                    [group]: { status: "error", entries: [], fetchedAt: null, stale: false, error: error instanceof Error ? error.message : String(error) },
                }))
            );
    }, []);

    const key = groups.join(",");
    useEffect(() => {
        for (const group of key.split(",").filter(Boolean)) {
            if (!requested.current.has(group)) load(group);
        }
    }, [key, load]);

    return { groups: state, retry: load };
}

/*
 * Objekte der sichtbaren Gruppen, ohne Doppelte (ein Objekt kann in
 * mehreren Gruppen sein, z. B. die ISS in Stations und Brightest).
 */
export function mergeEntries(state: Record<string, GroupState>, groups: string[]) {
    const byNorad = new Map<number, SatEntry>();
    for (const group of groups) {
        for (const entry of state[group]?.entries ?? []) {
            const existing = byNorad.get(entry.norad);
            if (!existing || entry.category === "station") byNorad.set(entry.norad, entry);
        }
    }
    return byNorad;
}
