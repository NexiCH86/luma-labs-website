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
