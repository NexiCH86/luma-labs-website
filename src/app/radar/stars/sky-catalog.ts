import {
    Body,
    Equator,
    Illumination,
    Observer as AstroObserver,
} from "astronomy-engine";
import {
    CONSTELLATION_LINES,
    DEEP_SKY,
    STARS,
    type DeepSkyObject,
    type PlanetObject,
    type StarObject,
} from "./stars-data";

/*
 * Format von /data/sky/catalog.json (scripts/sync-sky-catalog.mjs).
 */
type CatalogFile = {
    stars: [number, number, number, number, number][];
    names: Record<string, [string, string, string, string]>;
    constellations: {
        id: string;
        name: string;
        de: string;
        ra: number;
        dec: number;
        lines: [number, number][][];
    }[];
    dsos: {
        id: string;
        name: string;
        desig: string;
        type: string;
        mag: number | null;
        dim: string;
        ra: number;
        dec: number;
    }[];
};

export type Constellation = {
    id: string;
    name: string;
    nameDe: string;
    ra: number;
    dec: number;
    lines: [number, number][][];
};

export type SkyCatalog = {
    stars: StarObject[];
    dsos: DeepSkyObject[];
    constellations: Constellation[];
    complete: boolean;
};

export type Observer = { lat: number; lon: number };

const DSO_TYPES: Record<string, string> = {
    s: "Spiral galaxy",
    e: "Elliptical galaxy",
    i: "Irregular galaxy",
    sd: "Dwarf spheroidal galaxy",
    gc: "Globular cluster",
    oc: "Open cluster",
    en: "Emission nebula",
    rn: "Reflection nebula",
    pn: "Planetary nebula",
    snr: "Supernova remnant",
    sfr: "Star-forming region",
    pos: "Asterism",
};

/*
 * B-V-Farbindex -> ungefaehre Sternfarbe (blau-weiss bis orange-rot).
 */
function colorFromBv(bv: number) {
    if (bv < 0) return "#a9bfff";
    if (bv < 0.3) return "#cfdcff";
    if (bv < 0.6) return "#f4f6ff";
    if (bv < 0.9) return "#fff3df";
    if (bv < 1.3) return "#ffd2a1";
    return "#ffb07c";
}

/*
 * Kleine Starter-Version aus stars-data.ts, bis der volle Katalog
 * geladen ist (oder falls er fehlt).
 */
export function fallbackCatalog(): SkyCatalog {
    const byId = new Map(STARS.map((star) => [star.id, star]));

    return {
        stars: STARS,
        dsos: DEEP_SKY,
        constellations: Object.entries(CONSTELLATION_LINES).map(([name, pairs]) => ({
            id: name,
            name,
            nameDe: name,
            ra: 0,
            dec: 0,
            lines: pairs
                .map(([from, to]) => [byId.get(from), byId.get(to)])
                .filter((pair): pair is [StarObject, StarObject] => Boolean(pair[0] && pair[1]))
                .map(([a, b]) => [[a.ra, a.dec], [b.ra, b.dec]] as [number, number][]),
        })),
        complete: false,
    };
}

export async function loadSkyCatalog(): Promise<SkyCatalog> {
    const response = await fetch("/data/sky/catalog.json", { cache: "force-cache" });

    if (!response.ok) {
        throw new Error(`Sky catalog unavailable (${response.status})`);
    }

    const data = (await response.json()) as CatalogFile;

    const constellationNames = new Map(data.constellations.map((item) => [item.id, item.name]));
    const curatedStars = new Map(STARS.map((star) => [star.name, star]));
    const curatedDsos = new Map(DEEP_SKY.map((dso) => [dso.catalog, dso]));

    const stars: StarObject[] = data.stars.map(([hip, ra, dec, magnitude, bv]) => {
        const [properName = "", bayer = "", flamsteed = "", abbr = ""] = data.names[String(hip)] ?? [];
        const designation = bayer ? `${bayer} ${abbr}` : flamsteed ? `${flamsteed} ${abbr}` : `HIP ${hip}`;
        const curated = properName ? curatedStars.get(properName) : undefined;

        return {
            id: `hip-${hip}`,
            kind: "star",
            name: properName || designation,
            designation,
            constellation: constellationNames.get(abbr) ?? abbr,
            ra,
            dec,
            magnitude,
            spectral: curated?.spectral,
            distanceLy: curated?.distanceLy,
            color: curated?.color ?? colorFromBv(bv),
        };
    });

    const dsos: DeepSkyObject[] = data.dsos.map((item) => ({
        id: `dso-${item.id}`,
        kind: "dso",
        name: item.name,
        catalog: item.id,
        constellation: item.desig && item.desig !== item.id ? item.desig : "",
        ra: item.ra,
        dec: item.dec,
        magnitude: item.mag ?? 99,
        objectType: DSO_TYPES[item.type] ?? (item.type.toUpperCase() || "Deep-sky object"),
        distanceLy: curatedDsos.get(item.id)?.distanceLy,
    }));

    return {
        stars,
        dsos,
        constellations: data.constellations.map((item) => ({
            id: item.id,
            name: item.name,
            nameDe: item.de,
            ra: item.ra,
            dec: item.dec,
            lines: item.lines,
        })),
        complete: true,
    };
}

const SOLAR_SYSTEM: [Body, string][] = [
    [Body.Sun, "Sun"],
    [Body.Moon, "Moon"],
    [Body.Mercury, "Mercury"],
    [Body.Venus, "Venus"],
    [Body.Mars, "Mars"],
    [Body.Jupiter, "Jupiter"],
    [Body.Saturn, "Saturn"],
    [Body.Uranus, "Uranus"],
    [Body.Neptune, "Neptune"],
];

/*
 * Sonne, Mond und Planeten fuer Zeitpunkt und Standort
 * (astronomy-engine, J2000 wie der Sternkatalog).
 */
export function solarSystemObjects(date: Date, observer: Observer): PlanetObject[] {
    const astroObserver = new AstroObserver(observer.lat, observer.lon, 400);

    return SOLAR_SYSTEM.map(([body, name]) => {
        const position = Equator(body, date, astroObserver, false, true);
        let magnitude = 0;

        try {
            magnitude = Illumination(body, date).mag;
        } catch {
            // Helligkeit ist nicht fuer jeden Koerper definiert.
        }

        return {
            id: name.toLowerCase(),
            kind: "planet",
            name,
            constellation: "Solar system",
            ra: position.ra,
            dec: position.dec,
            magnitude,
            distanceAu: position.dist,
        };
    });
}
