"use client";

import { useEffect, useState } from "react";
import { timeLabel } from "./format";
import { SCALES, WEATHER_CODES, type WeatherLayer } from "./weather-layers";

/*
 * Legende der Wetter-Ebene (unten auf der Karte) und Wetter an einem
 * angeklickten Ort (rechtes Panel).
 */

const LABELS: Record<keyof typeof SCALES, string> = { clouds: "Cloud cover", rain: "Precipitation", gusts: "Wind gusts", temperature: "Temperature" };

export function WeatherLegend({ layer, wind, status, hour, photoDate, timeZone }: {
    layer: WeatherLayer;
    wind: boolean;
    status: string;
    hour: Date | null;
    photoDate: string | null;
    timeZone: string;
}) {
    const scale = layer !== "none" && layer !== "satellite" ? SCALES[layer] : null;
    const gradient = scale
        ? `linear-gradient(90deg, ${scale.stops.map(([, c], i) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0.35, c[3] / 255)}) ${(i / (scale.stops.length - 1)) * 100}%`).join(", ")})`
        : "";
    return (
        <div className="stars-weather-legend">
            {scale && (
                <>
                    <strong>{LABELS[layer as keyof typeof SCALES]}{hour ? ` · ${timeLabel(hour, timeZone)}` : ""}</strong>
                    <span className="stars-weather-bar" style={{ background: gradient }} />
                    <span className="stars-weather-ticks">
                        <em>{scale.stops[0][0]}</em>
                        <em>{scale.stops[Math.floor(scale.stops.length / 2)][0]}</em>
                        <em>{scale.stops[scale.stops.length - 1][0]} {scale.unit}</em>
                    </span>
                </>
            )}
            {layer === "satellite" && <strong>NASA satellite image{photoDate ? ` · ${photoDate}` : " · loading…"}</strong>}
            {wind && <span className="stars-weather-wind">Wind particles: white &lt; 30 · cyan &lt; 60 · orange &gt; 60 km/h</span>}
            {status && <span className="stars-weather-status">{status}</span>}
            <small>Click anywhere for the local weather · Data: Open-Meteo, NASA GIBS</small>
        </div>
    );
}

type PointWeather = {
    ok: boolean;
    timezone: string;
    elevation: number | null;
    current: Record<string, number>;
};

export function WeatherDetails({ point, onClose }: { point: { lat: number; lon: number }; onClose: () => void }) {
    const key = `${point.lat.toFixed(1)},${point.lon.toFixed(1)}`;
    const [state, setState] = useState<{ key: string; data: PointWeather | null; error: boolean } | null>(null);

    useEffect(() => {
        let active = true;
        fetch(`/api/radar/weather-point?lat=${point.lat.toFixed(2)}&lon=${point.lon.toFixed(2)}`)
            .then((response) => response.json() as Promise<PointWeather>)
            .then((data) => { if (active) setState({ key, data: data.ok ? data : null, error: !data.ok }); })
            .catch(() => { if (active) setState({ key, data: null, error: true }); });
        return () => { active = false; };
        // point steckt in key (auf 0,1° gerundet).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const data = state?.key === key ? state.data : null;
    const current = data?.current ?? {};
    const compass = (degrees: number) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];

    return (
        <>
            <div className="stars-object-heading">
                <div className="stars-object-icon">☁</div>
                <div>
                    <h2>{data ? WEATHER_CODES[current.weather_code] ?? "Weather" : "Weather"}</h2>
                    <p>{point.lat.toFixed(2)}°, {point.lon.toFixed(2)}°{data?.timezone ? ` · ${data.timezone}` : ""}</p>
                </div>
            </div>
            {!data ? (
                <p className="stars-muted">{state?.key === key && state.error ? "Weather unavailable for this place." : "Loading the weather…"}</p>
            ) : (
                <dl className="stars-data-grid">
                    <div><dt>Temperature</dt><dd>{current.temperature_2m?.toFixed(1)} °C (feels {current.apparent_temperature?.toFixed(0)} °C)</dd></div>
                    <div><dt>Wind</dt><dd>{Math.round(current.wind_speed_10m ?? 0)} km/h from {compass(current.wind_direction_10m ?? 0)}</dd></div>
                    <div><dt>Gusts</dt><dd>{Math.round(current.wind_gusts_10m ?? 0)} km/h</dd></div>
                    <div><dt>Clouds</dt><dd>{Math.round(current.cloud_cover ?? 0)}%</dd></div>
                    <div><dt>Precipitation</dt><dd>{(current.precipitation ?? 0).toFixed(1)} mm/h</dd></div>
                    <div><dt>Humidity</dt><dd>{Math.round(current.relative_humidity_2m ?? 0)}%</dd></div>
                    <div><dt>Pressure</dt><dd>{Math.round(current.pressure_msl ?? 0)} hPa</dd></div>
                    {data.elevation != null && <div><dt>Elevation</dt><dd>{Math.round(data.elevation)} m</dd></div>}
                </dl>
            )}
            <button className="stars-primary-button" onClick={onClose}>Close</button>
        </>
    );
}
