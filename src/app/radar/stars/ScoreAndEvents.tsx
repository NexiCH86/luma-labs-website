"use client";

import { timeLabel } from "./format";
import { type SkyEvent } from "./events";
import { type NightScore } from "./score";

/*
 * Beobachtungs-Score (Ampel, Stunden-Balken, bestes Fenster) und die
 * Liste kommender Himmelsereignisse mit Benachrichtigungs-Schalter.
 */

const BORTLE: [number, string][] = [
    [1, "1 · Excellent dark site"],
    [2, "2 · Truly dark"],
    [3, "3 · Rural"],
    [4, "4 · Rural/suburban"],
    [5, "5 · Suburban"],
    [6, "6 · Bright suburban"],
    [7, "7 · Suburban/urban"],
    [8, "8 · City"],
    [9, "9 · Inner city"],
];

export function ScoreCard({ score, bortle, onBortle, timeZone, skyTime, weatherError }: {
    score: NightScore | null;
    bortle: number;
    onBortle: (value: number) => void;
    timeZone: string;
    skyTime: Date;
    weatherError: boolean;
}) {
    return (
        <div className="stars-score-card">
            {score ? (
                <>
                    <div className={`stars-score-head is-${score.label.toLowerCase()}`}>
                        <span className="stars-score-light" />
                        <strong>{score.label}</strong>
                        <b>{score.peak}</b>
                    </div>
                    <p>
                        {score.best
                            ? `Best ${timeLabel(score.best.from, timeZone, skyTime)}–${timeLabel(score.best.to, timeZone, skyTime)} (score ${score.best.score})`
                            : "Clouds or moonlight spoil most of the night."}
                    </p>
                    <div className="stars-score-bars" role="img" aria-label="Hourly observing score">
                        {score.hours.map((hour) => (
                            <span
                                key={hour.time.getTime()}
                                style={{ height: `${Math.max(4, hour.score)}%` }}
                                className={`is-${hour.score >= 70 ? "great" : hour.score >= 50 ? "good" : hour.score >= 30 ? "fair" : "poor"}`}
                                title={`${timeLabel(hour.time, timeZone)} · score ${hour.score} · clouds ${hour.cloud}%`}
                            />
                        ))}
                    </div>
                    <div className="stars-score-axis">
                        <span>{timeLabel(score.hours[0].time, timeZone)}</span>
                        <span>{timeLabel(score.hours[score.hours.length - 1].time, timeZone)}</span>
                    </div>
                </>
            ) : (
                <p className="stars-muted">{weatherError ? "Weather forecast unavailable." : "Loading the cloud forecast…"}</p>
            )}
            <label className="stars-bortle">
                Light pollution
                <select value={bortle} onChange={(event) => onBortle(Number(event.target.value))}>
                    {BORTLE.map(([value, label]) => <option key={value} value={value}>Bortle {label}</option>)}
                </select>
            </label>
        </div>
    );
}

const EVENT_ICONS: Record<SkyEvent["kind"], string> = { moon: "◐", meteor: "☄", conjunction: "⚭", eclipse: "◑", pass: "✈", aurora: "≋" };

export function EventsList({ events, timeZone, skyTime, notify, onNotify, notifyStatus, onPick }: {
    events: SkyEvent[];
    timeZone: string;
    skyTime: Date;
    notify: boolean;
    onNotify: () => void;
    notifyStatus: string;
    onPick: (event: SkyEvent) => void;
}) {
    const dateFormat = new Intl.DateTimeFormat("de-CH", { timeZone, weekday: "short", day: "2-digit", month: "2-digit" });
    return (
        <>
            <button className={`stars-notify-button${notify ? " is-active" : ""}`} onClick={onNotify} aria-pressed={notify}>
                {notify ? "🔔 Alerts on" : "🔕 Alert me (passes, eclipses, aurora)"}
            </button>
            {notifyStatus && <p className="stars-muted stars-hint">{notifyStatus}</p>}
            <div className="stars-events-list">
                {events.slice(0, 14).map((event) => (
                    <button key={event.id} className={`is-${event.kind}`} onClick={() => onPick(event)}>
                        <span className="stars-event-icon" aria-hidden="true">{EVENT_ICONS[event.kind]}</span>
                        <span className="stars-event-text">
                            <strong>{event.title}</strong>
                            <small>{event.detail}</small>
                        </span>
                        <span className="stars-event-when">
                            {dateFormat.format(event.time)}
                            <small>{timeLabel(event.time, timeZone, skyTime).replace(/^\S+ /, "")}</small>
                        </span>
                    </button>
                ))}
            </div>
        </>
    );
}
