"use client";

import { useMemo } from "react";
import { createSkyFrame, type NightInfo } from "./astro";
import { timeLabel } from "./format";
import { solarSystemObjects, type Observer } from "./sky-catalog";
import { type SkyObject } from "./stars-data";

/*
 * Hoehenkurve des gewaehlten Objekts ueber die Nacht: von einer Stunde
 * vor Sonnenuntergang bis eine Stunde nach Sonnenaufgang, mit
 * Daemmerungsstufen, Horizont und Jetzt-Marke. Sonne, Mond und Planeten
 * werden pro Zeitpunkt neu berechnet (der Mond wandert 13° am Tag).
 */

const WIDTH = 272;
const HEIGHT = 112;
const PAD = { left: 24, right: 6, top: 8, bottom: 18 };
const STEP_MS = 10 * 60_000;
const HOUR = 3_600_000;
const SOLAR_SYSTEM = new Set(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"]);

export type AltitudeChartProps = {
    object: SkyObject;
    observer: Observer;
    night: NightInfo;
    skyTime: Date;
    timeZone: string;
};

export default function AltitudeChart({ object, observer, night, skyTime, timeZone }: AltitudeChartProps) {
    const start = useMemo(() => new Date((night.sunset ?? new Date(skyTime.getTime() - 6 * HOUR)).getTime() - HOUR), [night, skyTime]);
    const end = useMemo(() => {
        const candidate = (night.sunrise ?? new Date(skyTime.getTime() + 6 * HOUR)).getTime() + HOUR;
        return new Date(Math.min(candidate, start.getTime() + 20 * HOUR));
    }, [night, skyTime, start]);

    const samples = useMemo(() => {
        const points: { time: number; altitude: number }[] = [];
        for (let t = start.getTime(); t <= end.getTime(); t += STEP_MS) {
            const date = new Date(t);
            let { ra, dec } = object;
            if (object.kind === "planet" && SOLAR_SYSTEM.has(object.id)) {
                const moved = solarSystemObjects(date, observer).find((planet) => planet.id === object.id);
                if (moved) ({ ra, dec } = moved);
            }
            points.push({ time: t, altitude: createSkyFrame(date, observer).toHorizontal(ra, dec).altitude });
        }
        return points;
        // Nur bei neuem Objekt, Standort oder neuer Nacht neu rechnen.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [object.id, observer, start, end]);

    const x = (time: number) => PAD.left + ((time - start.getTime()) / (end.getTime() - start.getTime())) * (WIDTH - PAD.left - PAD.right);
    const y = (altitude: number) => PAD.top + ((90 - Math.max(-10, altitude)) / 100) * (HEIGHT - PAD.top - PAD.bottom);
    const path = samples.map((point, index) => `${index ? "L" : "M"}${x(point.time).toFixed(1)},${y(point.altitude).toFixed(1)}`).join(" ");
    // Groesste Hoehe zwischen Sonnenunter- und -aufgang; ohne Nacht im ganzen Fenster.
    const dark = samples.filter((point) => (!night.sunset || point.time >= night.sunset.getTime()) && (!night.sunrise || point.time <= night.sunrise.getTime()));
    const best = (dark.length ? dark : samples).reduce((top, point) => (point.altitude > top.altitude ? point : top), samples[0] ?? { time: 0, altitude: -90 });

    // Daemmerungsstufen als Baender: je dunkler, desto tiefer die Sonne.
    const bands: [Date | null, Date | null, string][] = [
        [night.sunset, night.sunrise, "rgba(40,70,140,.18)"],
        [night.civilDusk, night.civilDawn, "rgba(20,40,100,.22)"],
        [night.nauticalDusk, night.nauticalDawn, "rgba(10,20,60,.28)"],
        [night.astronomicalDusk, night.astronomicalDawn, "rgba(0,4,20,.4)"],
    ];
    const ticks: number[] = [];
    for (let t = Math.ceil(start.getTime() / (2 * HOUR)) * 2 * HOUR; t <= end.getTime(); t += 2 * HOUR) ticks.push(t);
    const now = skyTime.getTime();

    return (
        <figure className="stars-altitude-chart">
            <figcaption>
                Altitude tonight · max {best.altitude.toFixed(0)}° at {timeLabel(new Date(best.time), timeZone)}
            </figcaption>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Altitude of ${object.name} during the night`}>
                {bands.map(([from, to, fill], index) =>
                    from && to ? <rect key={index} x={x(from.getTime())} y={PAD.top} width={Math.max(0, x(to.getTime()) - x(from.getTime()))} height={HEIGHT - PAD.top - PAD.bottom} fill={fill} /> : null
                )}
                {[0, 30, 60].map((altitude) => (
                    <g key={altitude}>
                        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(altitude)} y2={y(altitude)} className={altitude === 0 ? "horizon" : "grid"} />
                        <text x={PAD.left - 4} y={y(altitude) + 3} textAnchor="end">{altitude}°</text>
                    </g>
                ))}
                {ticks.map((tick) => (
                    <text key={tick} x={x(tick)} y={HEIGHT - 5} textAnchor="middle">{timeLabel(new Date(tick), timeZone)}</text>
                ))}
                <path d={path} className="curve" />
                {now >= start.getTime() && now <= end.getTime() && <line x1={x(now)} x2={x(now)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="now" />}
                {best.altitude > 0 && <circle cx={x(best.time)} cy={y(best.altitude)} r={2.6} className="best" />}
            </svg>
        </figure>
    );
}
