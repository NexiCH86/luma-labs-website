import { NextResponse } from "next/server";
import { PVGIS_TMY, kompaktTmy, parseKoordinaten } from "@/lib/pvgis-proxy";

/*
 * Typisches Meteojahr (TMY) von PVGIS fuer das BOG Energy Studio (/energy).
 * Auch die Desktop-App ruft diese Route auf, deshalb CORS offen.
 * Antworten werden 30 Tage im CDN gehalten (Klimadaten aendern sich nicht).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const koordinaten = parseKoordinaten(new URL(request.url).searchParams);
  if (!koordinaten) {
    return NextResponse.json(
      { message: "Parameter lat (−60…70) und lon (−180…180) erforderlich." },
      { status: 400, headers: CORS },
    );
  }

  const url = `${PVGIS_TMY}?lat=${koordinaten.lat}&lon=${koordinaten.lon}&outputformat=json`;
  try {
    const antwort = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!antwort.ok) {
      let message = `PVGIS antwortet mit ${antwort.status}`;
      try {
        message = (await antwort.json())?.message ?? message;
      } catch {
        /* keine JSON-Fehlermeldung */
      }
      return NextResponse.json({ message }, { status: antwort.status === 400 ? 400 : 502, headers: CORS });
    }
    return NextResponse.json(kompaktTmy(await antwort.json()), {
      headers: {
        ...CORS,
        "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch (fehler) {
    return NextResponse.json(
      { message: `PVGIS nicht erreichbar: ${(fehler as Error).message}` },
      { status: 502, headers: CORS },
    );
  }
}
