# LuMa Radar Collector

Holt alle 25 Sekunden die Flugzeuge über der Schweiz bei OpenSky (Bounding Box 45.7–48.0 N, 5.7–10.8 E) und schickt sie an `https://lumalabs.ch/api/radar/ingest`.

Er läuft ausserhalb von Vercel, weil OpenSky Anfragen aus Cloud-Rechenzentren blockiert. Weltweite Flugzeuge kommen nicht von hier, sondern direkt von adsb.lol (`/api/radar/area`).

Zusätzlich lädt er alle 2 Stunden die SAT-Bahndaten aller Gruppen (Starlink, GPS, Stationen …) bei CelesTrak und schickt sie gzip-komprimiert an `https://lumalabs.ch/api/radar/satellites/ingest` (gleicher Schlüssel `RADAR_INGEST_SECRET`). Von Vercel aus sperrt CelesTrak grosse Gruppen wie Starlink, weil sich dort viele Projekte dieselbe Adresse teilen. Antwortet CelesTrak mit 403, gibt es seit dem letzten Abruf keine neuen Daten; der Collector überspringt die Gruppe dann. Log-Zeilen: `[SAT] STARLINK: 9123 stored`. Kontrolle: `https://lumalabs.ch/api/radar/sat-health`.

## Wo er läuft

| | |
|---|---|
| Gerät | Server-Pi `luma-server-pi5` (192.168.1.34) |
| Ordner | `/home/luis/luma-radar` |
| Dienst | `luma-radar.service` (systemd, Neustart bei Absturz) |
| Python | 3.13, venv in `.venv` |
| Zugangsdaten | `/home/luis/luma-radar/.env` (nicht im Repo, siehe `.env.example`) |

Überwachung: Der Uptime-Kuma-Monitor auf luma-core prüft `https://lumalabs.ch/api/radar/health` und meldet an Discord, wenn keine frischen Daten ankommen.

## Wiederherstellen (z. B. nach SD-Karten-Defekt)

```bash
mkdir -p ~/luma-radar && cd ~/luma-radar
# collector.py, requirements.txt und .env.example aus diesem Ordner hierher kopieren
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env && chmod 600 .env   # Werte eintragen
sudo cp luma-radar.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now luma-radar
journalctl -u luma-radar -f              # Log prüfen
```

## Nützliche Befehle

```bash
systemctl status luma-radar
journalctl -u luma-radar --since "1 hour ago"
sudo systemctl restart luma-radar
```
