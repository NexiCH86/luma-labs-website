import { createSkyFrame, moonInfo, type NightInfo } from "./astro";
import { solarSystemObjects, type Observer } from "./sky-catalog";

/*
 * Beobachtungs-Score fuer die Nacht (0-100) pro Stunde aus:
 *   - Dunkelheit (Sonnenstand)
 *   - Bewoelkung (Open-Meteo; tiefe Wolken stoeren am meisten)
 *   - Mondlicht (Beleuchtung und Hoehe des Mondes)
 *   - Lichtverschmutzung (Bortle-Klasse 1-9, vom Nutzer gewaehlt)
 *   - sehr feuchte Luft (Dunst)
 */

export type SkyWeather = {
    timezone: string;
    hourly: {
        time: number[];
        cloud: (number | null)[];
        low: (number | null)[];
        mid: (number | null)[];
        high: (number | null)[];
        visibility: (number | null)[];
        humidity: (number | null)[];
    };
};

export type ScoreHour = { time: Date; score: number; cloud: number; darkness: number; moon: number };
export type NightScore = { hours: ScoreHour[]; best: { from: Date; to: Date; score: number } | null; peak: number; label: "Great" | "Good" | "Fair" | "Poor" };

function darkness(sunAltitude: number) {
    if (sunAltitude <= -18) return 1;
    if (sunAltitude <= -12) return 0.85;
    if (sunAltitude <= -6) return 0.5;
    if (sunAltitude <= 0) return 0.1;
    return 0;
}

export function scoreLabel(score: number): NightScore["label"] {
    if (score >= 70) return "Great";
    if (score >= 50) return "Good";
    if (score >= 30) return "Fair";
    return "Poor";
}

export function nightScore(weather: SkyWeather | null, observer: Observer, night: NightInfo, bortle: number): NightScore | null {
    if (!weather || weather.hourly.time.length === 0) return null;
    const from = (night.sunset ?? night.civilDusk)?.getTime();
    const to = (night.sunrise ?? night.civilDawn)?.getTime();
    if (!from || !to) return null;

    const light = 1 - (Math.min(9, Math.max(1, bortle)) - 1) * 0.06;
    const hours: ScoreHour[] = [];

    weather.hourly.time.forEach((time, index) => {
        if (time < from - 30 * 60_000 || time > to + 30 * 60_000) return;
        const date = new Date(time);
        const frame = createSkyFrame(date, observer);
        const bodies = solarSystemObjects(date, observer);
        const sun = bodies.find((body) => body.id === "sun");
        const moon = bodies.find((body) => body.id === "moon");
        const sunAltitude = sun ? frame.toHorizontal(sun.ra, sun.dec).altitude : -90;
        const moonAltitude = moon ? frame.toHorizontal(moon.ra, moon.dec).altitude : -90;
        const illumination = moonInfo(date).illumination;

        const total = weather.hourly.cloud[index] ?? 0;
        const effective = Math.max(weather.hourly.low[index] ?? total, 0.85 * (weather.hourly.mid[index] ?? total), 0.5 * (weather.hourly.high[index] ?? total), 0.9 * total);
        const cloudFactor = Math.pow(1 - Math.min(100, effective) / 100, 1.3);
        const moonFactor = moonAltitude > 0 ? 1 - 0.55 * illumination * Math.min(1, (moonAltitude + 5) / 30) : 1;
        const haze = (weather.hourly.humidity[index] ?? 0) > 92 ? 0.9 : 1;
        const dark = darkness(sunAltitude);

        hours.push({ time: date, score: Math.round(100 * dark * cloudFactor * moonFactor * light * haze), cloud: Math.round(total), darkness: dark, moon: moonFactor });
    });

    if (hours.length === 0) return null;
    const peak = Math.max(...hours.map((hour) => hour.score));

    // Bestes Fenster: zusammenhaengende Stunden nahe am Hoechstwert (mindestens 30).
    let best: NightScore["best"] = null;
    const threshold = Math.max(30, peak - 15);
    let runStart = -1;
    for (let i = 0; i <= hours.length; i++) {
        const inside = i < hours.length && hours[i].score >= threshold;
        if (inside && runStart < 0) runStart = i;
        if (!inside && runStart >= 0) {
            const run = hours.slice(runStart, i);
            const average = Math.round(run.reduce((sum, hour) => sum + hour.score, 0) / run.length);
            if (!best || run.length > (best.to.getTime() - best.from.getTime()) / 3_600_000 || average > best.score) {
                best = { from: run[0].time, to: new Date(run[run.length - 1].time.getTime() + 3_600_000), score: average };
            }
            runStart = -1;
        }
    }

    return { hours, best, peak, label: scoreLabel(peak) };
}
