import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const COUNTRIES_URL =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const FIR_URL =
    "https://raw.githubusercontent.com/dkozickis/AeroGeoJSON/master/fir.geojson";

const outputRoot = path.join(
    process.cwd(),
    "public",
    "data",
    "airspace"
);

async function downloadJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/geo+json, application/json",
            "User-Agent": "LuMa-Radar/1.0",
        },
    });

    if (!response.ok) {
        throw new Error(`Download failed ${response.status}: ${url}`);
    }

    return response.json();
}

function cleanFeatureCollection(data) {
    if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
        throw new Error("Expected GeoJSON FeatureCollection");
    }

    return {
        type: "FeatureCollection",
        features: data.features.filter(
            (feature) =>
                feature &&
                feature.type === "Feature" &&
                feature.geometry &&
                ["Polygon", "MultiPolygon"].includes(feature.geometry.type)
        ),
    };
}

console.log("Downloading LuMa airspace reference data...");

const [countriesRaw, firRaw] = await Promise.all([
    downloadJson(COUNTRIES_URL),
    downloadJson(FIR_URL),
]);

const countries = cleanFeatureCollection(countriesRaw);
const fir = cleanFeatureCollection(firRaw);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await writeFile(
    path.join(outputRoot, "countries.geojson"),
    JSON.stringify(countries),
    "utf8"
);

await writeFile(
    path.join(outputRoot, "fir.geojson"),
    JSON.stringify(fir),
    "utf8"
);

await writeFile(
    path.join(outputRoot, "manifest.json"),
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            countries: {
                source: "Natural Earth",
                sourceUrl: COUNTRIES_URL,
                features: countries.features.length,
                usage: "Reference country boundaries",
            },
            fir: {
                source: "AeroGeoJSON",
                sourceUrl: FIR_URL,
                features: fir.features.length,
                usage: "FIR reference boundaries - situational awareness only",
            },
        },
        null,
        2
    ),
    "utf8"
);

console.log(
    `Airspace reference ready: ${countries.features.length.toLocaleString("en-US")} country polygons, ` +
        `${fir.features.length.toLocaleString("en-US")} FIR polygons.`
);
