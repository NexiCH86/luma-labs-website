import { NextResponse } from "next/server";

const OPENSKY_URL =
    "https://opensky-network.org/api/states/all";

const SWITZERLAND = {
    lamin: 45.7,
    lomin: 5.7,
    lamax: 48.0,
    lomax: 10.8,
};

export async function GET() {
    try {
        const params = new URLSearchParams({
            lamin: SWITZERLAND.lamin.toString(),
            lomin: SWITZERLAND.lomin.toString(),
            lamax: SWITZERLAND.lamax.toString(),
            lomax: SWITZERLAND.lomax.toString(),
        });

        const response = await fetch(
            `${OPENSKY_URL}?${params}`,
            {
                cache: "no-store",
            }
        );

        if (!response.ok) {
            return NextResponse.json(
                {
                    aircraft: [],
                    count: 0,
                    error: `OpenSky returned ${response.status}`,
                },
                {
                    status: response.status,
                }
            );
        }

        const data = await response.json();

        const aircraft =
            data.states
                ?.filter(
                    (state: unknown[]) =>
                        state[5] !== null &&
                        state[6] !== null
                )
                .map((state: unknown[]) => ({
                    icao24: state[0],
                    callsign:
                        typeof state[1] === "string"
                            ? state[1].trim()
                            : "",
                    country: state[2],
                    longitude: state[5],
                    latitude: state[6],
                    altitude: state[7],
                    onGround: state[8],
                    velocity: state[9],
                    heading: state[10],
                    verticalRate: state[11],
                    geoAltitude: state[13],
                    squawk: state[14],
                })) ?? [];

        return NextResponse.json({
            count: aircraft.length,
            aircraft,
            updated: Date.now(),
        });
    } catch (error) {
        console.error("LuMa Radar API:", error);

        return NextResponse.json(
            {
                count: 0,
                aircraft: [],
                error: "Radar data unavailable",
            },
            {
                status: 500,
            }
        );
    }
}