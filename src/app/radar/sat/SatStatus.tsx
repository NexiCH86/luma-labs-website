"use client";

import { useMemo } from "react";
import { sunElevation, sunState, twilight, type Observer } from "./orbit";
import { formatAge } from "./format";
import { groupLabel } from "./settings";
import type { GroupState } from "./use-sat-data";

/*
 * Datenstand pro Gruppe (live, Cache, veraltet, Fehler) und
 * Tag/Nacht auf der Erde mit dem Himmel am eigenen Standort.
 */

type Props = {
    enabled: string[];
    groups: Record<string, GroupState>;
    observer: Observer | null;
    now: Date;
    onRetry: (group: string) => void;
};

function DaylightMap({ observer, now }: { observer: Observer | null; now: Date }) {
    /* Raster 10° × 10°, alle 5 Minuten neu. */
    const slot = Math.floor(now.getTime() / 300_000);
    const { cells, sun } = useMemo(() => {
        const date = new Date(slot * 300_000);
        const items: { x: number; y: number; state: string }[] = [];
        for (let row = 0; row < 18; row++) {
            for (let col = 0; col < 36; col++) {
                const elevation = sunElevation({ latitude: 85 - row * 10, longitude: -175 + col * 10 }, date);
                items.push({ x: col * 10, y: row * 10, state: elevation >= 0 ? "day" : elevation >= -12 ? "twilight" : "night" });
            }
        }
        return { cells: items, sun: sunState(date) };
    }, [slot]);

    return (
        <svg className="sat-daylight" viewBox="0 0 360 180" role="img" aria-label="Day and night on Earth">
            {cells.map((cell) => <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width="10.1" height="10.1" className={`sat-daylight-${cell.state}`} />)}
            <line x1="180" x2="180" y1="0" y2="180" className="sat-daylight-line" />
            <line x1="0" x2="360" y1="90" y2="90" className="sat-daylight-line" />
            <circle cx={sun.subsolarLon + 180} cy={90 - sun.subsolarLat} r="4" className="sat-daylight-sun" />
            {observer && <circle cx={observer.longitude + 180} cy={90 - observer.latitude} r="3" className="sat-daylight-observer" />}
        </svg>
    );
}

export default function SatStatus({ enabled, groups, observer, now, onRetry }: Props) {
    const localSun = observer ? sunElevation(observer, now) : null;

    return (
        <section className="sat-status" aria-label="Data status">
            <div className="sat-section-title"><strong>DATA STATUS</strong><span>Orbit data: <a href="https://celestrak.org" target="_blank" rel="noreferrer">CelesTrak</a></span></div>
            <div className="sat-status-rows">
                {enabled.map((group) => {
                    const state = groups[group];
                    const text =
                        !state || state.status === "loading"
                            ? "LOADING"
                            : state.status === "error"
                              ? "OFFLINE"
                              : state.fetchedAt
                                ? `${state.stale ? "STALE · " : ""}${formatAge(now.getTime() - state.fetchedAt)} OLD`
                                : "READY";
                    return (
                        <div key={group} className={`sat-status-row${state?.status === "error" ? " is-error" : state?.stale ? " is-stale" : ""}`}>
                            <span>{groupLabel(group)}</span>
                            <b>{text}</b>
                            {state?.status === "error" && <button onClick={() => onRetry(group)}>RETRY</button>}
                            {state?.error && <small>{state.error}</small>}
                        </div>
                    );
                })}
            </div>
            <p className="sat-footnote">Bahndaten werden höchstens alle 2 h bei CelesTrak geholt; fällt CelesTrak aus, zeigt LuMa RADAR die letzten Daten.</p>

            <div className="sat-section-title"><strong>DAY / NIGHT</strong><span>{localSun == null ? "no location" : twilight(localSun)}</span></div>
            <DaylightMap observer={observer} now={now} />
            {localSun != null && <p className="sat-note">Sonne am Standort {localSun.toFixed(1)}°. Satelliten sind von Auge sichtbar, wenn es bei dir dunkel ist (Sonne unter −6°) und der Satellit noch Sonnenlicht hat.</p>}
        </section>
    );
}
