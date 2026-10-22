"use client";

import { useEffect, useMemo, useRef } from "react";
import { predictPasses, type Observer, type Pass, type SatEntry } from "./orbit";
import { formatDay, formatTime, minutesUntil } from "./format";
import { groupLabel, type WatchItem } from "./settings";

/*
 * Ueberfluege aller Satelliten der Beobachtungsliste vom eigenen
 * Standort, mit Browser-Hinweis kurz vor einem guten Ueberflug.
 */

type Row = { item: WatchItem; pass: Pass | null; missing: boolean };

type Props = {
    watchlist: WatchItem[];
    resolve: (norad: number) => SatEntry | undefined;
    observer: Observer | null;
    now: Date;
    alerts: boolean;
    onToggleAlerts: () => void;
    onSelect: (norad: number, groupKey: string) => void;
    onLocate: () => void;
};

const MAX_WATCHED = 24;

export default function SatPasses({ watchlist, resolve, observer, now, alerts, onToggleAlerts, onSelect, onLocate }: Props) {
    const notified = useRef(new Set<string>());
    /* Alle 5 Minuten neu rechnen; die Liste aendert sich langsam. */
    const slot = Math.floor(now.getTime() / 300_000);

    const rows = useMemo<Row[]>(() => {
        if (!observer) return [];
        const start = new Date(slot * 300_000);
        return watchlist
            .slice(0, MAX_WATCHED)
            .map((item) => {
                const entry = resolve(item.norad);
                return { item, pass: entry ? (predictPasses(entry, observer, start, 48, 1)[0] ?? null) : null, missing: !entry };
            })
            .sort((a, b) => (a.pass?.rise.getTime() ?? Infinity) - (b.pass?.rise.getTime() ?? Infinity));
    }, [watchlist, resolve, observer, slot]);

    useEffect(() => {
        if (!alerts || typeof Notification === "undefined" || Notification.permission !== "granted") return;
        for (const row of rows) {
            if (!row.pass || row.pass.peakElevation < 10) continue;
            const key = `${row.item.norad}-${row.pass.rise.getTime()}`;
            const minutes = minutesUntil(row.pass.rise, now);
            if (minutes >= 0 && minutes <= 15 && !notified.current.has(key)) {
                notified.current.add(key);
                new Notification(`LuMa RADAR · ${row.item.name}`, {
                    body: `Überflug in ca. ${minutes} Min. · höchster Punkt ${row.pass.peakElevation.toFixed(0)}°${row.pass.optical ? " · sichtbar" : ""}`,
                });
            }
        }
    }, [alerts, rows, now]);

    const soon = rows.filter((row) => row.pass && row.pass.peakElevation >= 10 && minutesUntil(row.pass.rise, now) >= 0 && minutesUntil(row.pass.rise, now) <= 120).length;

    return (
        <section className="sat-passes" aria-label="Pass center">
            <div className="sat-section-title">
                <strong>PASS CENTER</strong>
                <span>{watchlist.length} watched · {soon} in 2 h</span>
            </div>
            <button className={`sat-alerts${alerts ? " is-on" : ""}`} onClick={onToggleAlerts} aria-pressed={alerts}>
                {alerts ? "ALERTS ON" : "ENABLE ALERTS"}
            </button>
            {!observer && (
                <p className="sat-note">
                    Erst den Standort setzen, dann rechnet LuMa RADAR die Überflüge aller beobachteten Satelliten.{" "}
                    <button className="sat-link-button" onClick={onLocate}>Standort setzen</button>
                </p>
            )}
            {observer && watchlist.length === 0 && <p className="sat-note">Satelliten mit ☆ in die Beobachtungsliste aufnehmen, um hier ihre Überflüge zu sehen.</p>}
            <div className="sat-pass-rows">
                {rows.map(({ item, pass, missing }) => (
                    <button key={item.norad} className={`sat-pass-row${pass?.optical ? " is-optical" : ""}`} onClick={() => onSelect(item.norad, item.groupKey)}>
                        <span><strong>{item.name}</strong><small>{groupLabel(item.groupKey)} · {item.norad}</small></span>
                        {pass ? (
                            <>
                                <em>{formatDay(pass.rise)} {formatTime(pass.rise)}</em>
                                <b>{pass.peakElevation.toFixed(0)}°</b>
                                <small>{pass.optical ? "VISIBLE" : `${Math.max(0, minutesUntil(pass.rise, now))} min`}</small>
                            </>
                        ) : (
                            <em className="sat-pass-none">{missing ? "LOADING DATA" : "NO 48H PASS"}</em>
                        )}
                    </button>
                ))}
            </div>
            {watchlist.length > MAX_WATCHED && <p className="sat-note">Berechnet werden die ersten {MAX_WATCHED} Satelliten der Liste.</p>}
            <p className="sat-footnote">Hinweise erscheinen, solange LuMa RADAR geöffnet ist, ca. 15 min vor einem Überflug ab 10° Höhe.</p>
        </section>
    );
}
