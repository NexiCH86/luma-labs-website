const items = [
  {
    title: "LuMa Labs Platform",
    status: "LIVE",
    phase: "Foundation",
    progress: 95,
    summary:
      "Die technische Basis der LuMa-Labs-Plattform ist produktiv und bildet das Fundament für alle weiteren Module.",
    done: [
      "lumalabs.ch mit Next.js, TypeScript und Vercel produktiv",
      "Corporate Design, Hauptnavigation und getrennte Produktzugänge",
      "Eigene Bereiche für RADAR, Control Center und Intern",
    ],
    next: [
      "Navigation und Mobile UX weiter verfeinern",
      "Projektseiten und Produktübersichten stärker miteinander verknüpfen",
    ],
    accent: "emerald",
  },
  {
    title: "LuMa Control Center",
    status: "V1 LIVE",
    phase: "NEX-27 · Operations",
    progress: 80,
    summary:
      "Das geschützte Operations-Dashboard ist live und sammelt echte Telemetrie aus dem gesamten LuMa-Geräteverbund.",
    done: [
      "4/4 Systeme live: LuisServer, Master-Intel, Master-Mac und Kali-Mac",
      "CPU, RAM, Storage, Uptime, Temperaturen und RTX-4090-GPU-Telemetrie",
      "Eigener Login, eigene Session und separater Control-Center-Redis",
      "Reboot-fester Autostart via systemd, launchd und Windows Task Scheduler",
    ],
    next: [
      "Geräte anklickbar machen und eigene Detailansichten ergänzen",
      "WORK/GAMING Remote-Aktionen und Wake-on-LAN integrieren",
      "Sunshine/Moonlight-, Portainer- und Uptime-Kuma-Status einbinden",
      "Server- und Docker-Management nach NEX-28 sicher ausbauen",
    ],
    accent: "emerald",
  },
  {
    title: "LuMa RADAR · AIR",
    status: "AKTIVE ENTWICKLUNG",
    phase: "High Priority · Linear",
    progress: 70,
    summary:
      "AIR entwickelt sich vom Schweizer Live-Radar zur weltweiten Flugverkehrs- und Airport-Plattform.",
    done: [
      "Live-Flugzeuge, Mapbox 2D/3D, Höhenfarben und Flugspuren",
      "Airport Explorer, OurAirports-Daten, Runways und Airspace-Layer",
      "Aircraft Type/Registration-Datenbasis und Aircraft-Detailpanel",
      "Raspberry-Pi-Collector mit OpenSky OAuth2 und Redis-Ingest",
    ],
    next: [
      "Weltweite Abdeckung und Airports weiter skalieren (NEX-8 / NEX-9)",
      "Flight Phase, Steigen/Sinken sowie Route, Distanz und ETA (NEX-10 / NEX-11)",
      "Erweiterte Filter, Aircraft-Kategorien und Helikopter (NEX-12 / NEX-13)",
      "Squawk-Sonderstatus sowie Aircraft-Bilder und Typeninfos (NEX-14 / NEX-7)",
    ],
    accent: "cyan",
  },
  {
    title: "LuMa RADAR · SAT",
    status: "PROTOTYP / AUSBAU",
    phase: "Satellite Tracking · Linear",
    progress: 45,
    summary:
      "SAT schafft einen eigenständigen globalen Satellitenmodus mit echten TLE-/Orbitdaten und visueller Bahnverfolgung.",
    done: [
      "Eigenständiger SAT-Bereich mit globaler Karten-/Globe-Ansicht",
      "TLE-Verarbeitung und Orbit-Propagation technisch erprobt",
      "Workspace-, Tracking- und Detailpanel-Prototypen vorhanden",
    ],
    next: [
      "Orbit-Engine und Datenquelle final stabilisieren (NEX-15)",
      "Globale Satellitenkarte und Ground Tracks produktionsreif machen (NEX-16)",
      "NORAD-ID, Betreiber, Objektart, Startdaten und Filter ergänzen (NEX-17)",
    ],
    accent: "cyan",
  },
  {
    title: "LuMa RADAR · SKY",
    status: "GEPLANT",
    phase: "Astronomy · Linear",
    progress: 15,
    summary:
      "SKY wird der Astronomie-Modus von LuMa RADAR: sichtbarer Himmel für Standort und Zeitpunkt mit interaktiver Sternenkarte.",
    done: [
      "Funktionsumfang und Moduskonzept in der RADAR-Roadmap definiert",
    ],
    next: [
      "Astronomie-Engine, Koordinatensysteme und Sternkataloge auswählen (NEX-18)",
      "Interaktive Sternenkarte mit Sternen, Sternbildern und Planeten bauen (NEX-19)",
      "Messier-/NGC-/Deep-Sky-Objekte mit Suche und Detailpanel integrieren (NEX-20)",
    ],
    accent: "amber",
  },
  {
    title: "LuMa OS · Ecosystem Shell",
    status: "VISION / BACKLOG",
    phase: "NEX-29",
    progress: 10,
    summary:
      "Langfristig soll das Control Center zur gemeinsamen LuMa-OS-Oberfläche für alle Produkte und Infrastrukturmodule wachsen.",
    done: [
      "Control Center und getrennte Produktbereiche schaffen bereits die technische Basis",
    ],
    next: [
      "Gemeinsame Navigation, Authentifizierung und Rollenmodell",
      "Module für RADAR, Server, BIM, Docs, Security und später LuMa AI",
      "Bestehende Projekte integrieren statt Funktionen zu duplizieren",
    ],
    accent: "amber",
  },
  {
    title: "LuMa Air, BIM & Engineering Tools",
    status: "GEPLANT / PARALLEL",
    phase: "Engineering Software",
    progress: 25,
    summary:
      "Eigene Engineering-Werkzeuge sollen praktische BIM- und Gebäudetechnik-Workflows automatisieren und als LuMa-Produkte gebündelt werden.",
    done: [
      "Lüftungsrechner-Konzept und Python-Entwicklungsumgebung vorhanden",
      "Revit-/Dynamo-/Collision-Tool-Ideen und Roadmaps definiert",
    ],
    next: [
      "LuMa Air Alpha und Desktop-/Installer-Struktur weiterentwickeln",
      "Revit-Kollisionsprüfung Lüftung/Sanitär und weitere BIM-Automationen",
      "IFC-Viewer und spezialisierte Engineering-Hilfsprogramme",
    ],
    accent: "slate",
  },
  {
    title: "Academy, Docs & Smart Infrastructure",
    status: "LANGFRISTIG",
    phase: "Knowledge & Infrastructure",
    progress: 20,
    summary:
      "Dokumentation, Weiterbildung und Homelab-Infrastruktur bilden die Wissens- und Betriebsplattform hinter LuMa Labs.",
    done: [
      "Developer Handbook, Dokumentationsstruktur und Homelab-Grundsystem vorhanden",
      "LuisServer mit Docker, Portainer, Uptime Kuma und weiteren Infrastrukturservices",
    ],
    next: [
      "LuMa Academy und strukturierte Lern-/Projektinhalte ausbauen",
      "Automatisierte Dokumentation, Builds und CI/CD auf dem Homelab",
      "Remote-, Monitoring- und Smart-Infrastructure-Funktionen enger mit Control Center verzahnen",
    ],
    accent: "slate",
  },
];

const accentStyles = {
  emerald: {
    badge: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200",
    number: "border-emerald-300/30 text-emerald-200",
    dot: "bg-emerald-300",
    bar: "bg-emerald-300",
  },
  cyan: {
    badge: "border-[#00D7D5]/25 bg-[#00D7D5]/[0.055] text-[#55ECE9]",
    number: "border-[#00D7D5]/40 text-[#00D7D5]",
    dot: "bg-[#00D7D5]",
    bar: "bg-[#00D7D5]",
  },
  amber: {
    badge: "border-amber-300/20 bg-amber-300/[0.05] text-amber-200",
    number: "border-amber-300/30 text-amber-200",
    dot: "bg-amber-300",
    bar: "bg-amber-300",
  },
  slate: {
    badge: "border-white/10 bg-white/[0.025] text-slate-400",
    number: "border-white/15 text-slate-400",
    dot: "bg-slate-500",
    bar: "bg-slate-500",
  },
} as const;

export function Roadmap() {
  return (
    <section id="roadmap" className="scroll-mt-24 border-t border-white/10 bg-[#08151f] py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-[#00D7D5]">
            Roadmap · Stand August 2026
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
            Schritt für Schritt zum Engineering-Ökosystem.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-400">
            Nicht nur eine Liste von Ideen: Hier siehst du, was bereits produktiv ist,
            woran aktiv gearbeitet wird und welche konkreten nächsten Schritte aus der
            LuMa-Labs- und Linear-Roadmap folgen.
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {items.map((item, index) => {
            const styles = accentStyles[item.accent];

            return (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-[#0A1924] p-6 transition hover:border-[#00D7D5]/20 hover:bg-[#0B1C28] md:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-sm font-medium ${styles.number}`}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-medium text-white">{item.title}</h3>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">{item.phase}</span>
                      </div>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{item.summary}</p>
                    </div>
                  </div>

                  <div className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                    {item.status}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    <span>Fortschritt</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${item.progress}%` }} />
                  </div>
                </div>

                <div className="mt-7 grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-black/[0.08] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">Bereits umgesetzt</p>
                    <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-400">
                      {item.done.map((entry) => (
                        <li key={entry} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/70" />{entry}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-black/[0.08] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#55ECE9]/70">Nächste Schritte</p>
                    <ul className="mt-4 space-y-2.5 text-sm leading-6 text-slate-400">
                      {item.next.map((entry) => (
                        <li key={entry} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D7D5]/70" />{entry}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
