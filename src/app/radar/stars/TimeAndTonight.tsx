"use client";

import { type MoonInfo, type NightInfo, type RiseTransitSet } from "./astro";
import { clockLabel, dateLabel, fromZonedInput, objectName, timeLabel, timeZoneLabel, toZonedInput } from "./format";
import { drawMoon } from "./sky-draw";
import { type SkyObject } from "./stars-data";
import { type TonightEntry } from "./tonight";
import { HOUR, SPEEDS, type NameLanguage } from "./types";

/*
 * Rechtes Panel unten: Beobachtungszeit mit Zeitraffer, Daemmerung,
 * Mond und "Tonight's best". Zeiten in der Zeitzone des Standorts.
 */
export type TimeAndTonightProps = {
    skyTime: Date;
    timeZone: string;
    liveTime: boolean;
    playing: boolean;
    playSpeed: number;
    onSetTime: (date: Date) => void;
    onShiftTime: (milliseconds: number) => void;
    onLive: () => void;
    onTogglePlay: () => void;
    onPlaySpeed: (speed: number) => void;
    observerLabel: string;
    night: NightInfo;
    moon: MoonInfo;
    moonEvents: RiseTransitSet | null;
    moonUp: boolean;
    tonight: TonightEntry[];
    selectedId: string | null;
    onTonightEntry: (object: SkyObject, bestTime: Date) => void;
    names: NameLanguage;
};

export default function TimeAndTonight(props: TimeAndTonightProps) {
    const { skyTime, timeZone, night, moon, moonEvents } = props;
    const zone = timeZoneLabel(skyTime, timeZone);
    const time = (date: Date | null) => timeLabel(date, timeZone, skyTime);

    return (
        <>
            <div className="stars-section-label">Observation time · {zone}</div>
            <div className="stars-time-card">
                <strong>{dateLabel(skyTime, timeZone)}</strong>
                <span>{clockLabel(skyTime, timeZone)}</span>
            </div>
            <input
                className="stars-datetime"
                type="datetime-local"
                value={toZonedInput(skyTime, timeZone)}
                onChange={(event) => {
                    const next = fromZonedInput(event.target.value, timeZone);
                    if (next) props.onSetTime(next);
                }}
                aria-label="Observation date and time"
            />
            <div className="stars-time-controls stars-time-controls-wide">
                <button onClick={() => props.onShiftTime(-24 * HOUR)}>−1d</button>
                <button onClick={() => props.onShiftTime(-HOUR)}>−1h</button>
                <button onClick={props.onLive} className={props.liveTime ? "is-active" : undefined}>Now</button>
                <button onClick={() => props.onShiftTime(HOUR)}>+1h</button>
                <button onClick={() => props.onShiftTime(24 * HOUR)}>+1d</button>
            </div>
            <div className="stars-speed-row">
                <button
                    className={`stars-play-button${props.playing ? " is-active" : ""}`}
                    onClick={props.onTogglePlay}
                    aria-label={props.playing ? "Pause time lapse" : "Play time lapse"}
                >
                    {props.playing ? "❚❚" : "▶"}
                </button>
                {SPEEDS.map(([value, label]) => (
                    <button key={value} className={props.playSpeed === value ? "is-active" : undefined} onClick={() => props.onPlaySpeed(value)}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="stars-section-label">Sky tonight · {props.observerLabel || "Custom"}</div>
            <dl className="stars-data-grid stars-night-grid">
                <div><dt>Sunset</dt><dd>{time(night.sunset)}</dd></div>
                <div><dt>Civil / nautical dusk</dt><dd>{time(night.civilDusk)} / {time(night.nauticalDusk)}</dd></div>
                <div>
                    <dt>Astronomical dark</dt>
                    <dd>{night.astronomicalDusk ? `${time(night.astronomicalDusk)} – ${time(night.astronomicalDawn)}` : "No full darkness"}</dd>
                </div>
                <div><dt>Nautical / civil dawn</dt><dd>{time(night.nauticalDawn)} / {time(night.civilDawn)}</dd></div>
                <div><dt>Sunrise</dt><dd>{time(night.sunrise)}</dd></div>
            </dl>
            <div className="stars-moon-card">
                <canvas
                    className="stars-moon-icon"
                    width={44}
                    height={44}
                    ref={(element) => {
                        const ctx = element?.getContext("2d");
                        if (!ctx) return;
                        ctx.clearRect(0, 0, 44, 44);
                        // Zunehmend: helle Seite rechts (Nordhalbkugel), abnehmend links.
                        drawMoon(ctx, 22, 22, 15, moon.illumination, moon.phaseAngle < 180 ? 0 : Math.PI, false);
                    }}
                />
                <div>
                    <strong>{moon.name}</strong>
                    <span>{Math.round(moon.illumination * 100)}% illuminated</span>
                    {moonEvents && (
                        props.moonUp
                            ? <span>Up now · sets {time(moonEvents.set)}</span>
                            : <span>Rises {time(moonEvents.rise)} · sets {time(moonEvents.set)}</span>
                    )}
                </div>
            </div>

            <div className="stars-section-label">Tonight&apos;s best · {props.observerLabel || "Custom"}</div>
            {props.tonight.length === 0 ? (
                <p className="stars-muted">Nothing climbs above 25° in tonight&apos;s dark hours.</p>
            ) : (
                <div className="stars-tonight-list">
                    {props.tonight.map((entry) => (
                        <button
                            key={entry.object.id}
                            className={entry.object.id === props.selectedId ? "is-active" : undefined}
                            onClick={() => props.onTonightEntry(entry.object, entry.bestTime)}
                        >
                            <span className={`stars-tonight-dot ${entry.object.kind}`} />
                            <span className="stars-tonight-name">
                                <strong>{entry.object.kind === "dso" && entry.object.name !== entry.object.catalog ? `${entry.object.catalog} · ${entry.object.name}` : entry.object.kind === "dso" ? entry.object.catalog : objectName(entry.object, props.names)}</strong>
                                <small>{entry.reason}</small>
                            </span>
                            <span className="stars-tonight-time">{time(entry.bestTime)}<small>{entry.maxAltitude.toFixed(0)}°</small></span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}
