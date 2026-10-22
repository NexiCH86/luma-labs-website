/*
 * AR-Modus: Blickrichtung der Handy-Rueckkamera aus der Lage des Geraets
 * (DeviceOrientationEvent, W3C). alpha = Kompass (gegen den Uhrzeigersinn,
 * 0 = Norden bei absoluten Werten), beta = Neigung vor/zurueck, gamma =
 * seitlich. Weltsystem: x = Ost, y = Nord, z = Oben.
 */
export type Orientation = { alpha: number; beta: number; gamma: number };
export type LookDirection = { azimuth: number; altitude: number; roll: number };

const RAD = Math.PI / 180;

// Rotationsmatrix R = Rz(alpha) * Rx(beta) * Ry(gamma) (W3C-Reihenfolge)
function rotation({ alpha, beta, gamma }: Orientation) {
    const ca = Math.cos(alpha * RAD), sa = Math.sin(alpha * RAD);
    const cb = Math.cos(beta * RAD), sb = Math.sin(beta * RAD);
    const cg = Math.cos(gamma * RAD), sg = Math.sin(gamma * RAD);
    return [
        [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
        [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
        [-cb * sg, sb, cb * cg],
    ];
}

function apply(m: number[][], v: number[]) {
    return [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]);
}

/*
 * Rueckkamera schaut entlang -z des Geraets, Bildschirm-oben ist +y.
 * screenAngle: Drehung des Bildschirms (Querformat 90/-90).
 */
export function lookFromOrientation(orientation: Orientation, screenAngle = 0): LookDirection {
    const m = rotation(orientation);
    const camera = apply(m, [0, 0, -1]);
    const screenUpDevice = [Math.sin(screenAngle * RAD), Math.cos(screenAngle * RAD), 0];
    const screenUp = apply(m, screenUpDevice);
    const altitude = Math.asin(Math.max(-1, Math.min(1, camera[2]))) / RAD;
    const azimuth = ((Math.atan2(camera[0], camera[1]) / RAD) + 360) % 360;
    // Rollwinkel: wie weit Bildschirm-oben von der Richtung zum Zenit abweicht.
    const z0 = azimuth * RAD;
    const right = [Math.cos(z0), -Math.sin(z0), 0];
    const up = [
        right[1] * camera[2] - right[2] * camera[1],
        right[2] * camera[0] - right[0] * camera[2],
        right[0] * camera[1] - right[1] * camera[0],
    ];
    const roll = Math.atan2(screenUp[0] * right[0] + screenUp[1] * right[1] + screenUp[2] * right[2], screenUp[0] * up[0] + screenUp[1] * up[1] + screenUp[2] * up[2]) / RAD;
    return { azimuth, altitude, roll };
}
