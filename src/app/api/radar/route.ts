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

        const url =
            `${OPENSKY_URL}?${params.toString()}`;

        const response =
            await fetch(url, {
                cache: "no-store",

                headers: {
                    "User-Agent":
                        "LuMa-Radar/1.0",
                    Accept:
                        "application/json",
                },
            });

        if (!response.ok) {
            const upstreamText =
                await response.text();

            console.error(
                "OpenSky upstream error",
                {
                    status:
                        response.status,
                    statusText:
                        response.statusText,
                    body:
                        upstreamText,
                }
            );

            return NextResponse.json(
                {
                    count: 0,
                    aircraft: [],
                    error:
                        "OpenSky upstream error",
                    upstreamStatus:
                        response.status,
                    upstreamStatusText:
                        response.statusText,
                    upstreamBody:
                        upstreamText.slice(
                            0,
                            500
                        ),
                },
                {
                    status: 502,
                }
            );
        }

        const data =
            await response.json();

        const aircraft =
            data.states
                ?.filter(
                    (state: unknown[]) =>
                        state[5] !== null &&
                        state[6] !== null
                )
                .map(
                    (
                        state: unknown[]
                    ) => ({
                        icao24:
                            state[0],

                        callsign:
                            typeof state[1] ===
                                "string"
                                ? state[1].trim()
                                : "",

                        country:
                            state[2],

                        longitude:
                            state[5],

                        latitude:
                            state[6],

                        altitude:
                            state[7],

                        onGround:
                            state[8],

                        velocity:
                            state[9],

                        heading:
                            state[10],

                        verticalRate:
                            state[11],

                        geoAltitude:
                            state[13],

                        squawk:
                            state[14],
                    })
                ) ?? [];

        return NextResponse.json({
            count:
                aircraft.length,

            aircraft,

            updated:
                Date.now(),
        });
    } catch (error) {
        console.error(
            "LuMa Radar API error:",
            error
        );

        return NextResponse.json(
            {
                count: 0,
                aircraft: [],
                error:
                    "Radar data unavailable",
                details:
                    error instanceof Error
                        ? error.message
                        : String(
                            error
                        ),
            },
            {
                status: 500,
            }
        );
    }
}