/*
 * Hilfsfunktionen fuer die PVGIS-Weiterleitung (/api/pvgis/tmy), die das
 * BOG Energy Studio nutzt. PVGIS (EU JRC) erlaubt keine Browser-Abfragen (CORS).
 */

export const PVGIS_TMY = "https://re.jrc.ec.europa.eu/api/v5_3/tmy";

export function parseKoordinaten(params: URLSearchParams): { lat: number; lon: number } | null {
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  if (!params.get("lat") || !params.get("lon")) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -60 || lat > 70 || lon < -180 || lon > 180) return null;
  // auf ~1 km runden: bessere Cache-Trefferquote, ausreichend fuer Klimadaten
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

type Zeile = Record<string, unknown>;

/** Behaelt nur die Felder, die das Energy Studio braucht (halbiert die Antwortgroesse). */
export function kompaktTmy(json: unknown) {
  const j = json as {
    inputs?: { location?: { latitude?: number; longitude?: number; elevation?: number } };
    outputs?: { tmy_hourly?: Zeile[] };
  };
  const zeilen = j?.outputs?.tmy_hourly;
  if (!Array.isArray(zeilen) || zeilen.length < 8760) throw new Error("Unerwartete PVGIS-Antwort");
  return {
    inputs: { location: j.inputs?.location ?? {} },
    outputs: {
      tmy_hourly: zeilen.map((z) => ({
        "time(UTC)": z["time(UTC)"],
        T2m: z.T2m,
        "G(h)": z["G(h)"],
        "Gd(h)": z["Gd(h)"],
      })),
    },
  };
}
