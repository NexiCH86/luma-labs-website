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

type Observer = { latitude: number; longitude: number; altitudeKm: number };
type Selection = { name: string; norad: number; groupLabel: string };
type PassInfo = {
    rise: Date;
    peak: Date;
    set: Date;
    peakElevation: number;
    sunlit: boolean;
    observerSunElevation: number;
};

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const EARTH_RADIUS_KM = 6378.137;
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

function norm360(value: number) {
    return ((value % 360) + 360) % 360;
}

function normLon(value: number) {
    return norm360(value + 180) - 180;
}

function julianDay(date: Date) {
    return date.getTime() / 86400000 + 2440587.5;
}

function gmstDeg(date: Date) {
    const jd = julianDay(date);
    const t = (jd - 2451545) / 36525;
    return norm360(
        280.46061837 +
            360.98564736629 * (jd - 2451545) +
            0.000387933 * t * t -
            (t * t * t) / 38710000
    );
}

function sunState(date: Date) {
    const n = julianDay(date) - 2451545;
    const meanLon = norm360(280.46 + 0.9856474 * n);
    const anomaly = norm360(357.528 + 0.9856003 * n) * DEG;
    const lambda = norm360(
        meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)
    ) * DEG;
    const obliquity = (23.439 - 0.0000004 * n) * DEG;
    const ra = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda));
    const dec = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
    const raDeg = norm360(ra * RAD);
    const decDeg = dec * RAD;
    return {
        raDeg,
        decDeg,
        subsolarLat: decDeg,
        subsolarLon: normLon(raDeg - gmstDeg(date)),
    };
}

function sunElevation(observer: Observer, date: Date) {
    const sun = sunState(date);
    const lat = observer.latitude * DEG;
    const dec = sun.decDeg * DEG;
    const hourAngle = normLon(observer.longitude - sun.subsolarLon) * DEG;
    return Math.asin(
        Math.sin(lat) * Math.sin(dec) +
            Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle)
    ) * RAD;
}

function twilight(elevation: number) {
    if (elevation >= 0) return "DAYLIGHT";
    if (elevation >= -6) return "CIVIL TWILIGHT";
    if (elevation >= -12) return "NAUTICAL TWILIGHT";
    if (elevation >= -18) return "ASTRONOMICAL TWILIGHT";
    return "NIGHT";
}

function isSunlit(position: Vector, date: Date) {
    const sun = sunState(date);
    const ra = sun.raDeg * DEG;
    const dec = sun.decDeg * DEG;
    const unit = {
        x: Math.cos(dec) * Math.cos(ra),
        y: Math.cos(dec) * Math.sin(ra),
        z: Math.sin(dec),
    };
    const along = position.x * unit.x + position.y * unit.y + position.z * unit.z;
    if (along >= 0) return true;
    const dx = position.x - along * unit.x;
    const dy = position.y - along * unit.y;
    const dz = position.z - along * unit.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) > EARTH_RADIUS_KM;
}

function look(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer,
    date: Date
) {
    const propagated = satellite.propagate(satrec, date);
    if (!propagated) return null;
    const ecf = satellite.eciToEcf(propagated.position, satellite.gstime(date));
    const angles = satellite.ecfToLookAngles(
        {
            longitude: satellite.radiansLong(observer.longitude),
            latitude: satellite.radiansLat(observer.latitude),
            height: observer.altitudeKm,
        },
        ecf
    );
    return {
        elevation: angles.elevation * RAD,
        position: propagated.position,
    };
}

function predictPasses(
    satellite: SatelliteJs,
    satrec: SatRec,
    observer: Observer
): PassInfo[] {
    const passes: PassInfo[] = [];
    const start = Date.now();
    const end = start + 48 * 60 * 60_000;
    const step = 60_000;
    let previous = look(satellite, satrec, observer, new Date(start));
    let rise: Date | null = previous && previous.elevation >= 0 ? new Date(start) : null;
    let peak: Date | null = rise;
    let peakElevation = previous?.elevation ?? -90;

    for (let time = start + step; time <= end && passes.length < 5; time += step) {
        const date = new Date(time);
        const current = look(satellite, satrec, observer, date);
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
            const atPeak = look(satellite, satrec, observer, peakDate);
            if (atPeak) {
                passes.push({
                    rise,
                    peak: peakDate,
                    set: date,
                    peakElevation,
                    sunlit: isSunlit(atPeak.position, peakDate),
                    observerSunElevation: sunElevation(observer, peakDate),
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

function selectionFromDom(): Selection | null {
    const header = document.querySelector(".sat2-selected-header");
    if (!header) return null;
    const name = header.querySelector("h2")?.textContent?.trim() ?? "";
    const groupLabel = header.querySelector("span")?.textContent?.trim() ?? "";
    const meta = header.querySelector("p")?.textContent ?? "";
    const match = meta.match(/NORAD\s+(\d+)/i);
    if (!name || !match) return null;
    return { name, norad: Number(match[1]), groupLabel };
}

function getSatelliteJs() {
    return (window as unknown as { satellite?: SatelliteJs }).satellite ?? null;
}

function waitForSatelliteJs(): Promise<SatelliteJs> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = window.setInterval(() => {
            const satellite = getSatelliteJs();
            if (satellite) {
                window.clearInterval(timer);
                resolve(satellite);
            } else if (Date.now() - started > 10000) {
                window.clearInterval(timer);
                reject(new Error("satellite.js unavailable"));
            }
        }, 150);
    });
}

function fmt(date: Date) {
    return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function SolarGrid({ observer, now }: { observer: Observer | null; now: Date }) {
    const sun = useMemo(() => sunState(now), [now]);
    const cells = useMemo(() => {
        const items: Array<{ x: number; y: number; state: string }> = [];
        for (let row = 0; row < 18; row++) {
            const latitude = 85 - row * 10;
            for (let col = 0; col < 36; col++) {
                const longitude = -175 + col * 10;
                const elevation = sunElevation({ latitude, longitude, altitudeKm: 0 }, now);
                items.push({
                    x: col * 10,
                    y: row * 10,
                    state: elevation >= 0 ? "day" : elevation >= -12 ? "twilight" : "night",
                });
            }
        }
        return items;
    }, [now]);

    return (
        <svg className="sat3-solar-grid" viewBox="0 0 360 180" aria-label="Global daylight overview">
            {cells.map((cell, index) => (
                <rect key={index} x={cell.x} y={cell.y} width="10.1" height="10.1" className={`sat3-cell sat3-${cell.state}`} />
            ))}
            <line x1="180" x2="180" y1="0" y2="180" className="sat3-grid-line" />
            <line x1="0" x2="360" y1="90" y2="90" className="sat3-grid-line" />
            <circle cx={sun.subsolarLon + 180} cy={90 - sun.subsolarLat} r="4" className="sat3-sun-point" />
            {observer && <circle cx={observer.longitude + 180} cy={90 - observer.latitude} r="3" className="sat3-observer-point" />}
        </svg>
    );
}

export default function SatPhase3Panel() {
    const [now, setNow] = useState(() => new Date());
    const [observer, setObserver] = useState<Observer | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [sunlit, setSunlit] = useState<boolean | null>(null);
    const [passes, setPasses] = useState<PassInfo[]>([]);
    const [collapsed, setCollapsed] = useState(false);
    const [status, setStatus] = useState("WAITING FOR SATELLITE");
    const requestId = useRef(0);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 5000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const read = () => {
            const next = selectionFromDom();
            setSelection((current) =>
                current?.norad === next?.norad && current?.groupLabel === next?.groupLabel
                    ? current
                    : next
            );
        };
        read();
        const mutation = new MutationObserver(read);
        mutation.observe(document.body, { childList: true, subtree: true, characterData: true });
        return () => mutation.disconnect();
    }, []);

    useEffect(() => {
        setSatrec(null);
        setSunlit(null);
        setPasses([]);
        if (!selection) {
            setStatus("WAITING FOR SATELLITE");
            return;
        }

        const selectedSnapshot = selection;
        const id = ++requestId.current;
        const group = GROUP_BY_LABEL[selectedSnapshot.groupLabel] ?? "STATIONS";

        async function loadOrbit() {
            try {
                setStatus("LOADING ORBIT INTELLIGENCE...");
                const [satellite, response] = await Promise.all([
                    waitForSatelliteJs(),
                    fetch(`/api/radar/satellites?groups=${encodeURIComponent(group)}`, { cache: "no-store" }),
                ]);
                const data = await response.json() as { satellites?: Array<Record<string, unknown>> };
                const record = data.satellites?.find(
                    (item) => Number(item.NORAD_CAT_ID) === selectedSnapshot.norad
                );
                if (!record) throw new Error("Selected satellite record unavailable");
                if (id !== requestId.current) return;
                setSatrec(satellite.json2satrec(record));
                setStatus("ASTRONOMY ONLINE");
            } catch (error) {
                if (id !== requestId.current) return;
                setStatus(error instanceof Error ? error.message.toUpperCase() : "ASTRONOMY OFFLINE");
            }
        }
        loadOrbit();
    }, [selection]);

    useEffect(() => {
        if (!satrec) return;
        const satellite = getSatelliteJs();
        const propagated = satellite?.propagate(satrec, now);
        setSunlit(propagated ? isSunlit(propagated.position, now) : null);
    }, [satrec, now]);

    useEffect(() => {
        if (!satrec || !observer) {
            setPasses([]);
            return;
        }
        const satellite = getSatelliteJs();
        if (!satellite) return;
        setStatus("CALCULATING 48H PASSES...");
        const timer = window.setTimeout(() => {
            setPasses(predictPasses(satellite, satrec, observer));
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

    const sun = useMemo(() => sunState(now), [now]);
    const localSun = observer ? sunElevation(observer, now) : null;
    const opticalNow = observer && sunlit === true && localSun != null && localSun < -6;

    return (
        <section className={`sat3-panel${collapsed ? " is-collapsed" : ""}`}>
            <button className="sat3-collapse" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "SUN" : "×"}</button>
            {!collapsed && <>
                <div className="sat3-head">
                    <div><small>PHASE 3</small><strong>SOLAR / PASS INTELLIGENCE</strong></div>
                    <span>{status}</span>
                </div>
                <SolarGrid observer={observer} now={now} />
                <div className="sat3-solar-stats">
                    <div><small>SUBSOLAR LAT</small><b>{sun.subsolarLat.toFixed(1)}°</b></div>
                    <div><small>SUBSOLAR LON</small><b>{sun.subsolarLon.toFixed(1)}°</b></div>
                    <div><small>YOUR SKY</small><b>{localSun == null ? "---" : twilight(localSun)}</b></div>
                    <div><small>SUN ELEV.</small><b>{localSun == null ? "---" : `${localSun.toFixed(1)}°`}</b></div>
                </div>
                {!observer && <button className="sat3-location" onClick={locate}>SYNC MY LOCATION</button>}
                <div className="sat3-selected">
                    <div className="sat3-selected-title"><span>SELECTED SATELLITE</span><b>{selection?.name ?? "NONE"}</b></div>
                    <div className="sat3-light-row">
                        <div className={sunlit === true ? "is-good" : ""}><small>SPACE LIGHT</small><b>{sunlit == null ? "---" : sunlit ? "SUNLIT" : "EARTH SHADOW"}</b></div>
                        <div className={opticalNow ? "is-good" : ""}><small>OPTICAL GEOMETRY</small><b>{!observer ? "LOCATION REQUIRED" : opticalNow ? "FAVOURABLE" : "NOT IDEAL"}</b></div>
                    </div>
                </div>
                {observer && selection && <div className="sat3-passes">
                    <div className="sat3-passes-head"><strong>NEXT PASSES · 48H</strong><small>geometry only</small></div>
                    {passes.length ? passes.map((pass, index) => {
                        const optical = pass.peakElevation >= 10 && pass.sunlit && pass.observerSunElevation < -6;
                        return <div className={`sat3-pass${optical ? " is-optical" : ""}`} key={`${pass.rise.toISOString()}-${index}`}>
                            <span>#{index + 1}</span>
                            <div><small>RISE</small><b>{fmt(pass.rise)}</b></div>
                            <div><small>PEAK</small><b>{fmt(pass.peak)} · {pass.peakElevation.toFixed(0)}°</b></div>
                            <div><small>SET</small><b>{fmt(pass.set)}</b></div>
                            <em>{optical ? "OPTICAL WINDOW" : pass.sunlit ? "SUNLIT" : "SHADOW"}</em>
                        </div>;
                    }) : <p className="sat3-empty">No pass found in the next 48 hours for this object/location.</p>}
                </div>}
            </>}
        </section>
    );
}
