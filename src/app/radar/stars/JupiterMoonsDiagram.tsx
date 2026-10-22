"use client";

import { type JupiterMoon } from "./kepler";

/*
 * Stellung der Galileischen Monde wie im Fernglas: Jupiter in der
 * Mitte, Norden oben, Osten links (wie auf der Himmelskarte).
 */
const WIDTH = 272;
const HEIGHT = 64;

export default function JupiterMoonsDiagram({ moons }: { moons: JupiterMoon[] }) {
    // Massstab: der fernste Mond (meist Callisto) passt mit Rand ins Bild.
    const reach = Math.max(120, ...moons.map((moon) => Math.abs(moon.offsetEast))) * 1.12;
    const scale = (WIDTH / 2 - 12) / reach;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 - 4;

    return (
        <figure className="stars-jupiter-moons">
            <figcaption>Galilean moons · east left, north up</figcaption>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Positions of Io, Europa, Ganymede and Callisto">
                <line x1={8} x2={WIDTH - 8} y1={cy} y2={cy} className="axis" />
                <circle cx={cx} cy={cy} r={6} className="planet" />
                {moons.map((moon) => {
                    const mx = cx - moon.offsetEast * scale;
                    const my = cy - moon.offsetNorth * scale;
                    return (
                        <g key={moon.id}>
                            <circle cx={mx} cy={my} r={2.4} className="moon" />
                            <text x={mx} y={my + 15} textAnchor="middle">{moon.name}</text>
                        </g>
                    );
                })}
                <text x={10} y={HEIGHT - 4}>E</text>
                <text x={WIDTH - 10} y={HEIGHT - 4} textAnchor="end">W</text>
            </svg>
        </figure>
    );
}
