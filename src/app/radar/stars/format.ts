import { type Constellation } from "./sky-catalog";
import { type SkyObject } from "./stars-data";
import { PLANET_NAMES_DE, type NameLanguage } from "./types";

/*
 * Formatierung fuer den STARS-Modus. Zeiten werden in der Zeitzone
 * des Standorts angezeigt (IANA-Name, z. B. "Asia/Tokyo").
 */

export const BROWSER_TIME_ZONE = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
        return "UTC";
    }
})();

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
    const key = `${timeZone}|${JSON.stringify(options)}`;
    let value = formatters.get(key);
    if (!value) {
        try {
            value = new Intl.DateTimeFormat("de-CH", { ...options, timeZone });
        } catch {
            // Unbekannte Zeitzone: auf den Browser zurueckfallen.
            value = new Intl.DateTimeFormat("de-CH", options);
        }
        formatters.set(key, value);
    }
    return value;
}

function partsOf(date: Date, timeZone: string) {
    const parts = formatter(timeZone, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

// Abstand der Zeitzone zu UTC in Millisekunden fuer diesen Zeitpunkt (inkl. Sommerzeit).
export function timeZoneOffset(date: Date, timeZone: string) {
    const p = partsOf(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function timeZoneLabel(date: Date, timeZone: string) {
    return formatter(timeZone, { timeZoneName: "short" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function sameDay(a: Date, b: Date, timeZone: string) {
    const pa = partsOf(a, timeZone);
    const pb = partsOf(b, timeZone);
    return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function timeLabel(date: Date | null, timeZone: string, reference?: Date) {
    if (!date) return "—";
    const time = formatter(timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
    if (!reference || sameDay(date, reference, timeZone)) return time;
    return `${formatter(timeZone, { weekday: "short" }).format(date)} ${time}`;
}

export function dateLabel(date: Date, timeZone: string) {
    return formatter(timeZone, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function clockLabel(date: Date, timeZone: string) {
    return formatter(timeZone, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date);
}

// Wert fuer <input type="datetime-local"> in der Zeitzone des Standorts.
export function toZonedInput(date: Date, timeZone: string) {
    const p = partsOf(date, timeZone);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/*
 * Umkehrung: Wanduhrzeit in der Zeitzone -> Zeitpunkt. Der Abstand
 * zu UTC wird zweimal bestimmt, damit Sommerzeitwechsel passen.
 */
export function fromZonedInput(value: string, timeZone: string): Date | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    let guess = wall - timeZoneOffset(new Date(wall), timeZone);
    guess = wall - timeZoneOffset(new Date(guess), timeZone);
    return new Date(guess);
}

export function hoursLabel(hours: number) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

export function formatCoordinate(value: number) {
    return String(Number(value.toFixed(4)));
}

export function formatDistance(object: SkyObject) {
    if (object.kind === "planet") return `${object.distanceAu < 0.1 ? (object.distanceAu * 149_597_871).toLocaleString("de-CH", { maximumFractionDigits: 0 }) + " km" : object.distanceAu.toFixed(2) + " AU"}`;
    const distance = object.distanceLy;
    if (!distance) return "Unknown";
    if (distance >= 1_000_000) return `${(distance / 1_000_000).toFixed(2)} M ly`;
    if (distance >= 1_000) return `${(distance / 1_000).toFixed(1)} k ly`;
    return `${distance.toLocaleString("de-CH")} ly`;
}

export function objectName(object: SkyObject, names: NameLanguage) {
    if (object.kind === "planet" && names === "de") return PLANET_NAMES_DE[object.id] ?? object.name;
    return object.name;
}

export function constellationName(constellation: Constellation, names: NameLanguage) {
    return names === "de" ? constellation.nameDe : constellation.name;
}

export function objectSubtitle(object: SkyObject) {
    if (object.kind === "dso") return [object.catalog, object.constellation].filter(Boolean).join(" · ");
    if (object.kind === "planet") return object.id === "sun" ? "Star · Solar system" : object.id === "moon" ? "Moon · Solar system" : "Planet · Solar system";
    return `${object.designation ?? "Star"} · ${object.constellation}`;
}

/*
 * Kurzer Ortsname aus dem Nominatim-Text ("Zürich, Bezirk Zürich, ...").
 */
export function shortPlaceLabel(label: string) {
    return label.split(",").slice(0, 2).map((part) => part.trim()).join(", ");
}

/*
 * Wikipedia-Titel fuer ein Objekt, der erste passende Artikel gewinnt.
 */
export function wikipediaTitles(object: SkyObject): string[] {
    if (object.kind === "planet") {
        return object.id === "mercury" ? ["Mercury (planet)"] : [object.name];
    }
    if (object.kind === "dso") {
        const titles: string[] = [];
        const messier = object.catalog.match(/^M(\d+)$/);
        if (messier) titles.push(`Messier ${messier[1]}`);
        if (object.name && object.name !== object.catalog) titles.push(object.name);
        titles.push(object.catalog);
        if (object.constellation && /^(NGC|IC) /.test(object.constellation)) titles.push(object.constellation);
        return titles;
    }
    // Sterne nur mit Eigennamen, sonst fuehrt die Suche zu Zufallstreffern.
    if (!object.name || object.name === object.designation || object.name.startsWith("HIP ")) return [];
    return [`${object.name} (star)`, object.name];
}
