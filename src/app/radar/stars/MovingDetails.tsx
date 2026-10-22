"use client";

import { azimuthLabel } from "./astro";
import { timeLabel } from "./format";
import { type AircraftInSky } from "./aircraft";
import { type SatellitePass, type SatelliteState } from "./satellites";

/*
 * Detailbereich fuer bewegte Objekte: Satelliten (mit naechsten
 * Ueberfluegen) und Flugzeuge ueber dem Standort.
 */

export function SatelliteDetails({ state, passes, timeZone, skyTime, siteDark }: {
    state: SatelliteState;
    passes: SatellitePass[];
    timeZone: string;
    skyTime: Date;
    siteDark: boolean;
}) {
    const above = state.altitude > 0;
    const visible = above && state.sunlit && siteDark;
    return (
        <>
            <div className="stars-object-heading">
                <div className="stars-object-icon">🛰</div>
                <div><h2>{state.name}</h2><p>Satellite · NORAD {state.norad}</p></div>
            </div>
            <div className={`stars-visibility ${visible ? "is-visible" : "is-below"}`}>
                <span />{visible ? "VISIBLE NOW" : above ? (state.sunlit ? "ABOVE HORIZON · SKY TOO BRIGHT" : "ABOVE HORIZON · IN EARTH'S SHADOW") : "BELOW HORIZON"}
            </div>
            <dl className="stars-data-grid">
                <div><dt>Height above Earth</dt><dd>{state.heightKm.toFixed(0)} km</dd></div>
                <div><dt>Distance from you</dt><dd>{state.rangeKm.toFixed(0)} km</dd></div>
                <div><dt>Speed</dt><dd>{(state.speedKms * 3600).toLocaleString("de-CH", { maximumFractionDigits: 0 })} km/h</dd></div>
                <div><dt>Altitude / azimuth</dt><dd>{state.altitude.toFixed(1)}° · {state.azimuth.toFixed(0)}° {azimuthLabel(state.azimuth)}</dd></div>
                <div><dt>Above</dt><dd>{state.lat.toFixed(2)}°, {state.lon.toFixed(2)}°</dd></div>
                <div><dt>Sunlight</dt><dd>{state.sunlit ? "Sunlit" : "In Earth's shadow"}</dd></div>
            </dl>
            <div className="stars-mini-label">Passes next 3 days (above 10°)</div>
            {passes.length === 0 ? <p className="stars-muted">No passes above 10°.</p> : (
                <div className="stars-pass-list">
                    {passes.slice(0, 8).map((pass) => (
                        <div key={pass.id} className={pass.visible ? "is-visible" : undefined}>
                            <strong>{timeLabel(pass.rise, timeZone, skyTime)}</strong>
                            <span>{azimuthLabel(pass.riseAzimuth)} → max {pass.peakAltitude.toFixed(0)}° → {azimuthLabel(pass.setAzimuth)}</span>
                            <em>{pass.visible ? "visible" : "not visible"}</em>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export function AircraftDetails({ plane }: { plane: AircraftInSky }) {
    return (
        <>
            <div className="stars-object-heading">
                <div className="stars-object-icon">✈</div>
                <div><h2>{plane.callsign}</h2><p>Aircraft{plane.typeCode ? ` · ${plane.typeCode}` : ""}{plane.registration ? ` · ${plane.registration}` : ""}</p></div>
            </div>
            <dl className="stars-data-grid">
                <div><dt>Flight level</dt><dd>{Math.round(plane.heightM).toLocaleString("de-CH")} m · {Math.round(plane.heightM / 0.3048).toLocaleString("de-CH")} ft</dd></div>
                <div><dt>Distance from you</dt><dd>{plane.distanceKm.toFixed(1)} km</dd></div>
                <div><dt>Altitude / azimuth</dt><dd>{plane.altitude.toFixed(1)}° · {plane.azimuth.toFixed(0)}° {azimuthLabel(plane.azimuth)}</dd></div>
                {plane.speedKmh != null && <div><dt>Ground speed</dt><dd>{Math.round(plane.speedKmh)} km/h</dd></div>}
                {plane.heading != null && <div><dt>Track</dt><dd>{Math.round(plane.heading)}°</dd></div>}
            </dl>
            <a className="stars-primary-button stars-link-button" href="/radar">Open in AIR radar</a>
        </>
    );
}
