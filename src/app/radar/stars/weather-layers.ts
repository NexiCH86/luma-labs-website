import { type EarthProjection } from "./earth-view";

/*
 * Wetter-Ebenen fuer die Erdansicht: weltweites Raster von Open-Meteo
 * (/api/radar/weather-grid, 12°, stuendlich 12 h) und das Echtfarben-
 * Satellitenbild von NASA GIBS (VIIRS, Tageskomposit von gestern).
 * Das Raster wird bilinear auf 1° pro Pixel interpoliert und als Textur
 * auf Karte bzw. Globus gelegt.
 */

export type WeatherLayer = "none" | "satellite" | "clouds" | "rain" | "gusts" | "temperature";
type FieldName = "cloud" | "precipitation" | "wind" | "direction" | "gusts" | "temperature";
export type WeatherGrid = { generatedAt: string; lats: number[]; lons: number[]; times: number[]; fields: Record<FieldName, number[]> };

const RAD = Math.PI / 180;
let gridPromise: { at: number; promise: Promise<WeatherGrid> } | null = null;

export function loadWeatherGrid(): Promise<WeatherGrid> {
    // Hoechstens einmal pro Stunde neu holen; der Server liefert 3 h aus dem Cache.
    if (!gridPromise || Date.now() - gridPromise.at > 3_600_000) {
        const promise = fetch("/api/radar/weather-grid")
            .then((response) => response.json() as Promise<{ ok: boolean; error?: string } & WeatherGrid>)
            .then((data) => {
                if (!data.ok) throw new Error(data.error ?? "Weather grid unavailable");
                return data;
            });
        promise.catch(() => { gridPromise = null; });
        gridPromise = { at: Date.now(), promise };
    }
    return gridPromise.promise;
}

// Naechste Stunde im Raster; -1, wenn der Zeitpunkt ausserhalb der 12 Stunden liegt.
export function timeIndex(grid: WeatherGrid, date: Date) {
    let best = -1;
    let distance = Infinity;
    grid.times.forEach((time, index) => {
        const delta = Math.abs(time - date.getTime());
        if (delta < distance) {
            distance = delta;
            best = index;
        }
    });
    return distance <= 90 * 60_000 ? best : -1;
}

function nodeValue(grid: WeatherGrid, field: FieldName, t: number, row: number, col: number) {
    const rows = grid.lats.length;
    const cols = grid.lons.length;
    const r = Math.max(0, Math.min(rows - 1, row));
    const c = ((col % cols) + cols) % cols;
    return grid.fields[field][t * rows * cols + r * cols + c];
}

/*
 * Bilineare Interpolation; Laenge laeuft rundherum, Breite wird an den
 * Polkappen (|lat| > 84°) festgehalten.
 */
export function sample(grid: WeatherGrid, field: FieldName, t: number, lat: number, lon: number) {
    const step = grid.lats[1] - grid.lats[0];
    const row = (lat - grid.lats[0]) / step;
    const col = (lon - grid.lons[0]) / step;
    const r0 = Math.floor(row);
    const c0 = Math.floor(col);
    const fr = row - r0;
    const fc = col - c0;
    const a = nodeValue(grid, field, t, r0, c0);
    const b = nodeValue(grid, field, t, r0, c0 + 1);
    const c = nodeValue(grid, field, t, r0 + 1, c0);
    const d = nodeValue(grid, field, t, r0 + 1, c0 + 1);
    return (a * (1 - fc) + b * fc) * (1 - fr) + (c * (1 - fc) + d * fc) * fr;
}

/*
 * Windvektor in km/h (u nach Osten, v nach Norden). Die Richtung im
 * Raster ist meteorologisch ("woher"), deshalb das Minus. Interpoliert
 * werden die Komponenten, nicht der Winkel.
 */
export function windVector(grid: WeatherGrid, t: number, lat: number, lon: number) {
    const step = grid.lats[1] - grid.lats[0];
    const row = (lat - grid.lats[0]) / step;
    const col = (lon - grid.lons[0]) / step;
    const r0 = Math.floor(row);
    const c0 = Math.floor(col);
    const fr = row - r0;
    const fc = col - c0;
    let u = 0;
    let v = 0;
    for (const [dr, dc, weight] of [[0, 0, (1 - fr) * (1 - fc)], [0, 1, (1 - fr) * fc], [1, 0, fr * (1 - fc)], [1, 1, fr * fc]] as const) {
        const speed = nodeValue(grid, "wind", t, r0 + dr, c0 + dc);
        const direction = nodeValue(grid, "direction", t, r0 + dr, c0 + dc) * RAD;
        u += -speed * Math.sin(direction) * weight;
        v += -speed * Math.cos(direction) * weight;
    }
    return { u, v };
}

type Rgba = [number, number, number, number];

function ramp(value: number, stops: [number, Rgba][]): Rgba {
    if (value <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
        if (value <= stops[i][0]) {
            const [v0, c0] = stops[i - 1];
            const [v1, c1] = stops[i];
            const k = (value - v0) / (v1 - v0);
            return [0, 1, 2, 3].map((j) => c0[j] + (c1[j] - c0[j]) * k) as Rgba;
        }
    }
    return stops[stops.length - 1][1];
}

// Farbskalen (Wert -> RGBA, Alpha 0..255); auch fuer die Legende.
export const SCALES: Record<Exclude<WeatherLayer, "none" | "satellite">, { field: FieldName; unit: string; stops: [number, Rgba][] }> = {
    clouds: { field: "cloud", unit: "%", stops: [[10, [255, 255, 255, 0]], [40, [235, 240, 248, 90]], [80, [245, 248, 252, 170]], [100, [255, 255, 255, 205]]] },
    rain: { field: "precipitation", unit: "mm/h", stops: [[0.05, [80, 160, 255, 0]], [0.3, [80, 160, 255, 110]], [1, [40, 110, 255, 160]], [4, [250, 220, 60, 185]], [10, [255, 140, 30, 200]], [25, [230, 40, 60, 215]], [50, [190, 40, 220, 225]]] },
    gusts: { field: "gusts", unit: "km/h", stops: [[20, [60, 200, 120, 0]], [35, [60, 200, 120, 80]], [55, [240, 220, 60, 130]], [75, [255, 150, 40, 165]], [95, [240, 50, 50, 190]], [130, [200, 40, 220, 210]]] },
    temperature: { field: "temperature", unit: "°C", stops: [[-35, [120, 60, 200, 150]], [-15, [60, 90, 230, 140]], [0, [70, 200, 230, 125]], [10, [80, 210, 120, 120]], [20, [240, 220, 70, 130]], [30, [250, 140, 40, 145]], [42, [220, 40, 40, 160]]] },
};

export function scaleColor(layer: keyof typeof SCALES, value: number) {
    return ramp(value, SCALES[layer].stops);
}

export type Texture = { key: string; canvas: HTMLCanvasElement; data: Uint8ClampedArray; width: number; height: number };
const textures = new Map<string, Texture>();

function remember(texture: Texture) {
    textures.set(texture.key, texture);
    // Nur die letzten Texturen behalten (Zeitraffer erzeugt viele Stunden).
    while (textures.size > 16) textures.delete(textures.keys().next().value as string);
    return texture;
}

/*
 * Plattkarten-Textur 360 x 180 (1° pro Pixel) fuer eine Ebene und Stunde.
 */
export function gridTexture(grid: WeatherGrid, layer: keyof typeof SCALES, t: number): Texture {
    const key = `${grid.generatedAt}|${layer}|${t}`;
    const cached = textures.get(key);
    if (cached) return cached;
    const width = 360;
    const height = 180;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(width, height);
    const { field } = SCALES[layer];
    for (let y = 0; y < height; y++) {
        const lat = 90 - y - 0.5;
        // Jenseits der letzten Rasterzeile (84°) weich ausblenden statt Keile zu zeigen.
        const polarFade = Math.max(0, Math.min(1, (88 - Math.abs(lat)) / 8));
        for (let x = 0; x < width; x++) {
            const lon = -180 + x + 0.5;
            const color = scaleColor(layer, sample(grid, field, t, lat, lon));
            const i = (y * width + x) * 4;
            image.data[i] = color[0];
            image.data[i + 1] = color[1];
            image.data[i + 2] = color[2];
            image.data[i + 3] = color[3] * polarFade;
        }
    }
    ctx.putImageData(image, 0, 0);
    return remember({ key, canvas, data: image.data, width, height });
}

/*
 * Echtfarben-Satellitenbild (NASA GIBS, VIIRS NOAA-20) als Textur.
 * Tageskomposit von gestern, bei Fehlern vom Vortag.
 */
let photoPromise: Promise<Texture> | null = null;

export function loadSatellitePhoto(): Promise<Texture> {
    photoPromise ??= (async () => {
        for (const daysAgo of [1, 2, 3]) {
            const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
            const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg&TIME=${date}`;
            try {
                const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const element = new Image();
                    element.crossOrigin = "anonymous";
                    element.onload = () => resolve(element);
                    element.onerror = () => reject(new Error("photo"));
                    element.src = url;
                });
                const canvas = document.createElement("canvas");
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(image, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                return { key: `photo|${date}`, canvas, data, width: canvas.width, height: canvas.height };
            } catch {
                // naechsten Tag versuchen
            }
        }
        throw new Error("Satellite photo unavailable");
    })();
    photoPromise.catch(() => { photoPromise = null; });
    return photoPromise;
}

/*
 * Textur auf die Erdansicht legen. Karte: einfach skaliert zeichnen.
 * Globus: Pixel fuer Pixel zurueckprojizieren (in reduzierter Aufloesung,
 * gecacht, solange sich Blick und Groesse nicht aendern).
 */
const globeRasters = new Map<string, HTMLCanvasElement>();

export function drawTexture(ctx: CanvasRenderingContext2D, projection: EarthProjection, texture: Texture, opacity = 1) {
    ctx.save();
    ctx.globalAlpha = opacity;
    if (projection.kind === "map") {
        const topLeft = projection.project(90, -180);
        const bottomRight = projection.project(-90, 180);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(texture.canvas, topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
        ctx.restore();
        return;
    }

    const radius = projection.radius;
    const size = Math.max(64, Math.min(520, Math.round(radius * 2)));
    const probe = projection.invert(projection.center.x, projection.center.y);
    const key = `${texture.key}|${size}|${Math.round(radius)}|${probe ? `${probe.lat.toFixed(2)},${probe.lon.toFixed(2)}` : ""}`;
    let raster = globeRasters.get(key);
    if (!raster) {
        raster = document.createElement("canvas");
        raster.width = size;
        raster.height = size;
        const rctx = raster.getContext("2d")!;
        const image = rctx.createImageData(size, size);
        const scale = (radius * 2) / size;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const ground = projection.invert(projection.center.x - radius + (x + 0.5) * scale, projection.center.y - radius + (y + 0.5) * scale);
                if (!ground) continue;
                const tx = Math.min(texture.width - 1, Math.max(0, Math.floor(((ground.lon + 180) / 360) * texture.width)));
                const ty = Math.min(texture.height - 1, Math.max(0, Math.floor(((90 - ground.lat) / 180) * texture.height)));
                const source = (ty * texture.width + tx) * 4;
                const target = (y * size + x) * 4;
                image.data[target] = texture.data[source];
                image.data[target + 1] = texture.data[source + 1];
                image.data[target + 2] = texture.data[source + 2];
                image.data[target + 3] = texture.data[source + 3];
            }
        }
        rctx.putImageData(image, 0, 0);
        globeRasters.set(key, raster);
        while (globeRasters.size > 12) globeRasters.delete(globeRasters.keys().next().value as string);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(raster, projection.center.x - radius, projection.center.y - radius, radius * 2, radius * 2);
    ctx.restore();
}

export const WEATHER_CODES: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Heavy freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain showers", 85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};
