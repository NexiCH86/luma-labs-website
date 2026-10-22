"use client";

import { type RefObject } from "react";
import { shortPlaceLabel } from "./format";
import { DEEP_STAR_LIMIT, MAX_MAGNITUDE, type Layers, type NameLanguage, type PlaceResult, type SearchResult, type ViewMode } from "./types";

/*
 * Linkes Panel: Suche, Ansicht, Ebenen, Grenzhelligkeit, Standort.
 */
export type NavigatorPanelProps = {
    open: boolean;
    collapsed: boolean;
    onCollapse: () => void;
    searchInputRef: RefObject<HTMLInputElement | null>;
    query: string;
    onQuery: (value: string) => void;
    searchResults: SearchResult[];
    onPickResult: (result: SearchResult) => void;
    mode: ViewMode;
    onMode: (mode: ViewMode) => void;
    layers: Layers;
    onLayers: (update: (current: Layers) => Layers) => void;
    counts: { stars: number; planets: number; constellations: number; dsos: number; smallBodies: number };
    magnitudeLimit: number;
    onMagnitudeLimit: (value: number) => void;
    deepStarsLoaded: boolean;
    names: NameLanguage;
    onNames: (value: NameLanguage) => void;
    observerLabel: string;
    placeQuery: string;
    onPlaceQuery: (value: string) => void;
    onSearchPlace: () => void;
    placeResults: PlaceResult[];
    onChoosePlace: (place: PlaceResult) => void;
    latText: string;
    lonText: string;
    onLatText: (value: string) => void;
    onLonText: (value: string) => void;
    onCommitCoordinates: () => void;
    onLocate: () => void;
    onZurich: () => void;
    locationStatus: string;
    catalogError: string;
};

export default function NavigatorPanel({ searchInputRef, ...props }: NavigatorPanelProps) {
    const { layers, mode } = props;
    const toggle = (key: keyof Layers, value: boolean) => props.onLayers((current) => ({ ...current, [key]: value }));

    const objectToggles: [keyof Layers, string, string | number][] = [
        ["stars", "Stars", props.counts.stars.toLocaleString("de-CH")],
        ["planets", "Sun, Moon & planets", props.counts.planets],
        ["constellations", "Constellations", props.counts.constellations],
        ["dso", "Deep sky", props.counts.dsos],
        ["smallBodies", "Comets & asteroids", props.counts.smallBodies],
        ["milkyWay", "Milky Way", ""],
        ["labels", "Labels", "Auto"],
    ];
    const lineToggles: [keyof Layers, string, string][] = [
        ["grid", mode === "sky" ? "Alt/Az grid" : mode === "earth" ? "Grid (sky views)" : "RA/Dec grid", ""],
        ["ecliptic", "Ecliptic", ""],
        ["equator", "Celestial equator", ""],
        ["meridian", "Meridian", mode === "sky" ? "" : "Sky only"],
        ["bounds", "Constellation borders", ""],
    ];

    if (props.collapsed) {
        return (
            <aside className="stars-panel stars-left-panel is-collapsed">
                <button className="stars-collapse-button" onClick={props.onCollapse} aria-label="Show navigator panel" title="Show navigator">›</button>
            </aside>
        );
    }

    return (
        <aside className={`stars-panel stars-left-panel${props.open ? " is-open" : ""}`}>
            <div className="stars-panel-title">
                Sky Navigator
                <button className="stars-collapse-button" onClick={props.onCollapse} aria-label="Hide navigator panel" title="Hide navigator">‹</button>
            </div>
            <div className="stars-search-wrap">
                <input
                    ref={searchInputRef}
                    value={props.query}
                    onChange={(event) => props.onQuery(event.target.value)}
                    onKeyDown={(event) => {
                        const first = props.searchResults[0];
                        if (event.key === "Enter" && first) props.onPickResult(first);
                    }}
                    placeholder="Search Sirius, Jupiter, M31, Orion…"
                    aria-label="Search sky objects"
                />
                {props.searchResults.length > 0 && (
                    <div className="stars-search-results">
                        {props.searchResults.map((result) => (
                            <button key={result.key} onClick={() => props.onPickResult(result)}>
                                <strong>{result.title}</strong>
                                <span>{result.subtitle}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="stars-section-label">View</div>
            <div className="stars-mode-controls">
                <button onClick={() => props.onMode("sky")} className={mode === "sky" ? "is-active" : undefined}>Sky now</button>
                <button onClick={() => props.onMode("catalog")} className={mode === "catalog" ? "is-active" : undefined}>Catalog</button>
                <button onClick={() => props.onMode("earth")} className={mode === "earth" ? "is-active" : undefined}>Earth</button>
            </div>

            <div className="stars-section-label">Layers</div>
            {objectToggles.map(([key, label, count]) => (
                <label key={key} className="stars-toggle">
                    <input type="checkbox" checked={layers[key]} onChange={(e) => toggle(key, e.target.checked)} />
                    <span>{label}</span>
                    <b>{count}</b>
                </label>
            ))}

            <div className="stars-chip-row" role="group" aria-label="Deep-sky types">
                {([["galaxies", "Galaxies"], ["clusters", "Clusters"], ["nebulae", "Nebulae"]] as [keyof Layers, string][]).map(([key, label]) => (
                    <button
                        key={key}
                        className={layers[key] ? "is-active" : undefined}
                        onClick={() => toggle(key, !layers[key])}
                        aria-pressed={layers[key]}
                        disabled={!layers.dso}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="stars-section-label">Lines</div>
            {lineToggles.map(([key, label, note]) => (
                <label key={key} className="stars-toggle">
                    <input type="checkbox" checked={layers[key]} onChange={(e) => toggle(key, e.target.checked)} />
                    <span>{label}</span>
                    <b>{note}</b>
                </label>
            ))}

            <div className="stars-section-label">Names</div>
            <div className="stars-mode-controls stars-two-columns">
                <button onClick={() => props.onNames("en")} className={props.names === "en" ? "is-active" : undefined}>English / Latin</button>
                <button onClick={() => props.onNames("de")} className={props.names === "de" ? "is-active" : undefined}>Deutsch</button>
            </div>

            <div className="stars-section-label">Magnitude limit</div>
            <div className="stars-range-row">
                <input type="range" min="1" max={MAX_MAGNITUDE} step="0.25" value={props.magnitudeLimit} onChange={(e) => props.onMagnitudeLimit(Number(e.target.value))} aria-label="Magnitude limit" />
                <span>{props.magnitudeLimit.toFixed(2)}</span>
            </div>
            {props.magnitudeLimit > DEEP_STAR_LIMIT && (
                <p className="stars-muted stars-hint">{props.deepStarsLoaded ? "Binocular stars (mag 6–8) loaded." : "Loading binocular stars (mag 6–8)…"}</p>
            )}

            <div className="stars-section-label">Observer · {props.observerLabel || "Custom"}</div>
            <div className="stars-place-row">
                <input
                    value={props.placeQuery}
                    onChange={(event) => props.onPlaceQuery(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") props.onSearchPlace(); }}
                    placeholder="Search place…"
                    aria-label="Search observer place"
                />
                <button onClick={props.onSearchPlace} aria-label="Search place">⌕</button>
            </div>
            {props.placeResults.length > 0 && (
                <div className="stars-place-results">
                    {props.placeResults.map((place) => (
                        <button key={place.id} onClick={() => props.onChoosePlace(place)}>
                            <strong>{shortPlaceLabel(place.label)}</strong>
                            <span>{place.latitude.toFixed(2)}°, {place.longitude.toFixed(2)}°</span>
                        </button>
                    ))}
                </div>
            )}
            <div className="stars-coordinate-grid">
                <label>LAT
                    <input
                        inputMode="decimal"
                        value={props.latText}
                        onChange={(e) => props.onLatText(e.target.value)}
                        onBlur={props.onCommitCoordinates}
                        onKeyDown={(e) => { if (e.key === "Enter") props.onCommitCoordinates(); }}
                    />
                </label>
                <label>LON
                    <input
                        inputMode="decimal"
                        value={props.lonText}
                        onChange={(e) => props.onLonText(e.target.value)}
                        onBlur={props.onCommitCoordinates}
                        onKeyDown={(e) => { if (e.key === "Enter") props.onCommitCoordinates(); }}
                    />
                </label>
            </div>
            <div className="stars-observer-buttons">
                <button className="stars-secondary-button" onClick={props.onLocate}>My location</button>
                <button className="stars-secondary-button" onClick={props.onZurich}>Zürich</button>
            </div>
            {props.locationStatus && <p className="stars-muted">{props.locationStatus}</p>}
            {props.catalogError && <p className="stars-muted">{props.catalogError} – showing starter catalog.</p>}
            <p className="stars-shortcuts">Keys: arrows pan · +/− zoom · 0 reset · space play · / search · N now · R night · Esc clear</p>
        </aside>
    );
}
