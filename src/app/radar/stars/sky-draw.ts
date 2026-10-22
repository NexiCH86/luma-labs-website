import { clamp } from "./astro";

/*
 * Zeichenhilfen fuer die Sternkarte: Himmelsfarbe nach Sonnenstand
 * und Mond mit Phase.
 */

type Rgb = [number, number, number];

const NIGHT: Rgb[] = [[8, 20, 44], [3, 11, 27], [1, 3, 11]];
const TWILIGHT: Rgb[] = [[22, 44, 92], [36, 52, 104], [118, 84, 104]];
const DAY: Rgb[] = [[74, 132, 204], [56, 112, 186], [138, 180, 226]];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

function rgb([r, g, b]: Rgb) {
    return `rgb(${r},${g},${b})`;
}

/*
 * Drei Farbstufen (Zenit, Mitte, Horizont): Nacht unter -18°,
 * Daemmerung bis 0°, Tag ab etwa +8° Sonnenhoehe.
 */
export function skyColors(sunAltitude: number): [string, string, string] {
    const toTwilight = clamp((sunAltitude + 18) / 18, 0, 1);
    const toDay = clamp(sunAltitude / 8, 0, 1);
    return [0, 1, 2].map((i) => rgb(mix(mix(NIGHT[i], TWILIGHT[i], toTwilight), DAY[i], toDay))) as [string, string, string];
}

/*
 * Wie stark der Himmel aufgehellt ist: 0 bei astronomischer Nacht,
 * 1 ab Sonnenaufgang. Daempft Sterne und Milchstrasse.
 */
export function skyBrightness(sunAltitude: number) {
    return clamp((sunAltitude + 12) / 12, 0, 1);
}

/*
 * Mond mit beleuchtetem Anteil (0..1). angle zeigt auf dem Bildschirm
 * zur Sonne, dorthin liegt die helle Seite.
 */
export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, illumination: number, angle: number, highlighted: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.shadowBlur = 16 * illumination + 4;
    ctx.shadowColor = "#e8ecf4";
    ctx.fillStyle = "#1c2433";
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Helle Halbscheibe zur Sonne, dazu eine Ellipse fuer den Terminator.
    const terminator = radius * Math.abs(1 - 2 * illumination);
    ctx.fillStyle = "#e8ecf4";
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    if (illumination >= 0.5) {
        ctx.ellipse(0, 0, terminator, radius, 0, Math.PI / 2, (3 * Math.PI) / 2);
    } else {
        ctx.ellipse(0, 0, terminator, radius, 0, Math.PI / 2, (3 * Math.PI) / 2, true);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = highlighted ? "rgba(255,213,124,.9)" : "rgba(232,236,244,.35)";
    ctx.lineWidth = highlighted ? 1.3 : 0.8;
    ctx.beginPath(); ctx.arc(0, 0, highlighted ? radius + 7 : radius, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

export type DsoGroup = "galaxy" | "cluster" | "nebula" | "other";

export function dsoGroup(typeCode: string | undefined): DsoGroup {
    if (!typeCode) return "other";
    if (["s", "s0", "sd", "e", "i", "g"].includes(typeCode)) return "galaxy";
    if (typeCode === "oc" || typeCode === "gc") return "cluster";
    if (["en", "bn", "rn", "snr", "sfr", "pn"].includes(typeCode)) return "nebula";
    return "other";
}

/*
 * Deep-Sky-Symbol in echter Winkelgroesse (radius in Pixel, mindestens
 * ein paar Pixel): Galaxie als Ellipse, offener Haufen gestrichelt,
 * Kugelsternhaufen mit Kreuz, Planetarischer Nebel mit Strahlen,
 * Nebel als abgerundetes Quadrat.
 */
export function drawDso(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, axisRatio: number, typeCode: string | undefined, highlighted: boolean) {
    const r = Math.max(highlighted ? 6 : 3.5, radius);
    ctx.save();
    ctx.strokeStyle = highlighted ? "#f7c768" : "rgba(112,224,255,.75)";
    ctx.fillStyle = highlighted ? "rgba(247,199,104,.18)" : "rgba(112,224,255,.07)";
    ctx.lineWidth = highlighted ? 2 : 1;
    ctx.beginPath();

    const group = dsoGroup(typeCode);
    if (group === "galaxy") {
        ctx.strokeStyle = highlighted ? "#f7c768" : "rgba(255,170,200,.8)";
        ctx.fillStyle = highlighted ? "rgba(247,199,104,.18)" : "rgba(255,170,200,.08)";
        ctx.ellipse(x, y, r, Math.max(2, r * clamp(axisRatio, 0.25, 1)), -Math.PI / 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    } else if (typeCode === "oc") {
        ctx.setLineDash([2, 2.5]);
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    } else if (typeCode === "gc") {
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
        ctx.stroke();
    } else if (typeCode === "pn") {
        ctx.strokeStyle = highlighted ? "#f7c768" : "rgba(140,255,190,.85)";
        ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            ctx.moveTo(x + dx * r * 0.7, y + dy * r * 0.7);
            ctx.lineTo(x + dx * (r + 3), y + dy * (r + 3));
        }
        ctx.stroke();
    } else if (group === "nebula") {
        ctx.strokeStyle = highlighted ? "#f7c768" : "rgba(140,255,190,.38)";
        ctx.fillStyle = highlighted ? "rgba(247,199,104,.18)" : "rgba(140,255,190,.04)";
        ctx.roundRect(x - r, y - r, r * 2, r * 2, Math.min(4, r / 2));
        ctx.fill(); ctx.stroke();
    } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}
