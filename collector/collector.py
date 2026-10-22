# -*- coding: utf-8 -*-

import gzip
import os
import threading
import time
from datetime import datetime, timedelta, timezone

import requests


OPENSKY_URL = "https://opensky-network.org/api/states/all"
TOKEN_URL = (
    "https://auth.opensky-network.org/"
    "auth/realms/opensky-network/"
    "protocol/openid-connect/token"
)

INGEST_URL = "https://lumalabs.ch/api/radar/ingest"

# SAT: CelesTrak-Bahndaten alle 2 Stunden von hier aus laden.
# Von Vercel aus sperrt CelesTrak grosse Gruppen wie Starlink
# ("GP data has not updated since your last successful download"),
# weil viele Projekte dieselbe Adresse teilen. CelesTrak erlaubt
# dieselbe Datei hoechstens alle 2 Stunden.
CELESTRAK_GP_URL = "https://celestrak.org/NORAD/elements/gp.php"
SAT_INGEST_URL = "https://lumalabs.ch/api/radar/satellites/ingest"
SAT_INTERVAL_SECONDS = 2 * 60 * 60
# Muss zu SOURCE_DEFINITIONS in src/lib/satellite-source.ts passen.
SAT_GROUPS = [
    "STATIONS",
    "VISUAL",
    "GPS-OPS",
    "GLO-OPS",
    "GALILEO",
    "BEIDOU",
    "STARLINK",
    "WEATHER",
    "RESOURCE",
    "SCIENCE",
    "AMATEUR",
    "GEO",
]

SWITZERLAND = {
    "lamin": 45.7,
    "lomin": 5.7,
    "lamax": 48.0,
    "lomax": 10.8,
}

# Authenticated OpenSky state vectors have 5-second resolution.
# We use 10 seconds to keep credit usage sensible.
INTERVAL_SECONDS = 25

TOKEN_REFRESH_MARGIN = 60

OPENSKY_CLIENT_ID = os.environ.get("OPENSKY_CLIENT_ID")
OPENSKY_CLIENT_SECRET = os.environ.get("OPENSKY_CLIENT_SECRET")
RADAR_INGEST_SECRET = os.environ.get("RADAR_INGEST_SECRET")


class TokenManager:
    def __init__(self):
        self.token = None
        self.expires_at = None

    def get_token(self):
        if (
            self.token
            and self.expires_at
            and datetime.now(timezone.utc) < self.expires_at
        ):
            return self.token

        return self.refresh()

    def refresh(self):
        if not OPENSKY_CLIENT_ID:
            raise RuntimeError(
                "OPENSKY_CLIENT_ID is not set"
            )

        if not OPENSKY_CLIENT_SECRET:
            raise RuntimeError(
                "OPENSKY_CLIENT_SECRET is not set"
            )

        response = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": OPENSKY_CLIENT_ID,
                "client_secret": OPENSKY_CLIENT_SECRET,
            },
            headers={
                "Content-Type":
                    "application/x-www-form-urlencoded",
            },
            timeout=20,
        )

        response.raise_for_status()

        data = response.json()

        self.token = data["access_token"]

        expires_in = int(
            data.get("expires_in", 1800)
        )

        self.expires_at = (
            datetime.now(timezone.utc)
            + timedelta(
                seconds=max(
                    60,
                    expires_in - TOKEN_REFRESH_MARGIN,
                )
            )
        )

        print(
            f"[AUTH] OpenSky token received "
            f"(valid about {expires_in // 60} min)"
        )

        return self.token

    def authorization_header(self):
        return {
            "Authorization":
                f"Bearer {self.get_token()}"
        }


TOKENS = TokenManager()


def fetch_aircraft():
    headers = {
        **TOKENS.authorization_header(),
        "User-Agent":
            "LuMa-Radar-Collector/1.1",
        "Accept":
            "application/json",
    }

    response = requests.get(
        OPENSKY_URL,
        params=SWITZERLAND,
        headers=headers,
        timeout=20,
    )

    # Token expired or rejected:
    # refresh once and retry.
    if response.status_code == 401:
        print(
            "[AUTH] Token rejected - refreshing"
        )

        TOKENS.token = None
        TOKENS.expires_at = None

        headers.update(
            TOKENS.authorization_header()
        )

        response = requests.get(
            OPENSKY_URL,
            params=SWITZERLAND,
            headers=headers,
            timeout=20,
        )

    if response.status_code == 429:
        retry_after = response.headers.get(
            "X-Rate-Limit-Retry-After-Seconds",
            "60",
        )

        remaining = response.headers.get(
            "X-Rate-Limit-Remaining",
            "0",
        )

        try:
            wait_seconds = int(retry_after)
        except ValueError:
            wait_seconds = 60

        print(
            f"[RATE LIMIT] OpenSky 429 | "
            f"remaining={remaining} | "
            f"waiting {wait_seconds}s"
        )

        time.sleep(wait_seconds)

        return None

    response.raise_for_status()

    remaining = response.headers.get(
        "X-Rate-Limit-Remaining",
        "?"
    )

    data = response.json()

    aircraft = []

    for state in data.get("states") or []:
        if len(state) < 15:
            continue

        longitude = state[5]
        latitude = state[6]

        if longitude is None or latitude is None:
            continue

        aircraft.append(
            {
                "icao24": state[0],
                "callsign": (state[1] or "").strip(),
                "country": state[2],
                "longitude": longitude,
                "latitude": latitude,
                "altitude": state[7],
                "onGround": state[8],
                "velocity": state[9],
                "heading": state[10],
                "verticalRate": state[11],
                "geoAltitude": state[13],
                "squawk": state[14],
            }
        )

    return aircraft, remaining


def send_to_luma(aircraft):
    if not RADAR_INGEST_SECRET:
        raise RuntimeError(
            "RADAR_INGEST_SECRET is not set"
        )

    payload = {
        "updated": int(
            datetime.now(
                timezone.utc
            ).timestamp()
            * 1000
        ),
        "aircraft": aircraft,
    }

    response = requests.post(
        INGEST_URL,
        json=payload,
        headers={
            "x-radar-secret":
                RADAR_INGEST_SECRET,
            "Content-Type":
                "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def sync_satellite_group(group):
    response = requests.get(
        CELESTRAK_GP_URL,
        params={
            "GROUP": group,
            "FORMAT": "JSON",
        },
        headers={
            "User-Agent":
                "LuMa-RADAR-Collector/1.0 (lumalabs.ch)",
        },
        timeout=60,
    )

    # 403: seit dem letzten Abruf keine neuen Daten, der Cache
    # auf lumalabs.ch ist also noch aktuell.
    if response.status_code == 403:
        return "unchanged"

    response.raise_for_status()

    body = response.content.strip()

    # CelesTrak antwortet bei Fehlern mit Text statt JSON.
    if not body.startswith(b"["):
        raise RuntimeError(
            body[:80].decode(
                "utf-8",
                "replace",
            )
        )

    upload = requests.post(
        SAT_INGEST_URL,
        params={"group": group},
        data=gzip.compress(body),
        headers={
            "x-radar-secret":
                RADAR_INGEST_SECRET,
            "x-payload-encoding":
                "gzip",
            "Content-Type":
                "application/octet-stream",
        },
        timeout=60,
    )

    upload.raise_for_status()

    return f"{upload.json().get('count')} stored"


def satellite_loop():
    while True:
        for group in SAT_GROUPS:
            try:
                status = sync_satellite_group(group)

                print(
                    f"[SAT] {group}: {status}"
                )

            except Exception as exc:
                print(
                    f"[SAT ERROR] {group}: {exc}"
                )

            # Kurze Pause zwischen den Gruppen, CelesTrak schonen.
            time.sleep(5)

        time.sleep(
            SAT_INTERVAL_SECONDS
        )


def main():
    print(
        "LuMa Radar Collector starting..."
    )

    print(
        "OpenSky authentication: OAuth2"
    )

    print(
        f"OpenSky: {OPENSKY_URL}"
    )

    print(
        f"Ingest:  {INGEST_URL}"
    )

    print(
        f"Interval: {INTERVAL_SECONDS}s"
    )

    print(
        f"SAT:     {SAT_INGEST_URL} "
        f"every {SAT_INTERVAL_SECONDS // 3600}h"
    )

    print()

    # Force authentication immediately so
    # configuration problems show up before loop.
    TOKENS.get_token()

    # SAT-Bahndaten in einem eigenen Thread, damit die
    # Flugzeugdaten im 25-Sekunden-Takt weiterlaufen.
    threading.Thread(
        target=satellite_loop,
        daemon=True,
    ).start()

    while True:
        cycle_started = time.time()

        try:
            result = fetch_aircraft()

            if result is None:
                continue

            aircraft, remaining = result

            ingest_result = send_to_luma(
                aircraft
            )

            print(
                f"[OK] "
                f"{len(aircraft)} aircraft -> "
                f"{ingest_result.get('count')} stored | "
                f"{ingest_result.get('tracksUpdated', 0)} tracks | "
                f"OpenSky credits: {remaining}"
            )

        except requests.RequestException as exc:
            print(
                f"[NETWORK ERROR] {exc}"
            )

        except Exception as exc:
            print(
                f"[ERROR] {exc}"
            )

        elapsed = (
            time.time()
            - cycle_started
        )

        sleep_seconds = max(
            1,
            INTERVAL_SECONDS - elapsed,
        )

        time.sleep(
            sleep_seconds
        )


if __name__ == "__main__":
    main()
