"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Vector = { x: number; y: number; z: number };
type SatRec = unknown;

type SatelliteJs = {
    json2satrec: (record: Record<string, unknown>) => SatRec;
    propagate: (satrec: SatRec, date: Date) => { position: Vector; velocity: Vector } | null;
    gstime: (date: Date) => number;
    eciToEcf: (position: Vector, gmst: number) => Vector;
    ecfToLookAngles: (
        observer: { longitude: number; latitude: number; height: number },
        positionEcf: Vector
    ) => { azimuth: number; elevation: number; rangeSat: number };
    radiansLat: (degrees: number) => number;
    radiansLong: (degrees: number) => number;
};

type Observer = {
    latitude: number;
    longitude: number;
    altitudeKm: number;
};

type SelectedSatellite = {
    name: string;
    norad: number;
    groupLabel: string;
};

type PassInfo = {
    rise: Date;
    peak: Date;
    set: Date;
    peakElevation: number;
    sunlitAtPeak: boolean;
    observerSunElevation: number;
};

type SolarState = {
    declinationDeg: number;
    rightAscensionDeg: number;
    subsolarLatitude: number;
    subsolarLongitude: number;
};

const EARTH_RADIUS_KM = 6378.137;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const GROUP_BY_LABEL: Record<string, string> = {
    Stations: "STATIONS",
    GPS: "GPS-OPS",
    GLONASS: "GLO-OPS",
    Galileo: "GALILEO",
    BeiDou: "BEIDOU",
    Starlink: "STARLINK",
    Weather: "WEATHER",
    Earth: "RESOURCE",
};

function normalizeDegrees(value: number) {
    return ((value % 360) + 360) % 360;
}

function normalizeLongitude(value: number) {
    const normalized = normalizeDegrees(value + 180) - 180;
    return normalized === -180 ? 180 : normalized;
}

function julianDay(date: Date) {
    return date.getTime() / 86400000 + 2440587.5;
}

function gmstDegrees(date: Date) {
    const jd = julianDay(date);
    const t = (jd - 2451545.0) / 36525;
    return normalizeDegrees(
        280.46061837 +
            360.98564736629 * (jd - 2451545.0) +
            0.000387933 * t * t -
            (t * t * t) / 38710000
    );
}

function solarState(date: Date): SolarState {
    const jd = julianDay(date);
    const n = jd - 2451545.0;
    const meanLongitude = normalizeDegrees(280.460 + 0.9856474 * n);
    const meanAnomaly = normalizeDegrees(357.528 + 0.9856003 * n) * DEG;
    const eclipticLongitude =
        normalizeDegrees(
            meanLongitude +
                1.915 * Math.sin(meanAnomaly) +
                0.020 * Math.sin(2 * meanAnomaly)
        ) * DEG;
    const obliquity = (23.439 - 0.0000004 * n) * DEG;

    const rightAscension = Math.atan2(
        Math.cos(obliquity) * Math.sin(eclipticLongitude),
        Math.cos(eclipticLongitude)
    );
    const declination = Math.asin(
        Math.sin(obliquity) * Math.sin(eclipticLongitude)
    );

    const rightAscensionDeg = normalizeDegrees(rightAscension * RAD);
    const declinationDeg = declination * RAD;

    return {
        declinationDeg,
        rightAscensionDeg,
        subsolarLatitude: declinationDeg,
        subsolarLongitude: normalizeLongitude(rightAscensionDeg - gmstDegrees(date)),
    };
}

function sunUnitEci(date: Date): Vector {
    const sun = solarState(date);
    const ra = sun.rightAscensionDeg * DEG;
    const dec = sun.declinationDeg * DEG;
    return {
        x: Math.cos(dec) * Math.cos(ra),
        y: Math.cos(dec) * Math.sin(ra),
        z: Math.sin(dec),
    };
}

function isSatelliteSunlit(positionEci: Vector, date: Date) {
    const sun = sunUnitEci(date);
    const along =
        positionEci.x * sun.x +
        positionEci.y * sun.y +
        positionEci.z * sun.z;

    if (along >= 0) return true;

    const px = positionEci.x - along * sun.x;
    const py = positionEci.y - along * sun.y;
    const pz = positionEci.z - along * sun.z;
    const perpendicularDistance = Math.sqrt(px * px + py * py + pz * pz);

    return perpendicularDistance > EARTH_RADIUS_KM;
}

function solarElevation(observer: Observer, date: Date) {
    const sun = solarState(date);
    const lat = observer.latitude * DEG;
    const dec = sun.declinationDeg * DEG;
    const hourAngle = normalizeLongitude(
        observer.longitude - sun.subsolarLongitude
    ) * DEG;

    return Math.asin(
        Math.sin(lat) * Math.sin(dec) +
            Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)
    ) * RAD;
}

function twilightLabel(elevation: number) {
    if (elevation >= 0) return "DAYLIGHT";
    if (elevation >= -6) return "CIVIL TWILIGHT";
    if (elevation >= -12) return "NAUTICAL TWILIGHT";
    if (elevation >= -18) return "ASTRONOMICAL TWILIGHT";
    return "NIGHT";
}

function lookAngles(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer,
    date: Date
) {
    const propagated = satellite.propagate(satrec, date);
    if (!propagated) return null;

    const gmst = satellite.gstime(date);
    const ecf = satellite.eciToEcf(propagated.position, gmst);
    const look = satellite.ecfToLookAngles(
        {
            longitude: satellite.radiansLong(observer.longitude),
            latitude: satellite.radiansLat(observer.latitude),
            height: observer.altitudeKm,
        },
        ecf
    );

    return {
        elevation: look.elevation * RAD,
        azimuth: look.azimuth * RAD,
        range: look.rangeSat,
        positionEci: propagated.position,
    };
}

function predictPasses(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer,
    maxPasses = 5
): PassInfo[] {
    const passes: PassInfo[] = [];
    const start = Date.now();
    const end = start + 48 * 60 * 60_000;
    const step = 60_000;

    let previous = lookAngles(satellite, satrec, observer, new Date(start));
    let rise: Date | null = previous && previous.elevation >= 0 ? new Date(start) : null;
    let peak: Date | null = rise;
    let peakElevation = previous?.elevation ?? -90;

    for (let time = start + step; time <= end && passes.length < maxPasses; time += step) {
        const date = new Date(time);
        const current = lookAngles(satellite, satrec, observer, date);
        if (!current) continue;

        const previousElevation = previous?.elevation ?? -90;

        if (!rise && previousElevation < 0 && current.elevation >= 0) {
            rise = date;
            peak = date;
            peakElevation = current.elevation;
        }

        if (rise && current.elevation > peakElevation) {
            peak = date;
            peakElevation = current.elevation;
        }

        if (rise && previousElevation >= 0 && current.elevation < 0) {
            const peakDate = peak ?? rise;
            const peakLook = lookAngles(satellite, satrec, observer, peakDate);
            if (peakLook) {
                passes.push({
                    rise,
                    peak: peakDate,
                    set: date,
                    peakElevation,
                    sunlitAtPeak: isSatelliteSunlit(peakLook.positionEci, peakDate),
                    observerSunElevation: solarElevation(observer, peakDate),
                });
            }
            rise = null;
            peak = null;
            peakElevation = -90;
        }

        previous = current;
    }

    return passes;
}

function selectedFromDom(): SelectedSatellite | null {
    const header = document.querySelector(".sat2-selected-header");
    if (!header) return null;

    const name = header.querySelector("h2")?.textContent?.trim() ?? "";
    const meta = header.querySelector("p")?.textContent ?? "";
    const groupLabel = header.querySelector("span")?.textContent?.trim() ?? "";
    const match = meta.match(/NORAD\s+(\d+)/i);
    if (!name || !match) return null;

    return {
        name,
        norad: Number(match[1]),
        groupLabel,
    };
}

function waitForSatelliteJs(timeoutMs = 10000): Promise<SatelliteJs> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timer = window.setInterval(() => {
            const satellite = (window as unknown as { satellite?: SatelliteJs }).satellite;
            if (satellite) {
                window.clearInterval(timer);
                resolve(satellite);
            } else if (Date.now() - start > timeoutMs) {
                window.clearInterval(timer);
                reject(new Error("satellite.js unavailable"));
            }
        }, 150);
    });
}

function fmt(date: Date) {
    return date.toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function SolarGrid({ observer, now }: { observer: Observer | null; now: Date }) {
    const sun = useMemo(() => solarState(now), [now]);
    const cells = useMemo(() => {
        const result: Array<{ x: number; y: number; state: string }> = [];
        const cols = 36;
        const rows = 18;
        const cellWidth = 360 / cols;
        const cellHeight = 180 / rows;

        for (let row = 0; row < rows; row++) {
            const latitude = 90 - (row + 0.5) * cellHeight;
            for (let col = 0; col < cols; col++) {
                const longitude = -180 + (col + 0.5) * cellWidth;
                const elevation = solarElevation(
                    { latitude, longitude, altitudeKm: 0 },
                    now
                );
                const state = elevation >= 0 ? "day" : elevation >= -12 ? "twilight" : "night";
                result.push({
                    x: col * cellWidth,
                    y: row * cellHeight,
                    state,
                });
            }
        }
        return result;
    }, [now]);

    const sx = sun.subsolarLongitude + 180;
    const sy = 90 - sun.subsolarLatitude;
    const ox = observer ? observer.longitude + 180 : null;
    const oy = observer ? 90 - observer.latitude : null;

    return (
        <svg className="sat3-solar-grid" viewBox="0 0 360 180" role="img" aria-label="Global day night map">
            {cells.map((cell, index) => (
                <rect
                    key={index}
                    x={cell.x}
                    y={cell.y}
                    width="10.1"
                    height="10.1"
                    className={`sat3-cell sat3-${cell.state}`}
                />
            ))}
            <line x1="180" x2="180" y1="0" y2="180" className="sat3-grid-line" />
            <line x1="0" x2="360" y1="90" y2="90" className="sat3-grid-line" />
            <circle cx={sx} cy={sy} r="4" className="sat3-sun-point" />
            {ox != null && oy != null && (
                <circle cx={ox} cy={oy} r="3" className="sat3-observer-point" />
            )}
        </svg>
    );
}

export default function SatPhase3Panel() {
    const [now, setNow] = useState(() => new Date());
    const [observer, setObserver] = useState<Observer | null>(null);
    const [selected, setSelected] = useState<SelectedSatellite | null>(null);
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [sunlit, setSunlit] = useState<boolean | null>(null);
    const [passes, setPasses] = useState<PassInfo[]>([]);
    const [collapsed, setCollapsed] = useState(false);
    const [status, setStatus] = useState("WAITING FOR SATELLITE");
    const requestKey = useRef(0);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 5000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const updateSelection = () => {
            const next = selectedFromDom();
            setSelected((current) => {
                if (current?.norad === next?.norad && current?.groupLabel === next?.groupLabel) {
                    return current;
                }
                return next;
            });
        };

        updateSelection();
        const observerDom = new MutationObserver(updateSelection);
        observerDom.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => observerDom.disconnect();
    }, []);

    useEffect(() => {
        setSatrec(null);
        setPasses([]);
        setSunlit(null);

        if (!selected) {
            setStatus("WAITING FOR SATELLITE");
            return;
        }

        const key = ++requestKey.current;
        const group = GROUP_BY_LABEL[selected.groupLabel] ?? "STATIONS";

        async function loadSelected() {
            try {
                setStatus("LOADING ORBIT INTELLIGENCE...");
                const [satellite, response] = await Promise.all([
                    waitForSatelliteJs(),
                    fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`, { cache: "no-store" }),
                ]);
                const data = await response.json() as { satellites?: Array<Record<string, unknown>> };
                const record = data.satellites?.find(
                    (item) => Number(item.NORAD_CAT_ID) === selected.norad
                );
                if (!record) throw new Error("Selected satellite record unavailable");
                if (key !== requestKey.current) return;
                setSatrec(satellite.json2satrec(record));
                setStatus("ASTRONOMY ONLINE");
            } catch (error) {
                if (key !== requestKey.current) return;
                setStatus(error instanceof Error ? error.message.toUpperCase() : "ASTRONOMY OFFLINE");
            }
        }

        loadSelected();
    }, [selected]);

    useEffect(() => {
        if (!satrec) return;
        const satellite = (window as unknown as { satellite?: SatelliteJs }).satellite;
        if (!satellite) return;
        const propagated = satellite.propagate(satrec, now);
        setSunlit(propagated ? isSatelliteSunlit(propagated.position, now) : null);
    }, [satrec, now]);

    useEffect(() => {
        if (!satrec || !observer) {
            setPasses([]);
            return;
        }
        const satellite = (window as unknown as { satellite?: SatelliteJs }).satellite;
        if (!satellite) return;
        setStatus("CALCULATING 48H PASSES...");
        const timer = window.setTimeout(() => {
            setPasses(predictPasses(satellite, satrec, observer, 5));
            setStatus("ASTRONOMY ONLINE");
        }, 20);
        return () => window.clearTimeout(timer);
    }, [satrec, observer]);

    function locate() {
        if (!navigator.geolocation) {
            setStatus("LOCATION NOT SUPPORTED");
            return;
        }
        setStatus("REQUESTING LOCATION...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setObserver({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    altitudeKm: Math.max(0, (position.coords.altitude ?? 0) / 1000),
                });
                setStatus("LOCATION ACTIVE");
            },
            (error) => setStatus(`LOCATION: ${error.message}`.toUpperCase()),
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }

    const sun = useMemo(() => solarState(now), [now]);
    const observerSun = observer ? solarElevation(observer, now) : null;
    const opticalNow =
        !!observer &&
        !!satrec &&
        sunlit === true &&
        observerSun != null &&
        observerSun < -6;

    return (
        <section className={`sat3-panel${collapsed ? " is-collapsed" : ""}`}>
            <button className="sat3-collapse" onClick={() => setCollapsed((value) => !value)}>
                {collapsed ? "SUN" : "×"}
            </button>

            {!collapsed && (
                <>
                    <div className="sat3-head">
                        <div>
                            <small>PHASE 3</small>
                            <strong>SOLAR / PASS INTELLIGENCE</strong>
                        </div>
                        <span>{status}</span>
                    </div>

                    <SolarGrid observer={observer} now={now} />

                    <div className="sat3-solar-stats">
                        <div><small>SUBSOLAR LAT</small><b>{sun.subsolarLatitude.toFixed(1)}°</b></div>
                        <div><small>SUBSOLAR LON</small><b>{sun.subsolarLongitude.toFixed(1)}°</b></div>
                        <div><small>YOUR SKY</small><b>{observerSun == null ? "---" : twilightLabel(observerSun)}</b></div>
                        <div><small>SUN ELEV.</small><b>{observerSun == null ? "---" : `${observerSun.toFixed(1)}°`}</b></div>
                    </div>

                    {!observer && (
                        <button className="sat3-location" onClick={locate}>SYNC MY LOCATION</button>
                    )}

                    <div className="sat3-selected">
                        <div className="sat3-selected-title">
                            <span>SELECTED SATELLITE</span>
                            <b>{selected?.name ?? "NONE"}</b>
                        </div>
                        <div className="sat3-light-row">
                            <div className={sunlit === true ? "is-good" : ""}>
                                <small>SPACE LIGHT</small>
                                <b>{sunlit == null ? "---" : sunlit ? "SUNLIT" : "EARTH SHADOW"}</b>
                            </div>
                            <div className={opticalNow ? "is-good" : ""}>
                                <small>OPTICAL GEOMETRY</small>
                                <b>{!observer ? "LOCATION REQUIRED" : opticalNow ? "FAVOURABLE" : "NOT IDEAL"}</b>
                            </div>
                        </div>
                    </div>

                    {observer && selected && (
                        <div className="sat3-passes">
                            <div className="sat3-passes-head">
                                <strong>NEXT PASSES · 48H</strong>
                                <small>lighting geometry, not brightness forecast</small>
                            </div>
                            {passes.length ? passes.map((pass, index) => {
                                const optical =
                                    pass.peakElevation >= 10 &&
                                    pass.sunlitAtPeak &&
                                    pass.observerSunElevation < -6;
                                return (
                                    <div className={`sat3-pass${optical ? " is-optical" : ""}`} key={`${pass.rise.toISOString()}-${index}`}>
                                        <span>#{index + 1}</span>
                                        <div><small>RISE</small><b>{fmt(pass.rise)}</b></div>
                                        <div><small>PEAK</small><b>{fmt(pass.peak)} · {pass.peakElevation.toFixed(0)}°</b></div>
                                        <div><small>SET</small><b>{fmt(pass.set)}</b></div>
                                        <em>{optical ? "OPTICAL WINDOW" : pass.sunlitAtPeak ? "SUNLIT" : "SHADOW"}</em>
                                    </div>
                                );
                            }) : (
                                <p className="sat3-empty">No pass found in the next 48 hours for this object/location.</p>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
