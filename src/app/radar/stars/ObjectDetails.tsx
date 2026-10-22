"use client";

import { azimuthLabel, type Horizontal, type MoonInfo, type RiseTransitSet } from "./astro";
import { constellationName, formatDistance, hoursLabel, objectName, objectSubtitle, timeLabel } from "./format";
import { type Constellation } from "./sky-catalog";
import { type SkyObject } from "./stars-data";
import { type NameLanguage, type SkyInfo } from "./types";

/*
 * Detailbereich im rechten Panel: gewaehltes Objekt oder Sternbild.
 */
export type ObjectDetailsProps = {
    selected: SkyObject | null;
    selectedConstellation: Constellation | null;
    info: SkyInfo | null | undefined;
    events: RiseTransitSet | null;
    horizontal: Horizontal | null;
    moon: MoonInfo;
    lst: number;
    skyTime: Date;
    timeZone: string;
    names: NameLanguage;
    onCenterObject: (object: SkyObject) => void;
    onCenterConstellation: (constellation: Constellation) => void;
    children?: React.ReactNode;
};

function InfoCard({ info }: { info: SkyInfo }) {
    return (
        <div className="stars-info-card">
            {info.image && (
                // Externes Wikipedia-Bild, wie die Flugzeugfotos im AIR-Modus.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.image} alt={info.title} loading="lazy" referrerPolicy="no-referrer" />
            )}
            <p>{info.extract.length > 340 ? `${info.extract.slice(0, 340).replace(/\s+\S*$/, "")} …` : info.extract}</p>
            {info.url && <a href={info.url} target="_blank" rel="noreferrer">Wikipedia · {info.title}</a>}
        </div>
    );
}

export default function ObjectDetails(props: ObjectDetailsProps) {
    const { selected, selectedConstellation, events, horizontal, timeZone, skyTime } = props;

    if (selected) {
        const visibleNow = horizontal ? horizontal.altitude > 0 : false;
        return (
            <>
                <div className="stars-object-heading">
                    <div className={`stars-object-icon ${selected.kind}`}>{selected.kind === "star" ? "✦" : selected.kind === "planet" ? "●" : "◎"}</div>
                    <div><h2>{objectName(selected, props.names)}</h2><p>{objectSubtitle(selected)}</p></div>
                </div>
                <div className={`stars-visibility ${visibleNow ? "is-visible" : "is-below"}`}>
                    <span />{visibleNow ? "ABOVE HORIZON" : "BELOW HORIZON"}
                </div>
                {props.info && <InfoCard info={props.info} />}
                {events && (
                    <div className="stars-events">
                        {events.status === "circumpolar" ? (
                            <div className="stars-event-note">Circumpolar – never sets here</div>
                        ) : events.status === "never" ? (
                            <div className="stars-event-note">Never rises at this latitude</div>
                        ) : (
                            <>
                                <div><span>Rise</span><strong>{timeLabel(events.rise, timeZone, skyTime)}</strong></div>
                                <div><span>Set</span><strong>{timeLabel(events.set, timeZone, skyTime)}</strong></div>
                            </>
                        )}
                        <div>
                            <span>Culmination</span>
                            <strong>{timeLabel(events.transit, timeZone, skyTime)}{events.transitAltitude !== null ? ` · ${events.transitAltitude.toFixed(0)}°` : ""}</strong>
                        </div>
                    </div>
                )}
                {props.children}
                <dl className="stars-data-grid">
                    <div><dt>Right ascension</dt><dd>{hoursLabel(selected.ra)}</dd></div>
                    <div><dt>Declination</dt><dd>{selected.dec.toFixed(2)}°</dd></div>
                    <div><dt>Magnitude</dt><dd>{selected.magnitude < 50 ? selected.magnitude.toFixed(2) : "—"}</dd></div>
                    <div><dt>Distance</dt><dd>{formatDistance(selected)}</dd></div>
                    {selected.kind === "star" && <div><dt>Spectral class</dt><dd>{selected.spectral ?? "—"}</dd></div>}
                    {selected.kind === "dso" && <div><dt>Object type</dt><dd>{selected.objectType}</dd></div>}
                    {selected.kind === "dso" && selected.size && <div><dt>Size</dt><dd>{selected.size[0]}′ × {selected.size[1]}′</dd></div>}
                    {selected.id === "moon" && <div><dt>Phase</dt><dd>{props.moon.name} · {Math.round(props.moon.illumination * 100)}%</dd></div>}
                    {horizontal && <div><dt>Altitude</dt><dd>{horizontal.altitude.toFixed(1)}°</dd></div>}
                    {horizontal && <div><dt>Azimuth</dt><dd>{horizontal.azimuth.toFixed(1)}° {azimuthLabel(horizontal.azimuth)}</dd></div>}
                    <div><dt>Local sidereal</dt><dd>{hoursLabel(props.lst)}</dd></div>
                </dl>
                <button className="stars-primary-button" onClick={() => props.onCenterObject(selected)}>Center object</button>
            </>
        );
    }

    if (selectedConstellation) {
        return (
            <>
                <div className="stars-object-heading">
                    <div className="stars-object-icon">✶</div>
                    <div>
                        <h2>{constellationName(selectedConstellation, props.names)}</h2>
                        <p>Constellation · {props.names === "de" ? selectedConstellation.name : selectedConstellation.nameDe}</p>
                    </div>
                </div>
                {props.info && <InfoCard info={props.info} />}
                {props.children}
                <dl className="stars-data-grid">
                    <div><dt>Abbreviation</dt><dd>{selectedConstellation.id}</dd></div>
                    <div><dt>Right ascension</dt><dd>{hoursLabel(selectedConstellation.ra)}</dd></div>
                    <div><dt>Declination</dt><dd>{selectedConstellation.dec.toFixed(2)}°</dd></div>
                </dl>
                <button className="stars-primary-button" onClick={() => props.onCenterConstellation(selectedConstellation)}>Center constellation</button>
            </>
        );
    }

    return <p className="stars-muted">Click a star, planet or deep-sky object, or search for one.</p>;
}
