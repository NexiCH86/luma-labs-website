"use client";

import { useMemo, useState } from "react";
import type { SatEntry } from "./orbit";
import { groupLabel, type WatchItem } from "./settings";

/*
 * Liste der sichtbaren Satelliten und die eigene Beobachtungsliste.
 */

type Props = {
    entries: SatEntry[];
    watchlist: WatchItem[];
    selectedNorad: number | null;
    onSelect: (norad: number, groupKey?: string) => void;
    onToggleWatch: (item: WatchItem) => void;
};

const LIMIT = 150;

export default function SatList({ entries, watchlist, selectedNorad, onSelect, onToggleWatch }: Props) {
    const [tab, setTab] = useState<"tracked" | "watch">("tracked");
    const [query, setQuery] = useState("");
    const watched = useMemo(() => new Set(watchlist.map((item) => item.norad)), [watchlist]);

    const needle = query.trim().toLowerCase();
    const tracked = useMemo(() => {
        const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
        return needle ? sorted.filter((entry) => `${entry.name} ${entry.norad} ${entry.objectId ?? ""} ${entry.groupLabel}`.toLowerCase().includes(needle)) : sorted;
    }, [entries, needle]);
    const watchRows = watchlist.filter((item) => `${item.name} ${item.norad} ${groupLabel(item.groupKey)}`.toLowerCase().includes(needle));

    return (
        <section className="sat-list" aria-label="Satellite list">
            <div className="sat-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "tracked"} className={tab === "tracked" ? "is-active" : ""} onClick={() => setTab("tracked")}>
                    TRACKED <em>{entries.length.toLocaleString("de-CH")}</em>
                </button>
                <button role="tab" aria-selected={tab === "watch"} className={tab === "watch" ? "is-active" : ""} onClick={() => setTab("watch")}>
                    ★ WATCHLIST <em>{watchlist.length}</em>
                </button>
            </div>
            <input className="sat-list-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter name / NORAD / network…" aria-label="Filter list" />

            <div className="sat-list-rows">
                {tab === "tracked"
                    ? tracked.slice(0, LIMIT).map((entry) => (
                          <div className={`sat-row${entry.norad === selectedNorad ? " is-selected" : ""}`} key={entry.norad}>
                              <button className="sat-row-main" onClick={() => onSelect(entry.norad)}>
                                  <strong>{entry.name}</strong>
                                  <small>{entry.groupLabel} · {entry.norad}</small>
                              </button>
                              <button
                                  className={`sat-star${watched.has(entry.norad) ? " is-on" : ""}`}
                                  onClick={() => onToggleWatch({ norad: entry.norad, name: entry.name, groupKey: entry.group })}
                                  aria-label={watched.has(entry.norad) ? `Remove ${entry.name} from watchlist` : `Add ${entry.name} to watchlist`}
                              >
                                  {watched.has(entry.norad) ? "★" : "☆"}
                              </button>
                          </div>
                      ))
                    : watchRows.map((item) => (
                          <div className={`sat-row${item.norad === selectedNorad ? " is-selected" : ""}`} key={item.norad}>
                              <button className="sat-row-main" onClick={() => onSelect(item.norad, item.groupKey)}>
                                  <strong>{item.name}</strong>
                                  <small>{groupLabel(item.groupKey)} · {item.norad}</small>
                              </button>
                              <button className="sat-star is-on" onClick={() => onToggleWatch(item)} aria-label={`Remove ${item.name} from watchlist`}>★</button>
                          </div>
                      ))}
                {(tab === "tracked" ? tracked.length === 0 : watchRows.length === 0) && (
                    <p className="sat-note">{tab === "tracked" ? "No satellites match this filter." : "Your watchlist is empty. Add satellites with ☆."}</p>
                )}
            </div>
            {tab === "tracked" && tracked.length > LIMIT && <div className="sat-note">Showing {LIMIT} of {tracked.length.toLocaleString("de-CH")} · use the filter to narrow the list.</div>}
        </section>
    );
}
