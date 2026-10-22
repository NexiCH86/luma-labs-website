"use client";

import { useMemo } from "react";
import OrbitGlobe from "./OrbitGlobe";
import {
    epochAgeDays,
    ISS_NORAD,
    launchYear,
    lookAt,
    orbitMetrics,
    predictPasses,
    visibilityRating,
    type LivePosition,
    type Observer,
    type SatEntry,
} from "./orbit";
import { formatDay, formatTime } from "./format";

/*
 * Steckbrief des ausgewaehlten Satelliten: Position, Bahn, Globus,
 * Sichtbarkeit vom eigenen Standort und die naechsten Ueberfluege.
 */

type Props = {
    entry: SatEntry | null;
    position: LivePosition | null;
    observer: Observer | null;
    now: Date;
    watched: boolean;
    onToggleWatch: () => void;
    onLocate: () => void;
    onShare: () => void;
    shareMessage: string;
};

export default function SatDetails({ entry, position, observer, now, watched, onToggleWatch, onLocate, onShare, shareMessage }: Props) {
    /* Ueberfluege nur jede Minute neu rechnen. */
    const minute = Math.floor(now.getTime() / 60_000);
    const passes = useMemo(
        () => (entry && observer ? predictPasses(entry, observer, new Date(minute * 60_000)) : []),
        [entry, observer, minute]
    );

    if (!entry) {
        return (
            <div className="sat-empty">
                <b>◎</b>
                <h3>SATELLITE SELECT</h3>
                <p>Wähle einen Satelliten auf der Karte oder in der Liste, oder suche nach Name, NORAD-ID bzw. COSPAR-Kennung.</p>
                <p className="sat-hint">Tipp: Die ISS ist besonders markiert.</p>
            </div>
        );
    }

    const look = observer ? lookAt(entry, observer, now) : null;
    const visibility = visibilityRating(look, entry.category);
    const metrics = orbitMetrics(entry.record);
    const age = epochAgeDays(entry.record, now);
    const year = launchYear(entry.objectId);

    return (
        <div className="sat-details">
            <div className="sat-details-head">
                <div>
                    <span>{entry.groupLabel}</span>
                    <h2>{entry.name}</h2>
                    <p>NORAD {entry.norad} · {entry.objectId ?? "---"}</p>
                </div>
                {entry.norad === ISS_NORAD ? <div className="sat-iss-badge">ISS</div> : <div className={`sat-score sat-score-${visibility.label.toLowerCase().replaceAll(" ", "-")}`}><b>{visibility.score}</b><span>{visibility.label}</span></div>}
            </div>

            <div className="sat-actions">
                <button className={watched ? "is-on" : ""} onClick={onToggleWatch} aria-pressed={watched}>{watched ? "★ WATCHED" : "☆ WATCH"}</button>
                <button onClick={onShare}>SHARE LINK</button>
                {shareMessage && <small>{shareMessage}</small>}
            </div>

            <div className="sat-metrics">
                <div><small>ALTITUDE</small><strong>{position ? `${Math.round(position.altitudeKm).toLocaleString("de-CH")} km` : "---"}</strong></div>
                <div><small>SPEED</small><strong>{position ? `${position.speedKmS.toFixed(2)} km/s` : "---"}</strong></div>
                <div><small>LATITUDE</small><strong>{position ? `${position.latitude.toFixed(3)}°` : "---"}</strong></div>
                <div><small>LONGITUDE</small><strong>{position ? `${position.longitude.toFixed(3)}°` : "---"}</strong></div>
            </div>

            <div className="sat-globe-card">
                <OrbitGlobe entry={entry} now={now} />
                <div className="sat-globe-caption"><strong>LIVE EARTH ORBIT</strong><span>NASA Blue Marble · {metrics ? `${metrics.periodMin.toFixed(1)} min orbital period` : "orbit unavailable"}</span></div>
            </div>

            <div className="sat-orbit-data">
                <div><span>Apogee</span><b>{metrics ? `${Math.round(metrics.apogeeKm).toLocaleString("de-CH")} km` : "---"}</b></div>
                <div><span>Perigee</span><b>{metrics ? `${Math.round(metrics.perigeeKm).toLocaleString("de-CH")} km` : "---"}</b></div>
                <div><span>Inclination</span><b>{entry.record.INCLINATION != null ? `${entry.record.INCLINATION.toFixed(2)}°` : "---"}</b></div>
                <div><span>Eccentricity</span><b>{entry.record.ECCENTRICITY != null ? entry.record.ECCENTRICITY.toFixed(5) : "---"}</b></div>
                <div><span>Launch year</span><b>{year ?? "---"}</b></div>
                <div className={age != null && age > 14 ? "is-warning" : ""}><span>Orbit data</span><b>{age == null ? "---" : age < 1 ? "< 1 day old" : `${Math.round(age)} days old`}</b></div>
            </div>

            <div className={`sat-visibility ${look && look.elevation > 0 ? "is-visible" : "is-below"}`}>
                <div className="sat-visibility-head">
                    <strong>FROM YOUR LOCATION</strong>
                    <span>{observer ? (look && look.elevation > 0 ? "ABOVE HORIZON" : "BELOW HORIZON") : "LOCATION REQUIRED"}</span>
                </div>
                {observer && look ? (
                    <>
                        <div className="sat-meter"><i style={{ width: `${visibility.score}%` }} /></div>
                        <div className="sat-look-grid">
                            <div><small>ELEVATION</small><b>{look.elevation.toFixed(1)}°</b></div>
                            <div><small>AZIMUTH</small><b>{look.azimuth.toFixed(0)}°</b></div>
                            <div><small>RANGE</small><b>{Math.round(look.rangeKm).toLocaleString("de-CH")} km</b></div>
                            <div><small>LIGHT</small><b>{look.sunlit ? "SUNLIT" : "SHADOW"}</b></div>
                        </div>
                        <p className="sat-note">{visibility.reason}</p>
                        <div className="sat-pass-list">
                            <div className="sat-pass-list-head"><strong>NEXT PASSES · 48H</strong><small>{observer.label ?? "your location"}</small></div>
                            {passes.length ? passes.map((pass) => (
                                <div className={`sat-pass${pass.optical ? " is-optical" : ""}`} key={pass.rise.toISOString()}>
                                    <span>{formatDay(pass.rise)}</span>
                                    <div><small>RISE</small><b>{formatTime(pass.rise)}</b></div>
                                    <div><small>PEAK</small><b>{formatTime(pass.peak)} · {pass.peakElevation.toFixed(0)}°</b></div>
                                    <div><small>SET</small><b>{formatTime(pass.set)}</b></div>
                                    <em>{pass.optical ? "VISIBLE" : pass.sunlit ? "SUNLIT" : "SHADOW"}</em>
                                </div>
                            )) : <p className="sat-note">Kein Überflug in den nächsten 48 Stunden (z. B. geostationär oder zu weit entfernt).</p>}
                        </div>
                    </>
                ) : (
                    <button className="sat-primary" onClick={onLocate}>SET MY LOCATION</button>
                )}
            </div>

            <div className="sat-links">
                <a href={`https://celestrak.org/NORAD/elements/gp.php?CATNR=${entry.norad}&FORMAT=JSON-PRETTY`} target="_blank" rel="noreferrer">CELESTRAK DATA ↗</a>
                <a href={`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(entry.name)}`} target="_blank" rel="noreferrer">WIKIPEDIA SEARCH ↗</a>
            </div>
        </div>
    );
}
