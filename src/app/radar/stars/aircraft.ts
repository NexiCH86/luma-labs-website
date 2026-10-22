import { type Observer } from "./sky-catalog";

/*
 * Flugzeuge am Himmel: Positionen von adsb.lol ueber die AIR-Route
 * /api/radar/area (dort gedrosselt und im CDN zwischengespeichert).
 * Fuer jedes Flugzeug Richtung (Azimut) und Hoehe ueber dem Horizont
 * vom Standort aus, mit WGS84-Ellipsoid gerechnet.
 */

export type AreaAircraft = {
    icao24: string;
    callsign: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    geoAltitude: number | null;
    onGround: boolean;
    velocity: number | null;
    heading: number | null;
    typeCode: string | null;
    registration: string | null;
};

export type AircraftInSky = {
    id: string;
    callsign: string;
    typeCode: string | null;
    registration: string | null;
    lat: number;
    lon: number;
    heightM: number;
    altitude: number;
    azimuth: number;
    distanceKm: number;
    speedKmh: number | null;
    heading: number | null;
    // Punkt eine Minute voraus am Himmel, fuer die Pfeilrichtung
    ahead: { altitude: number; azimuth: number } | null;
};

const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const RAD = Math.PI / 180;
const MIN_ALTITUDE = 5;

function ecef(lat: number, lon: number, height: number) {
    const phi = lat * RAD;
    const lambda = lon * RAD;
    const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
    return {
        x: (n + height) * Math.cos(phi) * Math.cos(lambda),
        y: (n + height) * Math.cos(phi) * Math.sin(lambda),
        z: (n * (1 - E2) + height) * Math.sin(phi),
    };
}

/*
 * Richtung vom Standort zu einem Punkt (lat/lon/Hoehe in m):
 * Hoehe ueber dem Horizont, Azimut ab Nord ueber Ost, Entfernung.
 */
export function lookAt(observer: Observer, lat: number, lon: number, heightM: number, observerHeightM = 400) {
    const o = ecef(observer.lat, observer.lon, observerHeightM);
    const p = ecef(lat, lon, heightM);
    const d = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
    const phi = observer.lat * RAD;
    const lambda = observer.lon * RAD;
    const east = -Math.sin(lambda) * d.x + Math.cos(lambda) * d.y;
    const north = -Math.sin(phi) * Math.cos(lambda) * d.x - Math.sin(phi) * Math.sin(lambda) * d.y + Math.cos(phi) * d.z;
    const up = Math.cos(phi) * Math.cos(lambda) * d.x + Math.cos(phi) * Math.sin(lambda) * d.y + Math.sin(phi) * d.z;
    const range = Math.hypot(east, north, up);
    return { altitude: Math.asin(up / range) / RAD, azimuth: ((Math.atan2(east, north) / RAD) + 360) % 360, distanceKm: range / 1000 };
}

// Punkt in Flugrichtung nach distance Metern (Grosskreis, Kugel reicht hier).
function destination(lat: number, lon: number, headingDeg: number, distance: number) {
    const delta = distance / 6371000;
    const theta = headingDeg * RAD;
    const phi1 = lat * RAD;
    const lambda1 = lon * RAD;
    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
    const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
    return { lat: phi2 / RAD, lon: lambda2 / RAD };
}

export async function loadAircraftAround(observer: Observer, radiusNm = 100): Promise<AreaAircraft[]> {
    const response = await fetch(`/api/radar/area?lat=${observer.lat.toFixed(3)}&lon=${observer.lon.toFixed(3)}&radius=${radiusNm}`);
    if (!response.ok) throw new Error(`Aircraft unavailable (${response.status})`);
    const data = (await response.json()) as { aircraft?: AreaAircraft[] };
    return data.aircraft ?? [];
}

export function aircraftInSky(list: AreaAircraft[], observer: Observer): AircraftInSky[] {
    const result: AircraftInSky[] = [];
    for (const plane of list) {
        if (plane.onGround) continue;
        const height = plane.geoAltitude ?? plane.altitude;
        if (height == null) continue;
        const look = lookAt(observer, plane.latitude, plane.longitude, height);
        // Knapp ueber dem Horizont (weit weg, oft hinter Bergen) nicht zeigen.
        if (look.altitude < MIN_ALTITUDE) continue;
        let ahead: AircraftInSky["ahead"] = null;
        if (plane.heading != null && plane.velocity != null && plane.velocity > 20) {
            const next = destination(plane.latitude, plane.longitude, plane.heading, plane.velocity * 60);
            const lookAhead = lookAt(observer, next.lat, next.lon, height);
            ahead = { altitude: lookAhead.altitude, azimuth: lookAhead.azimuth };
        }
        result.push({
            id: `air-${plane.icao24}`,
            callsign: plane.callsign || plane.registration || plane.icao24.toUpperCase(),
            typeCode: plane.typeCode,
            registration: plane.registration,
            lat: plane.latitude,
            lon: plane.longitude,
            heightM: height,
            altitude: look.altitude,
            azimuth: look.azimuth,
            distanceKm: look.distanceKm,
            speedKmh: plane.velocity != null ? plane.velocity * 3.6 : null,
            heading: plane.heading,
            ahead,
        });
    }
    return result;
}
